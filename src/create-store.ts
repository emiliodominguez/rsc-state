// A namespace import keeps module loading working on React builds without `cache` (stable
// React 18), where a named import fails at link time; the store reports a clear error instead
import * as React from "react";

import type { BatchApi, EmptyDerivedState, HydrateOptions, OperationType, ServerStore, StorageMode, StoreConfig, StoreState } from "./types";

/**
 * A committed state change, handed to lifecycle callbacks once the mutation lock is released.
 */
interface StateTransition<T> {
	previousState: T;
	nextState: T;
}

/**
 * Mutable container backing one store scope: a single request in "request" mode,
 * or the whole process in "persistent" mode.
 */
interface StoreInstance<T, F> {
	/** Committed base state. Replaced, never mutated in place. */
	state: T;

	/** Whether `initialize()` ran or the adapter supplied stored state. */
	initialized: boolean;

	/** Whether the storage adapter has been read. Always true when no adapter is configured. */
	hydrated: boolean;

	/** Base state reference that `fullState` was computed from. */
	derivedSourceState: T | undefined;

	/**
	 * Derive function that produced `fullState`. Keyed persistent instances can outlive a
	 * store definition (e.g. across dev hot reloads), so a new derive must not reuse the old memo.
	 */
	derivedBy: unknown;

	/** Memoized base + derived state, returned as-is while `state` is unchanged. */
	fullState: F;

	/** Error thrown by derive for `derivedSourceState`, or null when it succeeded. */
	deriveError: Error | null;

	/** Tail of the mutation queue, or null when no mutation is in flight. */
	pendingMutation: Promise<void> | null;

	/** In-flight adapter read shared by concurrent callers, or null when idle. */
	pendingHydration: Promise<void> | null;
}

const PERSISTENT_REGISTRY_KEY: unique symbol = Symbol.for("rsc-state.persistent-instances");

/**
 * Global scope augmented with the keyed persistent instance registry.
 */
type GlobalScopeWithRegistry = typeof globalThis & {
	[PERSISTENT_REGISTRY_KEY]?: Map<string, StoreInstance<unknown, unknown>>;
};

/**
 * Returns the process-wide registry of keyed persistent instances. It lives on `globalThis`
 * (under a `Symbol.for` key) so it survives module re-evaluation during dev hot reloads and is
 * shared when a bundler instantiates the same store module more than once (for example
 * Next.js page and route handler bundles).
 *
 * @returns Registry mapping store keys to instances
 */
function getPersistentRegistry(): Map<string, StoreInstance<unknown, unknown>> {
	const globalScope = globalThis as GlobalScopeWithRegistry;

	globalScope[PERSISTENT_REGISTRY_KEY] ??= new Map();

	return globalScope[PERSISTENT_REGISTRY_KEY];
}

/**
 * React module shape as seen at runtime, where `cache` may be missing (stable React 18).
 */
type ReactModuleWithOptionalCache = Partial<Pick<typeof React, "cache">>;

/**
 * Debug log label for each operation type.
 */
const OPERATION_LOG_LABELS: Record<OperationType, string> = {
	initialize: "Initialized",
	update: "Updated",
	set: "Set",
	patch: "Patched",
	reset: "Reset",
	batch: "Batch updated",
};

/**
 * Detects thenables so synchronous middleware, adapters and callbacks can run without
 * yielding to the microtask queue. This lets fully synchronous stores commit mutations
 * in the same tick they are requested.
 *
 * @param value - Value that may or may not be a promise
 * @returns True when the value exposes a callable `then` method
 */
function isPromiseLike<V>(value: V | PromiseLike<V>): value is PromiseLike<V> {
	return (typeof value === "object" || typeof value === "function") && value !== null && typeof (value as PromiseLike<V>).then === "function";
}

/**
 * Normalizes any thrown value into an Error instance so callbacks receive a consistent type.
 *
 * @param thrownValue - Value caught in a catch clause
 * @returns The original Error, or a new Error wrapping the stringified value
 */
