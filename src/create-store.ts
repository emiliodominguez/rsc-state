import { cache } from "react";

import type { ServerStore, StoreConfig } from "./types";

/**
 * Creates a request-scoped server store for managing state in React Server Components.
 *
 * The store uses React's cache API to ensure state is isolated per request and
 * automatically invalidated between requests. This prevents state leakage between
 * different users or concurrent requests.
 *
 * State can be read from any Server Component in the tree without prop drilling.
 * Updates are performed via Server Actions and trigger revalidation.
 *
 * @param configuration - Store configuration with initial state and optional derived state
 * @returns Store instance with methods to initialize, read, and update state
 *
 * @example
 * Basic usage with authentication state
 * ```typescript
 * const userStore = createServerStore({
 *   initial: {
 *     userId: null as string | null,
 *     userName: '',
 *     userRole: 'guest' as 'admin' | 'user' | 'guest'
 *   },
 *   derive: (state) => ({
 *     isAuthenticated: state.userId !== null,
 *     isAdministrator: state.userRole === 'admin'
 *   })
 * });
 * ```
 *
 * @example
 * Using factory function for initial state
 * ```typescript
 * const sessionStore = createServerStore({
 *   initial: () => ({
 *     sessionId: generateId(),
 *     createdAt: Date.now()
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

	/**
	 * Internal cache instance structure that holds the current state
	 * and tracks whether the store has been initialized for this request.
	 */
	interface CacheInstance {
		state: State;
		initialized: boolean;
	}

	/**
	 * React cache instance that stores state for the current request.
	 * Cache is automatically invalidated between requests, ensuring isolation.
	 */
	const getCacheInstance = cache((): CacheInstance => {
		const initialState = typeof configuration.initial === "function" ? (configuration.initial as () => T)() : configuration.initial;

		return {
			state: initialState,
			initialized: false,
		};
	});

	/**
	 * Computes derived state by applying the derive function to base state.
	 * Returns base state unchanged if no derive function is configured.
	 *
	 * @param baseState - Current base state from store
	 * @returns Combined base state and derived state
	 */
	function computeDerivedState(baseState: State): FullState {
		if (!configuration.derive) {
			return baseState as FullState;
		}

		const derivedState = configuration.derive(baseState) as DerivedState;

		return { ...baseState, ...derivedState } as FullState;
	}

	/**
	 * Initializes the store with starting values for the current request.
	 * Should be called once per request, typically in root layout after authentication.
	 *
	 * @param initialState - Starting state values for this request
	 * @returns void
	 */
	function initialize(initialState: State): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = initialState;
		cacheInstance.initialized = true;

		if (configuration.debug) {
			console.log("[rsc-state] Initialized:", initialState);
		}
	}

	/**
	 * Reads current state including derived properties.
	 * Can be called from any Server Component in the tree.
	 * Logs warning in debug mode if reading before initialization.
	 *
	 * @returns Combined base and derived state
	 */
	function read(): FullState {
		const cacheInstance = getCacheInstance();

		if (!cacheInstance.initialized && configuration.debug) {
			console.warn("[rsc-state] Reading uninitialized store");
		}

		return computeDerivedState(cacheInstance.state);
	}

	/**
	 * Updates state by applying a reducer function to previous state.
	 * The reducer receives current state and must return a new state object.
	 *
	 * @param updaterFunction - Function that transforms previous state to new state
	 * @returns void
	 */
	function update(updaterFunction: (previousState: State) => State): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = updaterFunction(cacheInstance.state);

		if (configuration.debug) {
			console.log("[rsc-state] Updated:", cacheInstance.state);
		}
	}

	/**
	 * Replaces entire state with a new state object.
	 * Use when setting multiple properties at once is more convenient than using update.
	 *
	 * @param newState - Complete new state object
	 * @returns void
	 */
	function set(newState: State): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = newState;

		if (configuration.debug) {
			console.log("[rsc-state] Set:", newState);
		}
	}

	/**
	 * Selects and returns a specific value from state using a selector function.
	 * Useful for reading single properties without destructuring entire state object.
	 *
	 * @param selectorFunction - Function that extracts desired value from state
	 * @returns Selected value extracted from state
	 */
	function select<R>(selectorFunction: (state: FullState) => R): R {
		return selectorFunction(read());
	}

	/**
	 * Resets state back to initial values defined in configuration.
	 * If initial was a factory function, the function is called again to generate new initial state.
	 *
	 * @returns void
	 */
	function reset(): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = typeof configuration.initial === "function" ? (configuration.initial as () => T)() : configuration.initial;

		if (configuration.debug) {
			console.log("[rsc-state] Reset");
		}
	}

	return {
		initialize,
		read,
		update,
		set,
		select,
		reset,
	};
}
