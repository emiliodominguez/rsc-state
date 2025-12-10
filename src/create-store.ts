import { cache } from "react";

import type { BatchApi, OperationType, ServerStore, StorageMode, StoreConfig } from "./types";

/**
 * Creates a server store for managing state in React Server Components.
 *
 * Supports two storage modes:
 * - `"request"` (default): State isolated per request using React's cache API.
 *   Safe for user-specific data. Prevents state leakage between users.
 * - `"persistent"`: State persists across requests using module-level storage.
 *   Shared across ALL users. Only use for global app state.
 *
 * All state-mutating methods are async to support middleware, storage adapters,
 * and async lifecycle callbacks.
 *
 * @param configuration - Store configuration with initial state, middleware, adapter, and callbacks
 * @returns Store instance with async methods to initialize, read, and update state
 *
 * @example
 * Request-scoped store (safe for user data)
 * ```typescript
 * const userStore = createServerStore({
 *   initial: { userId: null, userName: '' },
 *   derive: (state) => ({
 *     isAuthenticated: state.userId !== null
 *   }),
 *   middleware: [
 *     (operation) => {
 *       console.log(`[${operation.type}]`, operation.nextState);
 *       return operation.nextState;
 *     }
 *   ]
 * });
 *
 * // In layout
 * await userStore.initialize({ userId: "123", userName: "John" });
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
 * ```
 */
