/**
 * Storage mode for the server store.
 *
 * - `"request"` (default): State is isolated per request using React's cache API.
 *   Safe for user-specific data. State resets on each new request.
 *
 * - `"persistent"`: State persists across requests using module-level storage.
 *   WARNING: State is shared across ALL users. Only use for global app state
 *   (e.g., feature flags, app config). Not suitable for user-specific data.
 *   State is lost on server restart and not synced across server instances
 *   unless a storage adapter is configured.
 */
export type StorageMode = "request" | "persistent";

/**
 * Type of state operation being performed.
 * Used by middleware to identify which operation triggered the middleware.
 */
export type OperationType = "initialize" | "update" | "set" | "patch" | "reset" | "batch";

/**
 * Derived state shape used when a store has no `derive` function.
 * Intersecting with it leaves the base state type untouched.
 */
// An empty object type is the point: it is the identity element for `T & D`
// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type
export type EmptyDerivedState = Record<never, never>;

/**
 * Full state exposed by `read()`, `select()` and `hydrate()`: the base state merged with
 * derived state. Resolves to the plain base state type when the store has no `derive`,
 * which keeps editor tooltips readable.
 */
export type StoreState<T extends object, D extends object = EmptyDerivedState> = [keyof D] extends [never] ? T : T & D;

/**
 * Context information provided to the onError callback when an error occurs.
 */
export interface ErrorContext<T> {
	/**
	 * The name of the store operation where the error occurred.
	 * Currently always `"derive"`, since mutation errors are propagated to the caller instead.
	 */
	method: string;

	/**
	 * The current base state at the time of the error.
	 */
	state: T;
}

/**
 * Operation context passed to middleware functions.
 * Contains information about the state transition being performed.
 */
export interface MiddlewareOperation<T> {
	/**
	 * Type of state operation being performed.
	 */
	type: OperationType;

	/**
	 * State before the operation.
	 */
	previousState: T;

	/**
	 * State after the operation, including transformations from earlier middleware in the chain.
	 */
	nextState: T;
}

/**
 * Middleware function that intercepts state-mutating operations.
 * Can inspect, transform or veto state before it is committed to the store.
 * Returning `operation.previousState` from an `update`, `set`, `patch` or `batch`
 * operation cancels the transition: nothing is written and `onUpdate` is not called.
 *
 * Middleware runs while the store holds its mutation lock, so it must not await
 * mutating methods of the same store (that would wait on itself forever).
 *
 * @param operation - The operation being performed with state snapshots
 * @returns The final state to apply (can be modified from nextState)
 *
 * @example
 * ```typescript
 * const loggingMiddleware: Middleware<MyState> = (operation) => {
 *   console.log(`[${operation.type}]`, operation.previousState, "→", operation.nextState);
 *   return operation.nextState;
 * };
 *
 * const clampMiddleware: Middleware<{ volume: number }> = (operation) => ({
 *   ...operation.nextState,
 *   volume: Math.min(100, Math.max(0, operation.nextState.volume)),
 * });
 * ```
 */
export type Middleware<T> = (operation: MiddlewareOperation<T>) => T | Promise<T>;

/**
 * Storage adapter interface for custom persistence backends.
 * Only used with "persistent" storage mode.
 * Supports both synchronous and asynchronous operations for flexibility
 * with different storage backends (memory, Redis, database, etc.).
 *
 * @example
 * ```typescript
 * const redisAdapter: StorageAdapter<MyState> = {
 *   read: async () => {
 *     const data = await redis.get("store:key");
 *     return data ? JSON.parse(data) : null;
 *   },
 *   write: async (state) => {
 *     await redis.set("store:key", JSON.stringify(state));
 *   },
 * };
 * ```
 */
export interface StorageAdapter<T> {
	/**
	 * Reads state from storage.
	 * Returns null (or undefined) if no state exists in storage.
	 *
	 * @returns The stored state or null if not found
	 */
	read(): Promise<T | null | undefined> | T | null | undefined;

	/**
	 * Writes state to storage. The store only commits the new state in memory after
	 * this resolves, so a failed write never leaves memory and storage out of sync.
	 *
	 * @param state - The state to persist
	 */
	write(state: T): Promise<void> | void;
}

/**
 * Options accepted by `hydrate()`.
 */