function toError(thrownValue: unknown): Error {
	return thrownValue instanceof Error ? thrownValue : new Error(String(thrownValue));
}

/**
 * Shallow-merges a partial state into a base state, preserving the base reference when
 * every provided value is already identical. Keeping the reference lets the store detect
 * no-op patches and skip middleware, adapter writes, callbacks and derive recomputation.
 *
 * @param state - Current state
 * @param partialState - Properties to merge
 * @returns A new merged state, or the original state when nothing changed
 */
function mergePartialState<T extends object>(state: T, partialState: Partial<T>): T {
	for (const key in partialState) {
		if (!(key in state) || !Object.is(state[key], partialState[key])) {
			return { ...state, ...partialState };
		}
	}

	return state;
}

/**
 * Checks whether a value is a plain object (object literal, `JSON.parse` output or
 * `Object.create(null)`) rather than a class instance such as Date or Map.
 *
 * @param value - Object to inspect
 * @returns True when the prototype is Object.prototype or null
 */
function isPlainObject(value: object): boolean {
	const prototype: unknown = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}

/**
 * Copies plain objects and arrays, sharing everything else (class instances, primitives).
 *
 * Every request-scoped instance would otherwise start from the very same `initial` object, so an
 * in-place mutation of what `read()` returned (`read().items.push(...)`) would leak into every later
 * request, including other users'. Copying gives each instance its own plain data. Copying is used
 * rather than freezing because V8 iterates frozen arrays 5-15x slower, which would tax every render.
 *
 * Accessor properties are copied as accessors, never invoked. Keys named `__proto__` are defined,
 * not assigned, so a JSON-sourced `initial` cannot change the copy's prototype. Cycles are preserved.
 *
 * @param value - Value to copy
 * @param copiesBySource - Copies made so far, keyed by their source object
 * @returns A copy for plain objects and arrays, the value itself otherwise
 */
function clonePlainData<V>(value: V, copiesBySource = new Map<object, unknown>()): V {
	if (typeof value !== "object" || value === null) {
		return value;
	}

	const existingCopy = copiesBySource.get(value);

	if (existingCopy !== undefined) {
		return existingCopy as V;
	}

	if (Array.isArray(value)) {
		const arrayCopy: unknown[] = [];

		copiesBySource.set(value, arrayCopy);

		for (const element of value as unknown[]) {
			arrayCopy.push(clonePlainData(element, copiesBySource));
		}

		return arrayCopy as V;
	}

	if (!isPlainObject(value)) {
		return value;
	}

	const objectCopy = Object.create(Object.getPrototypeOf(value) as object | null) as Record<PropertyKey, unknown>;

	copiesBySource.set(value, objectCopy);

	for (const key of Reflect.ownKeys(value)) {
		const propertyDescriptor = Object.getOwnPropertyDescriptor(value, key);

		if (propertyDescriptor === undefined) {
			continue;
		}

		if ("value" in propertyDescriptor) {
			propertyDescriptor.value = clonePlainData<unknown>(propertyDescriptor.value, copiesBySource);
		}

		const isOrdinaryDataProperty =
			propertyDescriptor.writable === true && propertyDescriptor.enumerable === true && propertyDescriptor.configurable === true;

		// Plain assignment keeps the fast object shape; "__proto__" must be defined to stay an own key
		if (isOrdinaryDataProperty && key !== "__proto__") {
			objectCopy[key] = propertyDescriptor.value;
		} else {
			Object.defineProperty(objectCopy, key, propertyDescriptor);
		}
	}

	return objectCopy as V;
}

/**
 * Finds the first class instance (Map, Set, Date, ...) nested in plain objects and arrays.
 * `clonePlainData` cannot copy these, so in a literal `initial` they stay shared by every request.
 *
 * @param value - State tree to scan
 * @returns Dotted path of the first class instance (e.g. "initial.sessions"), or null
 */