export function createServerStore<T extends Record<string, unknown>, D extends Record<string, unknown> = Record<string, never>>(
	configuration: StoreConfig<T>,
): ServerStore<T, D> {
	type State = T;
	type DerivedState = D;
	type FullState = State & DerivedState;

	const storageMode: StorageMode = configuration.storage ?? "request";

	/**
	 * Internal cache instance structure that holds the current state,
	 * tracks initialization, and caches derived state for memoization.
	 */
	interface CacheInstance {
		state: State;
		initialized: boolean;
		lastDerivedBaseState: State | null;
		cachedDerivedState: DerivedState | null;
	}

	/**
	 * Module-level storage for persistent mode.
	 * WARNING: Shared across all users and requests.
	 */
	let persistentInstance: CacheInstance | null = null;

	/**
	 * Tracks whether the persistent instance has been initialized from the adapter.
	 * Prevents multiple adapter reads on concurrent access.
	 */
	let persistentInstanceInitializing: Promise<CacheInstance> | null = null;

	/**
	 * Gets the initial state from configuration.
	 *
	 * @returns Initial state value
	 */
	function getInitialState(): State {
		return typeof configuration.initial === "function" ? configuration.initial() : configuration.initial;
	}

	/**
	 * React cache instance for request-scoped mode.
	 * Cache is automatically invalidated between requests, ensuring isolation.
	 *
	 * @returns Cache instance for current request
	 */
	const getRequestScopedInstance = cache((): CacheInstance => {
		return {
			state: getInitialState(),
			initialized: false,
			lastDerivedBaseState: null,
			cachedDerivedState: null,
		};
	});

	/**
	 * Gets the persistent instance, creating it if needed.
	 * Reads initial state from adapter if configured.
	 *
	 * @returns Promise resolving to persistent cache instance
	 */
	async function getPersistentInstance(): Promise<CacheInstance> {
		if (persistentInstance) {
			return persistentInstance;
		}

		// If already initializing, wait for that to complete
		if (persistentInstanceInitializing) {
			return persistentInstanceInitializing;
		}

		// Start initialization
		persistentInstanceInitializing = (async (): Promise<CacheInstance> => {
			let adapterState: State | null = null;

			if (configuration.adapter) {
				adapterState = await configuration.adapter.read();
			}

			persistentInstance = {
				state: adapterState ?? getInitialState(),
				initialized: adapterState !== null,
				lastDerivedBaseState: null,
				cachedDerivedState: null,
			};

			return persistentInstance;
		})();

		return persistentInstanceInitializing;
	}

	/**
	 * Gets the persistent instance synchronously.
	 * Used by read() and select() which must remain synchronous.
	 * Falls back to initial state if adapter hasn't been read yet.
	 *
	 * @returns Persistent cache instance
	 */
	function getPersistentInstanceSync(): CacheInstance {
		persistentInstance ??= {
			state: getInitialState(),
			initialized: false,
			lastDerivedBaseState: null,
			cachedDerivedState: null,
		};

		return persistentInstance;
	}

	/**
	 * Gets the appropriate cache instance based on storage mode.
	 * For async operations that need adapter support.
	 *
	 * @returns Promise resolving to cache instance for current storage mode
	 */
	async function getCacheInstanceAsync(): Promise<CacheInstance> {
		return storageMode === "persistent" ? getPersistentInstance() : getRequestScopedInstance();
	}

	/**
	 * Gets the appropriate cache instance synchronously.
	 * Used by read() and select() which must remain synchronous.
	 *
	 * @returns Cache instance for current storage mode
	 */
	function getCacheInstanceSync(): CacheInstance {
		return storageMode === "persistent" ? getPersistentInstanceSync() : getRequestScopedInstance();
	}

	/**
	 * Writes state to the storage adapter if configured and in persistent mode.
	 *
	 * @param state - State to persist
	 * @returns Promise that resolves when write is complete
	 */
	async function writeToAdapter(state: State): Promise<void> {
		if (storageMode === "persistent" && configuration.adapter) {
			await configuration.adapter.write(state);
		}
	}

	/**
	 * Applies middleware chain to a state operation.
	 * Each middleware can transform the state before it's applied.
	 *
	 * @param operationType - Type of operation being performed
	 * @param previousState - State before the operation
	 * @param nextState - State after the operation (before middleware)
	 * @returns Promise resolving to final state after middleware transformations
	 */
	async function applyMiddleware(operationType: OperationType, previousState: State, nextState: State): Promise<State> {
		if (!configuration.middleware?.length) {
			return nextState;
		}

		let finalState = nextState;

		for (const middlewareFunction of configuration.middleware) {
			finalState = await middlewareFunction({
				type: operationType,
				previousState,
				nextState: finalState,
			});
		}

		return finalState;
	}

	/**
	 * Computes derived state by applying the derive function to base state.
	 * Uses memoization to avoid recalculating when base state hasn't changed.
	 * Handles errors gracefully by calling onError callback if configured.
	 *
	 * @param baseState - Current base state from store
	 * @param cacheInstance - Cache instance for memoization storage
	 * @returns Combined base state and derived state
	 */
	function computeDerivedState(baseState: State, cacheInstance: CacheInstance): FullState {
		if (!configuration.derive) {
			return baseState as FullState;
		}

		// Return cached derived state if base state hasn't changed (reference equality)
		if (baseState === cacheInstance.lastDerivedBaseState && cacheInstance.cachedDerivedState !== null) {
			return { ...baseState, ...cacheInstance.cachedDerivedState } as FullState;
		}

		try {
			const derivedState = configuration.derive(baseState) as DerivedState;

			// Cache the computed derived state
			cacheInstance.lastDerivedBaseState = baseState;
			cacheInstance.cachedDerivedState = derivedState;

			return { ...baseState, ...derivedState } as FullState;
		} catch (thrownError: unknown) {
			const errorInstance = thrownError instanceof Error ? thrownError : new Error(String(thrownError));

			// Fire-and-forget for async onError - we can't await in this sync function
			void configuration.onError?.(errorInstance, { method: "derive", state: baseState });

			if (configuration.debug) {
				console.warn(`[rsc-state:${storageMode}] Error in derive function:`, errorInstance.message);
			}

			// Return base state without derived properties on error
			return baseState as FullState;
		}
	}

	/**
	 * Invalidates the memoization cache, forcing derived state to be recalculated
	 * on the next read. Called when base state changes.
	 *
	 * @param cacheInstance - Cache instance to invalidate
	 */
	function invalidateDerivedCache(cacheInstance: CacheInstance): void {
		cacheInstance.lastDerivedBaseState = null;
		cacheInstance.cachedDerivedState = null;
	}

	/**
	 * Initializes the store with starting values.
	 * For request-scoped: called once per request in root layout.
	 * For persistent: called once on first access or to reset values.
	 * Runs middleware and triggers onInitialize callback.
	 *
	 * @param initialState - Starting state values
	 * @returns Promise that resolves when initialization is complete
	 *
	 * @example
	 * ```typescript
	 * // In your root layout or page
	 * async function RootLayout({ children }) {
	 *   const user = await fetchCurrentUser();
	 *   await userStore.initialize({ userId: user.id, userName: user.name });
	 *   return <>{children}</>;
	 * }
	 * ```
	 */
	async function initialize(initialState: State): Promise<void> {
		const cacheInstance = await getCacheInstanceAsync();
		const previousState = cacheInstance.state;

		const finalState = await applyMiddleware("initialize", previousState, initialState);

		cacheInstance.state = finalState;
		cacheInstance.initialized = true;
		invalidateDerivedCache(cacheInstance);

		await writeToAdapter(finalState);

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Initialized:`, finalState);
		}

		await configuration.onInitialize?.(finalState);
	}

	/**
	 * Reads current state including derived properties.
	 * Can be called from any Server Component in the tree.
	 * This is a synchronous operation that returns cached state.
	 *
	 * @returns Combined base and derived state
	 *
	 * @example
	 * ```typescript
	 * // In any Server Component
	 * function UserProfile() {
	 *   const { userName, isAuthenticated } = userStore.read();
	 *   return isAuthenticated ? <p>Welcome, {userName}!</p> : <p>Please log in</p>;
	 * }
	 * ```
	 */
	function read(): FullState {
		const cacheInstance = getCacheInstanceSync();

		if (!cacheInstance.initialized && configuration.debug) {
			console.warn(`[rsc-state:${storageMode}] Reading uninitialized store`);
		}

		return computeDerivedState(cacheInstance.state, cacheInstance);
	}

	/**
	 * Updates state by applying a reducer function to previous state.
	 * Runs middleware and triggers onUpdate callback.
	 *
	 * @param updaterFunction - Function that transforms previous state to new state
	 * @returns Promise that resolves when update is complete
	 *
	 * @example
	 * ```typescript
	 * // Update a single property
	 * await userStore.update((state) => ({ ...state, userName: "New Name" }));
	 *
	 * // Increment a counter
	 * await counterStore.update((state) => ({ ...state, count: state.count + 1 }));
	 * ```
	 */
	async function update(updaterFunction: (previousState: State) => State): Promise<void> {
		const cacheInstance = await getCacheInstanceAsync();
		const previousState = cacheInstance.state;
		const updatedState = updaterFunction(previousState);

		const finalState = await applyMiddleware("update", previousState, updatedState);

		cacheInstance.state = finalState;
		invalidateDerivedCache(cacheInstance);

		await writeToAdapter(finalState);

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Updated:`, finalState);
		}

		await configuration.onUpdate?.(previousState, finalState);
	}

	/**
	 * Replaces entire state with a new state object.
	 * Runs middleware and triggers onUpdate callback.
	 *
	 * @param newState - Complete new state object
	 * @returns Promise that resolves when set is complete
	 *
	 * @example
	 * ```typescript
	 * // Replace entire state
	 * await userStore.set({ userId: "123", userName: "John Doe" });
	 *
	 * // Clear user data on logout
	 * await userStore.set({ userId: null, userName: "" });
	 * ```
	 */
	async function set(newState: State): Promise<void> {
		const cacheInstance = await getCacheInstanceAsync();
		const previousState = cacheInstance.state;

		const finalState = await applyMiddleware("set", previousState, newState);

		cacheInstance.state = finalState;
		invalidateDerivedCache(cacheInstance);

		await writeToAdapter(finalState);

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Set:`, finalState);
		}

		await configuration.onUpdate?.(previousState, finalState);
	}

	/**
	 * Partially updates state by merging with existing state.
	 * Runs middleware and triggers onUpdate callback.
	 *
	 * @param partialState - Partial state object to merge with current state
	 * @returns Promise that resolves when patch is complete
	 *
	 * @example
	 * ```typescript
	 * // Update only userName, keep other properties
	 * await userStore.patch({ userName: "New Name" });
	 *
	 * // Update multiple properties at once
	 * await userStore.patch({ userName: "John", email: "john@example.com" });
	 * ```
	 */
	async function patch(partialState: Partial<State>): Promise<void> {
		const cacheInstance = await getCacheInstanceAsync();
		const previousState = cacheInstance.state;
		const patchedState = { ...previousState, ...partialState };

		const finalState = await applyMiddleware("patch", previousState, patchedState);

		cacheInstance.state = finalState;
		invalidateDerivedCache(cacheInstance);

		await writeToAdapter(finalState);

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Patched:`, finalState);
		}

		await configuration.onUpdate?.(previousState, finalState);
	}

	/**
	 * Selects and returns a specific value from state using a selector function.
	 * This is a synchronous operation.
	 *
	 * @param selectorFunction - Function that extracts desired value from state
	 * @returns Selected value extracted from state
	 *
	 * @example
	 * ```typescript
	 * // Select a single property
	 * const userName = userStore.select((state) => state.userName);
	 *
	 * // Select derived state
	 * const isLoggedIn = userStore.select((state) => state.isAuthenticated);
	 *
	 * // Compute a value from state
	 * const displayName = userStore.select((state) => state.userName || "Anonymous");
	 * ```
	 */
	function select<R>(selectorFunction: (state: FullState) => R): R {
		return selectorFunction(read());
	}

	/**
	 * Resets state back to initial values defined in configuration.
	 * Runs middleware and triggers onReset callback.
	 *
	 * @returns Promise that resolves when reset is complete
	 *
	 * @example
	 * ```typescript
	 * // Reset store to initial state
	 * await userStore.reset();
	 *
	 * // Useful for logout flows
	 * async function handleLogout() {
	 *   await signOut();
	 *   await userStore.reset();
	 * }
	 * ```
	 */
	async function reset(): Promise<void> {
		const cacheInstance = await getCacheInstanceAsync();
		const previousState = cacheInstance.state;
		const initialState = getInitialState();

		const finalState = await applyMiddleware("reset", previousState, initialState);

		cacheInstance.state = finalState;
		invalidateDerivedCache(cacheInstance);

		await writeToAdapter(finalState);

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Reset`);
		}

		await configuration.onReset?.();
	}

	/**
	 * Executes multiple state updates in a batch, computing derived state only once
	 * after all updates complete. Middleware is applied once after the batch.
	 * Improves performance when making multiple updates.
	 *
	 * @param callback - Function that receives a batch API with update, set, and patch methods
	 * @returns Promise that resolves when batch is complete
	 *
	 * @example
	 * ```typescript
	 * // Multiple updates in a single batch
	 * await userStore.batch((api) => {
	 *   api.update((state) => ({ ...state, userName: "John" }));
	 *   api.patch({ email: "john@example.com" });
	 *   api.update((state) => ({ ...state, lastLogin: new Date() }));
	 * });
	 *
	 * // Mix update and set within a batch
	 * await cartStore.batch((api) => {
	 *   api.update((state) => ({ ...state, itemCount: state.itemCount + 1 }));
	 *   api.set({ items: [], itemCount: 0, total: 0 }); // Clear cart
	 * });
	 * ```
	 */
	async function batch(callback: (api: BatchApi<State>) => void): Promise<void> {
		const cacheInstance = await getCacheInstanceAsync();
		const initialState = cacheInstance.state;

		const batchApi: BatchApi<State> = {
			update: (updaterFunction: (previousState: State) => State): void => {
				cacheInstance.state = updaterFunction(cacheInstance.state);
			},
			set: (newState: State): void => {
				cacheInstance.state = newState;
			},
			patch: (partialState: Partial<State>): void => {
				cacheInstance.state = { ...cacheInstance.state, ...partialState };
			},
		};

		callback(batchApi);

		// Apply middleware once after batch completes
		const finalState = await applyMiddleware("batch", initialState, cacheInstance.state);

		cacheInstance.state = finalState;
		invalidateDerivedCache(cacheInstance);

		await writeToAdapter(finalState);

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Batch updated:`, finalState);
		}

		await configuration.onUpdate?.(initialState, finalState);
	}

	return {
		initialize,
		read,
		update,
		set,
		patch,
		select,
		reset,
		batch,
	};
}
