import { vi } from "vitest";

/**
 * Mock implementation of React's cache function for testing.
 * In a real React Server Components environment, cache memoizes per request.
 * Here results are memoized per simulated request (see `simulateNewRequest`),
 * which lets tests verify isolation between requests.
 */
vi.mock("react", async () => {
	const { getCurrentRequest } = await import("./request-scope");

	return {
		cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => {
			const resultsByRequest = new WeakMap<object, ReturnType<T>>();

			return ((...args: Parameters<T>): ReturnType<T> => {
				const currentRequest = getCurrentRequest();

				if (!resultsByRequest.has(currentRequest)) {
					resultsByRequest.set(currentRequest, fn(...args) as ReturnType<T>);
				}

				return resultsByRequest.get(currentRequest) as ReturnType<T>;
			}) as T;
		},
	};
});