export interface HydrateOptions {
	/**
	 * Re-read the adapter even if the store was already hydrated.
	 * Useful in multi-instance deployments where another server may have written
	 * newer state to the shared backend. Waits for in-flight mutations first.
	 */
	force?: boolean;
}

/**
 * Configuration object for creating a server store.
 * Defines the initial state structure, optional derived state computation,
 * middleware, storage adapter, and lifecycle callbacks.
 */
export interface StoreConfig<T extends object, D extends object = EmptyDerivedState> {
	/**
	 * Storage mode for the store. Defaults to "request".
	 *
	 * - `"request"`: State isolated per request (safe for user data)
	 * - `"persistent"`: State shared across requests (global app state only)
	 */
	storage?: StorageMode;

	/**
	 * Unique key for a persistent store. When set, the store's state lives in a process-wide
	 * registry on `globalThis` instead of module scope, so it survives dev hot reloads and is
	 * shared when a bundler loads the store module more than once (e.g. Next.js page and
	 * route handler bundles). Every store created with the same key shares one state.
	 * Ignored in "request" mode.
	 *
	 * @example
	 * ```typescript
	 * export const flagsStore = createServerStore({
	 *   storage: "persistent",
	 *   key: "feature-flags",
	 *   initial: { betaFeatures: false },
	 * });
	 * ```
	 */
	key?: string;

	/**
	 * Enable debug logging to console for development.
	 * Logs initialization, updates, and state changes.
	 */
	debug?: boolean;

	/**
	 * Array of middleware functions to intercept state operations.
	 * Middleware is executed in order for each state-mutating operation.
	 * Each middleware can transform the state before it's applied.
	 *
	 * @example
	 * ```typescript
	 * middleware: [
	 *   (operation) => {
	 *     console.log(`[${operation.type}]`, operation.nextState);
	 *     return operation.nextState;
	 *   },
	 *   async (operation) => {
	 *     await validateState(operation.nextState);
	 *     return operation.nextState;
	 *   },
	 * ]
	 * ```
	 */
	middleware?: Middleware<T>[];

	/**
	 * Storage adapter for persistent mode.
	 * Allows using custom storage backends like Redis, databases, or file systems.
	 * Only applicable when storage mode is "persistent".
	 *
	 * @example
	 * ```typescript
	 * adapter: {
	 *   read: async () => await redis.get("store:key"),
	 *   write: async (state) => await redis.set("store:key", state),
	 * }
	 * ```
	 */
	adapter?: StorageAdapter<T>;

	/**
	 * Initial state value or factory function that returns initial state.
	 * Use factory function when initial state depends on runtime values.
	 */
	initial: T | (() => T);

	/**
	 * Optional function to compute derived state from base state.
	 * Derived state is memoized per base state reference, so it only runs again
	 * after the base state changes. Its return type is inferred and merged into
	 * the type returned by `read()` and `select()`.
	 *
	 * @param state - Current base state
	 * @returns Object containing derived state properties
	 *
	 * @example
	 * ```typescript
	 * derive: (state) => ({
	 *   isAuthenticated: state.userId !== null,
	 *   displayName: state.name || 'Anonymous'
	 * })
	 * ```
	 */
	derive?: (state: T) => D;

	/**
	 * Throw from `read()`, `select()` and `hydrate()` when `derive` fails, instead of returning
	 * the base state without derived properties. Enable it when derived values gate access
	 * (permissions, entitlements, `isAdmin`-style flags): a failing derive then fails closed
	 * instead of the flag silently reading as `undefined`. The error is still reported to
	 * `onError`, once per failing state.
	 *
	 * @defaultValue false
	 */
	throwOnDeriveError?: boolean;

	/**
	 * Callback invoked when an error occurs in the derive function.
	 * Allows graceful error handling without crashing the store.
	 * Called once per failing base state, not on every read.
	 * Async callbacks are not awaited because reads are synchronous; rejections are logged.
	 *
	 * @param error - The error that was thrown
	 * @param context - Context information including method name and current state
	 *
	 * @example
	 * ```typescript
	 * onError: async (error, context) => {
	 *   console.error(`Store error in ${context.method}:`, error);
	 *   await reportToErrorService(error);
	 * }
	 * ```
	 */
	onError?: (error: Error, context: ErrorContext<T>) => void | Promise<void>;

