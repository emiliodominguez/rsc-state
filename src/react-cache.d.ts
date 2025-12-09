/**
 * Type declaration for React's cache function.
 * React's cache API is used for request-scoped memoization in Server Components.
 * This declaration provides proper TypeScript support since the official types
 * may not fully support this experimental API.
 */
declare module "react" {
	/**
	 * Creates a cached version of a function that memoizes the result per request.
	 * In Server Components, cache is invalidated between requests automatically.
	 *
	 * @param fn - The function to cache
	 * @returns A cached version of the function with the same signature
	 */
	export function cache<CachedFunction extends (...args: never[]) => unknown>(fn: CachedFunction): CachedFunction;
}
