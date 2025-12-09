import { vi } from "vitest";

/**
 * Mock implementation of React's cache function for testing.
 * In the actual React Server Components environment, cache provides
 * request-scoped memoization. For tests, we simulate this behavior
 * with a simple memoization that persists within each test.
 */
vi.mock("react", () => ({
	cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => {
		let cachedResult: ReturnType<T> | undefined;
		let hasCached = false;

		return ((...args: Parameters<T>): ReturnType<T> => {
			if (!hasCached) {
				cachedResult = fn(...args) as ReturnType<T>;
				hasCached = true;
			}
			return cachedResult as ReturnType<T>;
		}) as T;
	},
}));
