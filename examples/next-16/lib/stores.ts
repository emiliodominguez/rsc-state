import { createServerStore } from "rsc-state";

/**
 * Settings store - PERSISTENT storage mode.
 *
 * Theme is shared across all users (like a global app setting).
 * Persists across requests without cookies/database.
 *
 * Use persistent storage for:
 * - Feature flags
 * - App-wide configuration
 * - Demo/prototype state
 */
export const settingsStore = createServerStore({
	debug: true,
	storage: "persistent",
	initial: {
		theme: "light" as "light" | "dark",
	},
	derive: (state) => ({
		isDarkMode: state.theme === "dark",
	}),
});

/**
 * User store - REQUEST storage mode (default).
 *
 * State is isolated per request using React's cache API.
 * Must be initialized each request (typically from cookies/session).
 *
 * Use request storage for:
 * - User-specific data (authentication, preferences)
 * - Data that differs between users
 * - Security-sensitive information
 */
export const userStore = createServerStore({
	debug: true,
	storage: "request",
	initial: {
		userId: null as string | null,
		userName: "",
		userEmail: "",
	},
	derive: (state) => ({
		isAuthenticated: state.userId !== null,
		displayName: state.userName || "Guest",
	}),
});
