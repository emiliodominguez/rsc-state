import { cache } from "react";

import type { ServerStore, StorageMode, StoreConfig } from "./types";

/**
 * Creates a server store for managing state in React Server Components.
 *
 * Supports two storage modes:
 * - `"request"` (default): State isolated per request using React's cache API.
 *   Safe for user-specific data. Prevents state leakage between users.
 * - `"persistent"`: State persists across requests using module-level storage.
 *   Shared across ALL users. Only use for global app state.
 *
 * State can be read from any Server Component in the tree without prop drilling.
 *
 * @param configuration - Store configuration with initial state and optional derived state
 * @returns Store instance with methods to initialize, read, and update state
 *
 * @example
 * Request-scoped store (safe for user data)
 * ```typescript
 * const userStore = createServerStore({
 *   initial: { userId: null, userName: '' },
 *   derive: (state) => ({
 *     isAuthenticated: state.userId !== null
 *   })
 * });
 * ```
 *
 * @example
 * Persistent store (global app state only)
 * ```typescript
 * const settingsStore = createServerStore({
 *   storage: "persistent",
 *   initial: { theme: "light" },
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

	const storageMode: StorageMode = configuration.storage?.toLowerCase() === "persistent" ? "persistent" : "request";

	/**
	 * Internal cache instance structure that holds the current state
	 * and tracks whether the store has been initialized.
	 */
	interface CacheInstance {
		state: State;
		initialized: boolean;
	}

	/**
	 * Module-level storage for persistent mode.
	 * WARNING: Shared across all users and requests.
	 */
	let persistentInstance: CacheInstance | null = null;

	/**
	 * Gets the initial state from configuration.
	 *
	 * @returns Initial state value
	 */
	function getInitialState(): State {
		return typeof configuration.initial === "function" ? (configuration.initial as () => T)() : configuration.initial;
	}

	/**
	 * React cache instance for request-scoped mode.
	 * Cache is automatically invalidated between requests, ensuring isolation.
	 */
	const getRequestScopedInstance = cache((): CacheInstance => {
		return {
			state: getInitialState(),
			initialized: false,
		};
	});

	/**
	 * Gets the persistent instance, creating it if needed.
	 *
	 * @returns Persistent cache instance
	 */
	function getPersistentInstance(): CacheInstance {
		persistentInstance ??= {
			state: getInitialState(),
			initialized: false,
		};

		return persistentInstance;
	}

	/**
	 * Gets the appropriate cache instance based on storage mode.
	 *
	 * @returns Cache instance for current storage mode
	 */
	function getCacheInstance(): CacheInstance {
		return storageMode === "persistent" ? getPersistentInstance() : getRequestScopedInstance();
	}

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
	 * Initializes the store with starting values.
	 * For request-scoped: called once per request in root layout.
	 * For persistent: called once on first access or to reset values.
	 *
	 * @param initialState - Starting state values
	 * @returns void
	 */
	function initialize(initialState: State): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = initialState;
		cacheInstance.initialized = true;

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Initialized:`, initialState);
		}
	}

	/**
	 * Reads current state including derived properties.
	 * Can be called from any Server Component in the tree.
	 *
	 * @returns Combined base and derived state
	 */
	function read(): FullState {
		const cacheInstance = getCacheInstance();

		if (!cacheInstance.initialized && configuration.debug) {
			console.warn(`[rsc-state:${storageMode}] Reading uninitialized store`);
		}

		return computeDerivedState(cacheInstance.state);
	}

	/**
	 * Updates state by applying a reducer function to previous state.
	 *
	 * @param updaterFunction - Function that transforms previous state to new state
	 * @returns void
	 */
	function update(updaterFunction: (previousState: State) => State): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = updaterFunction(cacheInstance.state);

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Updated:`, cacheInstance.state);
		}
	}

	/**
	 * Replaces entire state with a new state object.
	 *
	 * @param newState - Complete new state object
	 * @returns void
	 */
	function set(newState: State): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = newState;

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Set:`, newState);
		}
	}

	/**
	 * Selects and returns a specific value from state using a selector function.
	 *
	 * @param selectorFunction - Function that extracts desired value from state
	 * @returns Selected value extracted from state
	 */
	function select<R>(selectorFunction: (state: FullState) => R): R {
		return selectorFunction(read());
	}

	/**
	 * Resets state back to initial values defined in configuration.
	 *
	 * @returns void
	 */
	function reset(): void {
		const cacheInstance = getCacheInstance();

		cacheInstance.state = getInitialState();

		if (configuration.debug) {
			console.log(`[rsc-state:${storageMode}] Reset`);
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
