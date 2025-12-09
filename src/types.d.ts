/**
 * Configuration object for creating a server store.
 * Defines the initial state structure and optional derived state computation.
 */
export interface StoreConfig<T extends Record<string, unknown>> {
	/**
	 * Initial state value or factory function that returns initial state.
	 * Use factory function when initial state depends on runtime values.
	 */
	initial: T | (() => T);

	/**
	 * Optional function to compute derived state from base state.
	 * Derived state is recalculated whenever base state is read.
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
	 * Enable debug logging to console for development.
	 * Logs initialization, updates, and state changes.
	 */
	debug?: boolean;
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
}
