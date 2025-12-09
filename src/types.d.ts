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
 * Configuration object for creating a server store.
 * Defines the initial state structure and optional derived state computation.
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
	 *
	 * @param error - The error that was thrown
	 * @param context - Context information including method name and current state
	 *
	 * @example
	 * ```typescript
	 * onError: (error, context) => {
	 *   console.error(`Store error in ${context.method}:`, error);
	 *   reportToErrorService(error);
	 * }
	 * ```
	 */
	onError?: (error: Error, context: ErrorContext<T>) => void;

	/**
	 * Callback invoked after the store is initialized with state.
	 * Useful for logging, analytics, or side effects on initialization.
	 *
	 * @param state - The initial state that was set
	 *
	 * @example
	 * ```typescript
	 * onInitialize: (state) => {
	 *   console.log('Store initialized with:', state);
	 * }
	 * ```
	 */
	onInitialize?: (state: T) => void;

	/**
	 * Callback invoked after state is updated via update() or set().
	 * Receives both the previous and new state for comparison.
	 *
	 * @param previousState - State before the update
	 * @param nextState - State after the update
	 *
	 * @example
	 * ```typescript
	 * onUpdate: (previous, next) => {
	 *   console.log('State changed from', previous, 'to', next);
	 * }
	 * ```
	 */
	onUpdate?: (previousState: T, nextState: T) => void;

	/**
	 * Callback invoked after the store is reset to initial state.
	 * Useful for cleanup or logging reset events.
	 *
	 * @example
	 * ```typescript
	 * onReset: () => {
	 *   console.log('Store was reset to initial state');
	 * }
	 * ```
	 */
	onReset?: () => void;
}

/**
 * API object provided to the batch callback function.
 * Contains methods for updating state without triggering derived state computation.
 */
export interface BatchApi<T> {
	/**
	 * Updates state by applying a reducer function.
	 * Derived state is not computed until the batch completes.
	 *
	 * @param updaterFunction - Function that transforms previous state to new state
	 */
	update(updaterFunction: (previousState: T) => T): void;

	/**
	 * Replaces the entire state with a new state object.
	 * Derived state is not computed until the batch completes.
	 *
	 * @param newState - Complete new state object
	 */
	set(newState: T): void;
}

/**
 * Server store instance that manages request-scoped state.
 * Provides methods to initialize, read, update, and reset state.
 */
export interface ServerStore<T extends Record<string, unknown>, D extends Record<string, unknown> = Record<string, never>> {
	/**
	 * Initializes the store with starting values for the current request.
	 * Should be called once per request, typically in root layout.
	 *
	 * @param initialState - Starting state values for this request
	 * @returns void
	 */
	initialize(initialState: T): void;

	/**
	 * Reads the current state including derived properties.
	 * Can be called from any Server Component in the tree.
	 *
	 * @returns Combined base and derived state
	 */
	read(): T & D;

	/**
	 * Updates state by applying a reducer function to previous state.
	 * The reducer must return a new state object.
	 *
	 * @param updaterFunction - Function that transforms previous state to new state
	 * @returns void
	 */
	update(updaterFunction: (previousState: T) => T): void;

	/**
	 * Replaces the entire state with a new state object.
	 * Use when you need to set multiple properties at once.
	 *
	 * @param newState - Complete new state object
	 * @returns void
	 */
	set(newState: T): void;

	/**
	 * Selects and returns a specific value from state using a selector function.
	 * Useful for reading single properties without destructuring entire state.
	 *
	 * @param selectorFunction - Function that extracts desired value from state
	 * @returns Selected value from state
	 */
	select<R>(selectorFunction: (state: T & D) => R): R;

	/**
	 * Resets state back to initial values defined in configuration.
	 * If initial was a factory function, it will be called again.
	 *
	 * @returns void
	 */
	reset(): void;

	/**
	 * Executes multiple state updates in a batch, computing derived state only once
	 * after all updates complete. Improves performance when making multiple updates.
	 *
	 * @param callback - Function that receives a batch API with update and set methods
	 * @returns void
	 *
	 * @example
	 * ```typescript
	 * store.batch((api) => {
	 *   api.update((state) => ({ ...state, count: state.count + 1 }));
	 *   api.update((state) => ({ ...state, name: 'updated' }));
	 * }); // Derived state computed once after both updates
	 * ```
	 */
	batch(callback: (api: BatchApi<T>) => void): void;
}
