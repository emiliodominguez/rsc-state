/**
 * Simulated React request scope for tests. The React `cache` mock keys its memoized
 * results by the current request object, so swapping it emulates a new server request.
 */
const requestScope = { currentRequest: {} as object };

/**
 * Returns the object identifying the current simulated request.
 *
 * @returns Current request key
 */
export function getCurrentRequest(): object {
	return requestScope.currentRequest;
}

/**
 * Starts a new simulated server request. Request-scoped stores receive a fresh
 * instance on their next access, while persistent stores are unaffected.
 *
 * @returns void
 */
export function simulateNewRequest(): void {
	requestScope.currentRequest = {};
}
