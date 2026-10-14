/**
 * Simulated React request scope for tests. The React `cache` mock keys its memoized
 * results by the current request object, so swapping it emulates a new server request.
 */
const requestScope: { currentRequest: object | null } = { currentRequest: {} };

/**
 * Returns the object identifying the current simulated request.
 *
 * @returns Current request key, or null outside a request scope
 */
export function getCurrentRequest(): object | null {
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

/**
 * Leaves the simulated request scope, emulating code that runs outside a Server Component
 * render (route handlers, Server Actions). React's cache stops memoizing until
 * `simulateNewRequest()` is called.
 *
 * @returns void
 */
export function simulateMissingRequestScope(): void {
	requestScope.currentRequest = null;
}