function findSharedClassInstancePath(value: unknown): string | null {
	const pendingEntries: { value: unknown; path: string }[] = [{ value, path: "initial" }];
	const visitedObjects = new Set<object>();

	while (pendingEntries.length > 0) {
		const entry = pendingEntries.pop();

		if (entry === undefined || typeof entry.value !== "object" || entry.value === null || visitedObjects.has(entry.value)) {
			continue;
		}

		visitedObjects.add(entry.value);

		if (Array.isArray(entry.value)) {
			(entry.value as unknown[]).forEach((element, index) => {
				pendingEntries.push({ value: element, path: `${entry.path}[${index}]` });
			});
		} else if (isPlainObject(entry.value)) {
			for (const key of Reflect.ownKeys(entry.value)) {
				const propertyDescriptor = Object.getOwnPropertyDescriptor(entry.value, key);

				if (propertyDescriptor !== undefined && "value" in propertyDescriptor) {
					pendingEntries.push({ value: propertyDescriptor.value, path: `${entry.path}.${String(key)}` });
				}
			}
		} else {
			return entry.path;
		}
	}

	return null;
}

/**
 * Describes an invalid state value for error messages without echoing its content,
 * which may be sensitive.
 *
 * @param value - Invalid value
 * @returns Short description such as "null" or "a string"
 */
function describeInvalidState(value: unknown): string {
	if (value === null) {
		return "null";
	}

	return value === undefined ? "undefined" : `a ${typeof value}`;
}

/**
 * Creates a server store for managing state in React Server Components.
 *
 * Supports two storage modes:
 * - `"request"` (default): State isolated per request using React's cache API.
 *   Safe for user-specific data. Prevents state leakage between users.
 * - `"persistent"`: State persists across requests using module-level storage.
 *   Shared across ALL users. Only use for global app state.
 *
 * Mutations on a store instance are serialized, so concurrent calls (for example from
 * `Promise.all`) never lose each other's changes, even with async middleware or adapters.
 * When no middleware or adapter needs to await anything, mutations commit synchronously.
 *
 * @param configuration - Store configuration with initial state, middleware, adapter, and callbacks
 * @returns Store instance with async methods to initialize, hydrate, and update state, and sync methods to read it
 *
 * @example
 * Request-scoped store (safe for user data)
 * ```typescript
 * const userStore = createServerStore({
 *   initial: { userId: null as string | null, userName: '' },
 *   derive: (state) => ({
 *     isAuthenticated: state.userId !== null
 *   }),
 * });
 *
 * // In layout
 * await userStore.initialize({ userId: "123", userName: "John" });
 *
 * // Anywhere below: { userId, userName, isAuthenticated } is fully typed
 * const { isAuthenticated } = userStore.read();
 * ```
 *
 * @example
 * Persistent store with storage adapter
 * ```typescript
 * const settingsStore = createServerStore({
 *   storage: "persistent",
 *   initial: { theme: "light" },
 *   adapter: {
 *     read: async () => await redis.get("settings"),
 *     write: async (state) => await redis.set("settings", state),
 *   },
 *   derive: (state) => ({
 *     isDarkMode: state.theme === "dark"
 *   })
 * });
 *
 * // Load persisted state before the first read
 * const settings = await settingsStore.hydrate();
 * ```
 */