	/**
	 * Callback invoked after the store is initialized with state.
	 * Useful for logging, analytics, or side effects on initialization.
	 * Supports async callbacks for external service calls.
	 *
	 * @param state - The initial state that was set
	 *
	 * @example
	 * ```typescript
	 * onInitialize: async (state) => {
	 *   console.log('Store initialized with:', state);
	 *   await analytics.track('store_initialized', state);
	 * }
	 * ```
	 */
	onInitialize?: (state: T) => void | Promise<void>;

	/**
	 * Callback invoked after state is changed via update(), set(), patch() or batch().
	 * Not invoked for no-op transitions (same state reference before and after).
	 * Receives both the previous and new state for comparison.
	 * Supports async callbacks for external service calls.
	 *
	 * @param previousState - State before the update
	 * @param nextState - State after the update
	 *
	 * @example
	 * ```typescript
	 * onUpdate: async (previous, next) => {
	 *   console.log('State changed from', previous, 'to', next);
	 *   await syncToDatabase(next);
	 * }
	 * ```
	 */
	onUpdate?: (previousState: T, nextState: T) => void | Promise<void>;

	/**
	 * Callback invoked after the store is reset to initial state.
	 * Useful for cleanup or logging reset events.
	 * Supports async callbacks for external service calls.
	 *
	 * @param previousState - State before the reset
	 * @param nextState - State after the reset (initial state after middleware)
	 *
	 * @example
	 * ```typescript
	 * onReset: async () => {
	 *   console.log('Store was reset to initial state');
	 *   await clearCache();
	 * }
	 * ```
	 */
	onReset?: (previousState: T, nextState: T) => void | Promise<void>;
}

/**
 * API object provided to the batch callback function.
 * Changes are applied to a private draft and committed atomically once the callback
 * settles: middleware, the adapter write and `onUpdate` run exactly once. If the
 * callback throws or rejects, the draft is discarded and the store is left untouched.
 *
 * @example
 * ```typescript
 * await userStore.batch((api) => {
 *   api.update((state) => ({ ...state, userName: "John" }));
 *   api.patch({ email: "john@example.com" });
 * });
 * ```
 */
export interface BatchApi<T> {
	/**
	 * Returns the current draft state, including changes made earlier in this batch.
	 * Use this instead of `store.read()`, which only sees committed state.
	 *
	 * @returns The draft state
	 *
	 * @example
	 * ```typescript
	 * await cartStore.batch(async (api) => {
	 *   const price = await fetchPrice(api.read().productId);
	 *   api.patch({ price });
	 * });
	 * ```
	 */
	read(): T;

	/**
	 * Updates the draft by applying a reducer function.
	 *
	 * @param updaterFunction - Function that transforms previous draft state to new draft state
	 *
	 * @example
	 * ```typescript
	 * await userStore.batch((api) => {
	 *   api.update((state) => ({ ...state, userName: "John" }));
	 *   api.update((state) => ({ ...state, email: "john@example.com" }));
	 * });
	 * ```
	 */
	update(updaterFunction: (previousState: T) => T): void;

	/**
	 * Replaces the entire draft with a new state object.
	 *
	 * @param newState - Complete new state object
	 *
	 * @example
	 * ```typescript
	 * await cartStore.batch((api) => {
	 *   api.update((state) => ({ ...state, itemCount: state.itemCount + 1 }));
	 *   api.set({ items: [], itemCount: 0, total: 0 }); // Clear cart
	 * });
	 * ```
	 */
	set(newState: T): void;

	/**
	 * Shallow-merges the provided properties into the draft.
	 *
	 * @param partialState - Partial state object to merge
	 *
	 * @example
	 * ```typescript
	 * await userStore.batch((api) => {
	 *   api.patch({ userName: "John" });
	 *   api.patch({ email: "john@example.com" });
	 * });
	 * ```
	 */
	patch(partialState: Partial<T>): void;
}

/**
 * Server store instance that manages request-scoped or persistent state.
 * Provides async methods to initialize, read, update, and reset state.
 *
 * All state-mutating methods return promises to support async middleware,
 * storage adapters, and lifecycle callbacks. Mutations on the same store instance
 * are serialized, so concurrent calls never overwrite each other's changes.
 */
