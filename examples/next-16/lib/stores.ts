import { cache } from "react";
import { cookies } from "next/headers";

import { createServerStore } from "rsc-state";

const USER_COOKIE = "user_session";

/**
 * Feature flags store - PERSISTENT storage mode.
 *
 * WARNING: Persistent storage is shared across ALL users and requests.
 * Only use for truly global state like feature flags or app config.
 * NOT suitable for user-specific data.
 *
 * This example demonstrates:
 * - Lifecycle hooks (onInitialize, onUpdate, onReset)
 * - Derived state with potential errors (onError)
 */
export const featureFlagsStore = createServerStore({
	storage: "persistent",
	initial: {
		betaFeatures: false,
		maintenanceMode: false,
	},
	derive: (state) => ({
		statusMessage: state.maintenanceMode ? "System is under maintenance" : state.betaFeatures ? "Beta features enabled" : "Production mode",
	}),
	onUpdate: (previousState, nextState) => {
		// These logs appear in the SERVER TERMINAL (where npm run dev is running)
		if (previousState.betaFeatures !== nextState.betaFeatures) {
			console.log("[FeatureFlags] onUpdate - Beta features:", previousState.betaFeatures, "->", nextState.betaFeatures);
		}

		if (previousState.maintenanceMode !== nextState.maintenanceMode) {
			console.log("[FeatureFlags] onUpdate - Maintenance mode:", previousState.maintenanceMode, "->", nextState.maintenanceMode);
		}
	},
	onReset: () => {
		// This log appears in the SERVER TERMINAL
		console.log("[FeatureFlags] onReset - Store reset to initial state");
	},
});

/**
 * Error demo store - demonstrates onError callback.
 * This store intentionally throws an error in derive() when simulateError is true.
 * The onError callback catches it gracefully without crashing the app.
 */
export const errorDemoStore = createServerStore({
	storage: "persistent",
	initial: {
		simulateError: false,
	},
	derive: (state) => {
		if (state.simulateError) {
			throw new Error("Simulated error in derive function");
		}

		return { status: "OK" };
	},
	onError: (error, context) => {
		// This log appears in the SERVER TERMINAL
		console.error(`[ErrorDemo] onError - Caught error in ${context.method}:`, error.message);
	},
});

/**
 * User store - REQUEST storage mode (default).
 * State is isolated per request. Safe for user-specific data.
 *
 * This example demonstrates:
 * - Derived state with memoization (only recalculates when base state changes)
 * - Error boundary for derive function (onError callback)
 * - onInitialize lifecycle hook
 *
 * Note: onUpdate is less useful for request-scoped stores since each request
 * gets a fresh instance. For persistent changes, use cookies/database.
 */
export const userStore = createServerStore({
	storage: "request",
	initial: {
		userId: null as string | null,
		userName: "",
		userEmail: "",
		theme: "light" as "light" | "dark",
		preferences: {
			notifications: true,
			newsletter: false,
		},
	},
	derive: (state) => ({
		isAuthenticated: state.userId !== null,
		displayName: state.userName || "Guest",
		isDarkMode: state.theme === "dark",
		emailDomain: state.userEmail ? state.userEmail.split("@")[1] : null,
	}),
	onError: (error, context) => {
		// Log errors from derive function without crashing the store
		console.error(`[UserStore] Error in ${context.method}:`, error.message);
	},
	onInitialize: (state) => {
		console.log("[UserStore] Initialized for user:", state.userId ?? "anonymous");
	},
});

/**
 * Cached function to get user data from cookie and initialize store.
 * Uses React's cache() to ensure this only runs once per request.
 * Call this in any Server Component that needs user data.
 */
export const getUser = cache(async () => {
	const cookieStore = await cookies();
	const userCookie = cookieStore.get(USER_COOKIE);

	if (userCookie) {
		try {
			const userData = JSON.parse(userCookie.value);

			await userStore.initialize(userData);
		} catch {
			// Invalid cookie
		}
	}

	return userStore.read();
});