export function createServerStore<T extends object, D extends object = EmptyDerivedState>(configuration: StoreConfig<T, D>): ServerStore<T, D> {
	type State = T;
	type FullState = StoreState<T, D>;
	type Instance = StoreInstance<State, FullState>;

	const storageMode: StorageMode = configuration.storage ?? "request";
	const isPersistent = storageMode === "persistent";
	const isDebugEnabled = configuration.debug === true;
	const logPrefix = `[rsc-state:${storageMode}]`;
	const middlewareChain = configuration.middleware ?? [];
	const deriveFunction = configuration.derive;
	const shouldThrowOnDeriveError = configuration.throwOnDeriveError === true;

	// Adapters only make sense for state that outlives a request
	const adapter = isPersistent ? configuration.adapter : undefined;

	if (!isPersistent && typeof configuration.initial !== "function") {
		const sharedClassInstancePath = findSharedClassInstancePath(configuration.initial);

		// Always warn: a mutable container shared by every request is a cross-user leak risk
		if (sharedClassInstancePath !== null) {
			console.warn(
				`${logPrefix} ${sharedClassInstancePath} is a class instance (Map, Set, Date, ...) that cannot be copied per request, so every request shares it. ` +
					"Mutating it in place would leak data between requests. Use a factory instead: initial: () => ({ ... }).",
			);
		}
	}

	if (isDebugEnabled && !isPersistent && configuration.adapter) {
		console.warn(`${logPrefix} Storage adapters are ignored in "request" mode. Use storage: "persistent" to enable them.`);
	}

	/**
	 * Module-level storage for persistent mode.
	 * WARNING: Shared across all users and requests.
	 */
	let persistentInstance: Instance | null = null;

	let hasReportedMissingRequestScope = false;

	/**
	 * Resolves the initial state from configuration, calling the factory when one is provided.
	 *
	 * @returns Initial state value
	 */
	function getInitialState(): State {
		const initialState: unknown = typeof configuration.initial === "function" ? configuration.initial() : configuration.initial;

		assertValidState(initialState, "The initial state");

		// A literal `initial` would otherwise be the same object in every instance (see clonePlainData)
		return typeof configuration.initial === "function" ? initialState : clonePlainData(initialState);
	}

	/**
	 * Rejects values that cannot be store state. Without this, `null` (for example from
	 * `JSON.parse` of a tampered cookie) or a corrupted adapter value would be committed and
	 * crash readers later, far from the cause.
	 *
	 * @param value - Candidate state
	 * @param source - Human-readable origin of the value, used in the error message
	 * @param hint - Optional guidance appended to the error message
	 * @returns void
	 */
	function assertValidState(value: unknown, source: string, hint = ""): asserts value is State {
		if (typeof value === "object" && value !== null) {
			return;
		}

		throw new TypeError(`${logPrefix} ${source} returned ${describeInvalidState(value)}. Store state must be an object.${hint}`);
	}

	/**
	 * Builds a fresh store instance seeded with the initial state.
	 *
	 * @returns New store instance
	 */
	function createInstance(): Instance {
		const state = getInitialState();

		return {
			state,
			initialized: false,
			hydrated: adapter === undefined,
			derivedSourceState: undefined,
			derivedBy: undefined,
			fullState: state as FullState,
			deriveError: null,
			pendingMutation: null,
			pendingHydration: null,
		};
	}

	/**
	 * Builds the request-scoped instance accessor on top of React's cache(). Fails at store
	 * creation, with guidance, when the running React build does not provide cache().
	 *
	 * @returns Accessor returning the current request's instance
	 */
	function createRequestScopedAccessor(): () => Instance {
		const reactCache = (React as ReactModuleWithOptionalCache).cache;

		if (typeof reactCache !== "function") {
			throw new Error(
				`${logPrefix} Request-scoped stores require React's cache(), which this React build does not provide. ` +
					"It is available in React 19 and in the React canary builds some frameworks bundle. " +
					'Upgrade to React 19, or use storage: "persistent" for state that is not request-specific.',
			);
		}

		// React cache invalidates automatically per request, ensuring
		// no state leakage between different user requests
		return reactCache(createInstance);
	}

	/**
	 * Returns the process-wide instance used in persistent mode, creating it on first access.
	 * Keyed stores resolve through the global registry so every definition sharing the key
	 * shares one instance.
	 *
	 * @returns Persistent store instance
	 */
	function getPersistentInstance(): Instance {
		persistentInstance ??= configuration.key === undefined ? createInstance() : getOrCreateKeyedInstance(configuration.key);

		return persistentInstance;
	}

	/**
	 * Looks up a keyed persistent instance in the global registry, registering a new one on miss.
	 *
	 * @param storeKey - Unique store key from configuration
	 * @returns Shared persistent instance for the key
	 */
	function getOrCreateKeyedInstance(storeKey: string): Instance {
		const registry = getPersistentRegistry();
		const registeredInstance = registry.get(storeKey);

		if (registeredInstance !== undefined) {
			return registeredInstance as Instance;
		}

		const instance = createInstance();

		registry.set(storeKey, instance);

		return instance;
	}

	/**
	 * Warns once when React's cache is not memoizing, which happens outside a Server Component
	 * render (route handlers, Server Actions, Client Components) or when rsc-state resolves a
	 * different React copy than the app renders with. Either way, every call gets a fresh request
	 * instance and writes to a request-scoped store would otherwise be silently discarded.
	 *
	 * @param instance - Instance the current mutation resolved
	 * @returns void
	 */
	function verifyRequestScope(instance: Instance): void {
		if (isPersistent || hasReportedMissingRequestScope || getInstance() === instance) {
			return;
		}

		hasReportedMissingRequestScope = true;
		console.warn(
			`${logPrefix} React cache() is not active here, so request-scoped state is discarded after every call. ` +
				"Request-scoped stores only keep state while React renders Server Components; outside a render " +
				'(e.g. route handlers or Server Actions) each call gets a fresh instance. Use storage: "persistent" or pass data explicitly. ' +
				"If this appears during a render, rsc-state is importing a different copy of React than your app " +
				'(common with linked or workspace packages): dedupe "react" in your bundler (Vite: resolve.dedupe).',
		);
	}

	const getInstance = isPersistent ? getPersistentInstance : createRequestScopedAccessor();

	/**
	 * Applies state loaded from the adapter. A null or undefined value means nothing has been
	 * stored yet, in which case the current (initial) state is kept.
	 *
	 * @param instance - Instance to update
	 * @param storedState - Value returned by the adapter
	 * @returns void
	 */
	function applyStoredState(instance: Instance, storedState: State | null | undefined): void {
		if (storedState !== null && storedState !== undefined) {
			assertValidState(storedState, "The storage adapter's read()");

			instance.state = storedState;
			instance.initialized = true;
		}

		instance.hydrated = true;
	}

	/**
	 * Starts (or joins) the adapter read for an instance that has not been hydrated yet.
	 * Returns null when no work is needed so callers can stay on the synchronous path.
	 *
	 * @param instance - Instance that needs adapter state
	 * @returns Promise for the in-flight read, or null when already hydrated
	 */
	function ensureHydrated(instance: Instance): Promise<void> | null {
		if (instance.hydrated || adapter === undefined) {
			return null;
		}

		instance.pendingHydration ??= (async (): Promise<void> => {
			try {
				applyStoredState(instance, await adapter.read());

				if (isDebugEnabled) {
					console.log(`${logPrefix} Hydrated:`, instance.state);
				}
			} finally {
				instance.pendingHydration = null;
			}
		})();

		return instance.pendingHydration;
	}

	/**
	 * Runs a task once every previously queued mutation on the instance has settled.
	 * When the queue is idle the task starts immediately, which keeps synchronous
	 * mutations synchronous.
	 *
	 * @param instance - Instance whose mutation queue to join
	 * @param task - Async task to run exclusively
	 * @returns Promise resolving to the task's result
	 */
	function runExclusive<R>(instance: Instance, task: () => Promise<R>): Promise<R> {
		const pendingMutation = instance.pendingMutation;
		const result = pendingMutation === null ? task() : pendingMutation.then(task);
		const settled: Promise<void> = result.then(releaseLock, releaseLock);

		/**
		 * Marks the queue as idle if no other mutation was queued behind this one.
		 *
		 * @returns void
		 */
		function releaseLock(): void {
			if (instance.pendingMutation === settled) {
				instance.pendingMutation = null;
			}
		}

		instance.pendingMutation = settled;

		return result;
	}

	/**
	 * Passes a proposed state through the middleware chain in order.
	 * Rejects null/undefined results, which almost always mean a middleware forgot to return.
	 *
	 * @param operationType - Operation that produced the proposed state
	 * @param previousState - Committed state before the operation
	 * @param proposedState - State produced by the operation
	 * @returns Promise resolving to the state after all middleware ran
	 */
	async function runMiddleware(operationType: OperationType, previousState: State, proposedState: State): Promise<State> {
		let currentState = proposedState;
		let middlewareIndex = 0;

		for (const middlewareFunction of middlewareChain) {
			const result = middlewareFunction({ type: operationType, previousState, nextState: currentState });
			// Typed as unknown because a misbehaving middleware can return anything at runtime
			const resolvedState: unknown = isPromiseLike(result) ? await result : result;

			assertValidState(
				resolvedState,
				`Middleware at index ${middlewareIndex}`,
				` Return operation.nextState or a new state object (operation: "${operationType}").`,
			);

			currentState = resolvedState;
			middlewareIndex++;
		}

		return currentState;
	}

	/**
	 * Core mutation pipeline, run while holding the instance's mutation lock:
	 * hydrate → produce → no-op check → middleware → adapter write → commit.
	 *
	 * The adapter is written before the in-memory commit so a failed write leaves the
	 * store unchanged instead of diverging from storage.
	 *
	 * @param instance - Instance to mutate
	 * @param operationType - Operation being performed
	 * @param produceNextState - Computes the proposed state from the committed state
	 * @returns Promise resolving to the committed transition, or null for a no-op
	 */
	async function applyTransition(
		instance: Instance,
		operationType: OperationType,
		produceNextState: (previousState: State) => State | Promise<State>,
	): Promise<StateTransition<State> | null> {
		const hydration = ensureHydrated(instance);

		if (hydration !== null) {
			await hydration;
		}

		const previousState = instance.state;
		const produced = produceNextState(previousState);
		const proposedState: unknown = isPromiseLike(produced) ? await produced : produced;

		assertValidState(proposedState, `${operationType}()`);

		// Initialize and reset are explicit lifecycle events and always commit
		const skipsUnchangedState = operationType !== "initialize" && operationType !== "reset";

		if (skipsUnchangedState && proposedState === previousState) {
			return null;
		}

		const nextState = middlewareChain.length === 0 ? proposedState : await runMiddleware(operationType, previousState, proposedState);

		// Middleware returning previousState vetoes the transition
		if (skipsUnchangedState && nextState === previousState) {
			return null;
		}

		if (adapter !== undefined) {
			const pendingWrite = adapter.write(nextState);

			if (isPromiseLike(pendingWrite)) {
				await pendingWrite;
			}
		}

		instance.state = nextState;

		if (operationType === "initialize") {
			instance.initialized = true;
		}

		if (isDebugEnabled) {
			console.log(`${logPrefix} ${OPERATION_LOG_LABELS[operationType]}:`, nextState);
		}

		return { previousState, nextState };
	}

	/**
	 * Invokes the lifecycle callback that matches a committed operation.
	 *
	 * @param operationType - Operation that was committed
	 * @param transition - Committed state change
	 * @returns The callback's result, so async callbacks can be awaited
	 */
	function notifyLifecycle(operationType: OperationType, transition: StateTransition<State>): void | Promise<void> {
		switch (operationType) {
			case "initialize":
				return configuration.onInitialize?.(transition.nextState);
			case "reset":
				return configuration.onReset?.(transition.previousState, transition.nextState);
			default:
				return configuration.onUpdate?.(transition.previousState, transition.nextState);
		}
	}

	/**
	 * Queues a mutation and runs its lifecycle callback after the lock is released, so
	 * callbacks may safely call mutating methods of this same store.
	 *
	 * @param operationType - Operation being performed
	 * @param produceNextState - Computes the proposed state from the committed state
	 * @returns Promise that resolves once the mutation and its callback complete
	 */
	async function mutate(operationType: OperationType, produceNextState: (previousState: State) => State | Promise<State>): Promise<void> {
		const instance = getInstance();

		verifyRequestScope(instance);

		const transition = await runExclusive(instance, () => applyTransition(instance, operationType, produceNextState));

		if (transition !== null) {
			await notifyLifecycle(operationType, transition);
		}
	}

	/**
	 * Reports a derive failure without throwing from a synchronous read. Failures inside
	 * the user's onError callback are logged rather than surfacing as unhandled rejections.
	 *
	 * @param error - Error thrown by the derive function
	 * @param baseState - State the derive function was called with
	 * @returns void
	 */
	function reportDeriveError(error: Error, baseState: State): void {
		if (isDebugEnabled) {
			console.warn(`${logPrefix} Error in derive function:`, error.message);
		}

		if (!configuration.onError) {
			return;
		}

		try {
			const result = configuration.onError(error, { method: "derive", state: baseState });

			if (isPromiseLike(result)) {
				void result.then(undefined, reportCallbackFailure);
			}
		} catch (callbackError: unknown) {
			reportCallbackFailure(callbackError);
		}
	}

	/**
	 * Logs a failure raised by the onError callback itself.
	 *
	 * @param callbackError - Value thrown or rejected by onError
	 * @returns void
	 */
	function reportCallbackFailure(callbackError: unknown): void {
		console.error(`${logPrefix} onError callback failed:`, callbackError);
	}

	/**
	 * Returns base state merged with derived state, recomputing only when the base state
	 * reference changed. The merged object is cached on the instance, so repeated reads
	 * return the same reference without allocating. A failing derive is also cached, which
	 * reports each failing state once instead of on every read.
	 *
	 * @param instance - Instance to read from
	 * @returns Combined base and derived state
	 */
	function resolveFullState(instance: Instance): FullState {
		const baseState = instance.state;

		if (deriveFunction === undefined) {
			return baseState as FullState;
		}

		if (instance.derivedSourceState !== baseState || instance.derivedBy !== deriveFunction) {
			let derivedState: D | undefined;

			try {
				derivedState = deriveFunction(baseState);
				instance.deriveError = null;
			} catch (thrownValue: unknown) {
				instance.deriveError = toError(thrownValue);
				reportDeriveError(instance.deriveError, baseState);
			}

			instance.fullState = derivedState === undefined ? (baseState as FullState) : { ...baseState, ...derivedState };
			instance.derivedSourceState = baseState;
			instance.derivedBy = deriveFunction;
		}

		// Fail closed: derived values that gate access must not silently read as undefined
		if (instance.deriveError !== null && shouldThrowOnDeriveError) {
			throw instance.deriveError;
		}

		return instance.fullState;
	}

	/**
	 * Emits debug warnings for reads that will not see the expected state.
	 *
	 * @param instance - Instance being read
	 * @returns void
	 */
	function warnOnUnpreparedRead(instance: Instance): void {
		if (!instance.hydrated) {
			console.warn(`${logPrefix} Reading before hydrate(); returning initial state. Await store.hydrate() before the first read.`);
		} else if (!isPersistent && !instance.initialized) {
			console.warn(`${logPrefix} Reading uninitialized store`);
		}
	}

	/**
	 * Initializes the store with starting values. Runs middleware and triggers onInitialize.
	 *
	 * @param initialState - Starting state values
	 * @returns Promise that resolves when initialization is complete
	 */
	function initialize(initialState: State): Promise<void> {
		return mutate("initialize", () => initialState);
	}

	/**
	 * Loads adapter state if needed and returns the full state.
	 *
	 * @param options - Hydration options; `force` re-reads the adapter after pending mutations
	 * @returns Promise resolving to the combined base and derived state
	 */
	async function hydrate(options?: HydrateOptions): Promise<FullState> {
		const instance = getInstance();

		if (adapter !== undefined && options?.force === true) {
			await runExclusive(instance, async () => {
				applyStoredState(instance, await adapter.read());
			});
		} else {
			const hydration = ensureHydrated(instance);

			if (hydration !== null) {
				await hydration;
			}
		}

		return resolveFullState(instance);
	}

	/**
	 * Reads current state including derived properties. Synchronous and allocation-free
	 * while the state is unchanged.
	 *
	 * @returns Combined base and derived state
	 */
	function read(): FullState {
		const instance = getInstance();

		if (isDebugEnabled) {
			warnOnUnpreparedRead(instance);
		}

		return resolveFullState(instance);
	}

	/**
	 * Updates state by applying a reducer function to the committed state.
	 *
	 * @param updaterFunction - Function that transforms previous state to new state
	 * @returns Promise that resolves when update is complete
	 */
	function update(updaterFunction: (previousState: State) => State): Promise<void> {
		return mutate("update", updaterFunction);
	}

	/**
	 * Replaces entire state with a new state object.
	 *
	 * @param newState - Complete new state object
	 * @returns Promise that resolves when set is complete
	 */
	function set(newState: State): Promise<void> {
		return mutate("set", () => newState);
	}

	/**
	 * Shallow-merges a partial state into the committed state.
	 *
	 * @param partialState - Partial state object to merge with current state
	 * @returns Promise that resolves when patch is complete
	 */
	function patch(partialState: Partial<State>): Promise<void> {
		return mutate("patch", (previousState) => mergePartialState(previousState, partialState));
	}

	/**
	 * Selects a value from the full state.
	 *
	 * @param selectorFunction - Function that extracts desired value from state
	 * @returns Selected value extracted from state
	 */
	function select<R>(selectorFunction: (state: FullState) => R): R {
		return selectorFunction(read());
	}

	/**
	 * Resets state back to the configured initial values.
	 *
	 * @returns Promise that resolves when reset is complete
	 */
	function reset(): Promise<void> {
		return mutate("reset", getInitialState);
	}

	/**
	 * Runs a batch callback against a private draft and returns the final draft.
	 * The API is disabled once the callback settles so a leaked reference cannot
	 * modify a draft that was already committed or discarded.
	 *
	 * @param initialDraft - Committed state the draft starts from
	 * @param callback - User callback receiving the batch API
	 * @returns Promise resolving to the final draft state
	 */
	async function collectBatchChanges(initialDraft: State, callback: (api: BatchApi<State>) => void | Promise<void>): Promise<State> {
		let draftState = initialDraft;
		let isOpen = true;

		/**
		 * Guards batch API calls made after the batch callback settled.
		 *
		 * @returns void
		 */
		function assertBatchOpen(): void {
			if (!isOpen) {
				throw new Error(`${logPrefix} Batch API used after the batch callback settled.`);
			}
		}

		const batchApi: BatchApi<State> = {
			read(): State {
				assertBatchOpen();

				return draftState;
			},
			update(updaterFunction: (previousState: State) => State): void {
				assertBatchOpen();
				draftState = updaterFunction(draftState);
			},
			set(newState: State): void {
				assertBatchOpen();
				draftState = newState;
			},
			patch(partialState: Partial<State>): void {
				assertBatchOpen();
				draftState = mergePartialState(draftState, partialState);
			},
		};

		try {
			const result = callback(batchApi);

			if (isPromiseLike(result)) {
				await result;
			}
		} finally {
			isOpen = false;
		}

		return draftState;
	}

	/**
	 * Applies several changes as one atomic transition.
	 *
	 * @param callback - Function that receives a batch API with read, update, set, and patch methods
	 * @returns Promise that resolves when the batch is committed
	 */
	function batch(callback: (api: BatchApi<State>) => void | Promise<void>): Promise<void> {
		return mutate("batch", (previousState) => collectBatchChanges(previousState, callback));
	}

	return {
		initialize,
		hydrate,
		read,
		update,
		set,
		patch,
		select,
		reset,
		batch,
	};
}
