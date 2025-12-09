/**
 * Type declaration for React's cache function.
 *
 * React's cache API provides request-scoped memoization for Server Components.
 * It caches the return value of a function based on its arguments, using shallow
 * equality (Object.is) to compare arguments.
 *
 * This is a stable React API (not experimental).
 *
 * Key behaviors:
 * - Cache is invalidated automatically for each server request
 * - Each call to cache() creates a new function with its own cache
 * - Errors thrown by the cached function are also cached
 * - Only works inside React Server Components
 *
 * @see https://react.dev/reference/react/cache - Official React documentation
 * @see https://react.dev/reference/rsc/server-components - Server Components reference
 */
declare module "react" {
	/**
	 * Creates a memoized version of a function for use in React Server Components.
	 *
	 * When the memoized function is called:
	 * 1. Checks if a cached result exists for the given arguments (using Object.is)
	 * 2. If cached (cache hit), returns the cached result immediately
	 * 3. If not cached (cache miss), calls the original function, caches the result, and returns it
	 *
	 * Important: Define cached functions in a dedicated module and import them where needed.
	 * Each call to cache() creates a separate cache instance.
	 *
	 * @param fn - The function to cache. Can take any arguments and return any value.
	 * @returns A cached version of the function with the same type signature.
	 *
	 * @example
	 * ```typescript
	 * // utils/data.ts - Define in a separate module for cache sharing
	 * import { cache } from 'react';
	 *
	 * export const getUser = cache(async (id: string) => {
	 *   const response = await fetch(`/api/users/${id}`);
	 *   return response.json();
	 * });
	 *
	 * // Components can import and use the same cached function
	 * // Second call with same ID returns cached result
	 * ```
	 *
	 * @see https://react.dev/reference/react/cache
	 */
	export function cache<CachedFunction extends (...args: never[]) => unknown>(fn: CachedFunction): CachedFunction;
}
