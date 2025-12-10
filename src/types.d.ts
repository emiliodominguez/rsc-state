/**
 * Storage mode for the server store.
 *
 * - `"request"` (default): State is isolated per request using React's cache API.
 *   Safe for user-specific data. State resets on each new request.
 *
 * - `"persistent"`: State persists across requests using module-level storage.
 *   WARNING: State is shared across ALL users. Only use for global app state
 *   (e.g., feature flags, app config). Not suitable for user-specific data.
 *   State is lost on server restart and not synced across server instances.
 */
export type StorageMode = "request" | "persistent";

/**
 * Type of state operation being performed.
 * Used by middleware to identify which operation triggered the middleware.
 */
export type OperationType = "initialize" | "update" | "set" | "patch" | "reset" | "batch";

/**
 * Context information provided to the onError callback when an error occurs.
 */
export interface ErrorContext<T> {
	/**
	 * The name of the store method where the error occurred.
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
	 * State after the operation (can be modified by middleware).
	 */
	nextState: T;
}

/**
 * Middleware function that intercepts state operations.
 * Can inspect and transform state before it's applied to the store.
 * Supports both synchronous and asynchronous implementations.
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
 * const validationMiddleware: Middleware<MyState> = async (operation) => {
 *   await validateState(operation.nextState);
 *   return operation.nextState;
 * };
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
	 * Returns null if no state exists in storage.
	 *
	 * @returns The stored state or null if not found
	 */
	read(): Promise<T | null> | T | null;

	/**
	 * Writes state to storage.
	 *
	 * @param state - The state to persist
	 */
	write(state: T): Promise<void> | void;
}

/**
 * Configuration object for creating a server store.
 * Defines the initial state structure, optional derived state computation,
 * middleware, storage adapter, and lifecycle callbacks.
 */
export interface StoreConfig<T extends Record<string, unknown>> {
	/**
	 * Storage mode for the store. Defaults to "request".
	 *
	 * - `"request"`: State isolated per request (safe for user data)
	 * - `"persistent"`: State shared across requests (global app state only)
	 */
	storage?: StorageMode;

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
	 * Derived state is memoized and only recalculated when base state changes.
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
	derive?: (state: T) => Record<string, unknown>;

	/**
	 * Callback invoked when an error occurs in the derive function.
	 * Allows graceful error handling without crashing the store.
	 * Supports async callbacks for external error reporting.
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
	 * Callback invoked after state is updated via update(), set(), or patch().
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
	 * @example
	 * ```typescript
	 * onReset: async () => {
	 *   console.log('Store was reset to initial state');
	 *   await clearCache();
	 * }
	 * ```
	 */
	onReset?: () => void | Promise<void>;
}

/**
 * API object provided to the batch callback function.
 * Contains methods for updating state without triggering middleware or callbacks
 * until the batch completes. All operations within a batch are synchronous.
 *
 * @example
 * ```typescript
 * await userStore.batch((api) => {
 *   api.update((state) => ({ ...state, userName: "John" }));
 *   api.patch({ email: "john@example.com" });
 *   api.set({ userId: "123", userName: "John", email: "john@example.com" });
 * });
 * ```
 */
export interface BatchApi<T> {
	/**
	 * Updates state by applying a reducer function.
	 * Derived state is not computed until the batch completes.
	 *
	 * @param updaterFunction - Function that transforms previous state to new state
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
	 * Replaces the entire state with a new state object.
	 * Derived state is not computed until the batch completes.
	 *
	 * @param newState - Complete new state object
	 *
	 * @example
	 * ```typescript
	 * await userStore.batch((api) => {
	 *   api.update((state) => ({ ...state, itemCount: state.itemCount + 1 }));
	 *   api.set({ items: [], itemCount: 0, total: 0 }); // Clear cart
	 * });
	 * ```
	 */
	set(newState: T): void;

	/**
	 * Partially updates state by merging with existing state.
	 * Only the provided properties are updated, others remain unchanged.
	 * Derived state is not computed until the batch completes.
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
 * storage adapters, and lifecycle callbacks.
 */
export interface ServerStore<T extends Record<string, unknown>, D extends Record<string, unknown> = Record<string, never>> {
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
	 * Reads the current state including derived properties.
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
	read(): T & D;

	/**
	 * Updates state by applying a reducer function to previous state.
	 * The reducer must return a new state object.
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
	 * Partially updates state by merging with existing state.
	 * Only the provided properties are updated, others remain unchanged.
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
	 *
	 * // Compute a value from state
	 * const displayName = userStore.select((state) => state.userName || "Anonymous");
	 * ```
	 */
	select<R>(selectorFunction: (state: T & D) => R): R;

	/**
	 * Resets state back to initial values defined in configuration.
	 * If initial was a factory function, it will be called again.
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
	reset(): Promise<void>;

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
	batch(callback: (api: BatchApi<T>) => void): Promise<void>;
}