export interface ServerStore<T extends object, D extends object = EmptyDerivedState> {
	/**
	 * Initializes the store with starting values for the current request.
	 * Should be called once per request, typically in root layout.
	 * Runs middleware and triggers onInitialize callback.
	 *
	 * @param initialState - Starting state values for this request
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
	initialize(initialState: T): Promise<void>;

	/**
	 * Loads persisted state from the storage adapter, if one is configured, and returns
	 * the full state. Concurrent calls share a single adapter read. Mutating methods
	 * hydrate implicitly; call this before the first `read()` of an adapter-backed
	 * persistent store so the read does not fall back to the initial state.
	 * Without an adapter it resolves immediately with the current state.
	 *
	 * @param options - Hydration options (e.g. `force` to re-read the adapter)
	 * @returns Promise resolving to the combined base and derived state
	 *
	 * @example
	 * ```typescript
	 * export default async function SettingsPage() {
	 *   const settings = await settingsStore.hydrate();
	 *   return <p>Theme: {settings.theme}</p>;
	 * }
	 * ```
	 */
	hydrate(options?: HydrateOptions): Promise<StoreState<T, D>>;

	/**
	 * Reads the current state including derived properties.
	 * Can be called from any Server Component in the tree.
	 * Returns the same object reference until the state changes, so it is
	 * safe to call repeatedly without allocating.
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
	read(): StoreState<T, D>;

	/**
	 * Updates state by applying a reducer function to previous state.
	 * The reducer must return a new state object; returning the same reference is a no-op.
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
	update(updaterFunction: (previousState: T) => T): Promise<void>;

	/**
	 * Replaces the entire state with a new state object.
	 * Use when you need to set multiple properties at once.
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
	set(newState: T): Promise<void>;

	/**
	 * Partially updates state by shallow-merging with existing state.
	 * If every provided value is identical (`Object.is`) to the current one, the call
	 * is a no-op: no middleware, no adapter write, no onUpdate.
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
	patch(partialState: Partial<T>): Promise<void>;

	/**
	 * Selects and returns a specific value from state using a selector function.
	 * Useful for reading single properties without destructuring entire state.
	 * This is a synchronous operation.
	 *
	 * @param selectorFunction - Function that extracts desired value from state
	 * @returns Selected value from state
	 *
	 * @example
	 * ```typescript
	 * // Select a single property
	 * const userName = userStore.select((state) => state.userName);
	 *
	 * // Select derived state
	 * const isLoggedIn = userStore.select((state) => state.isAuthenticated);
	 * ```
	 */
	select<R>(selectorFunction: (state: StoreState<T, D>) => R): R;

	/**
	 * Resets state back to initial values defined in configuration.
	 * If initial was a factory function, it will be called again.
	 * Runs middleware and triggers onReset callback.
	 *
	 * @returns Promise that resolves when reset is complete
	 *
	 * @example
	 * ```typescript
	 * async function handleLogout() {
	 *   await signOut();
	 *   await userStore.reset();
	 * }
	 * ```
	 */
	reset(): Promise<void>;

	/**
	 * Applies several changes as a single atomic transition. The callback receives a
	 * draft API and may be async; middleware, the adapter write and `onUpdate` run once
	 * after it settles. If the callback throws, nothing is committed.
	 *
	 * @param callback - Function that receives a batch API with read, update, set, and patch methods
	 * @returns Promise that resolves when the batch is committed
	 *
	 * @example
	 * ```typescript
	 * await userStore.batch((api) => {
	 *   api.update((state) => ({ ...state, userName: "John" }));
	 *   api.patch({ email: "john@example.com" });
	 * });
	 *
	 * // Async transaction: rolled back if the fetch fails
	 * await cartStore.batch(async (api) => {
	 *   const prices = await fetchPrices(api.read().items);
	 *   api.patch({ prices });
	 * });
	 * ```
	 */
	batch(callback: (api: BatchApi<T>) => void | Promise<void>): Promise<void>;
}

/**
 * Extracts the full state type (base and derived) exposed by a store's `read()`.
 *
 * @example
 * ```typescript
 * type UserState = InferStoreState<typeof userStore>;
 * ```
 */
export type InferStoreState<S> = S extends ServerStore<infer T, infer D> ? StoreState<T, D> : never;
