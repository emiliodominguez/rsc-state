import { createServerStore } from "rsc-state";

/**
 * User authentication store for managing user session state.
 * Demonstrates basic store usage with derived state computation.
 */
export const userStore = createServerStore({
	initial: {
		userId: null as string | null,
		userName: "",
		userEmail: "",
		userRole: "guest" as "admin" | "user" | "guest",
	},
	derive: (state) => ({
		isAuthenticated: state.userId !== null,
		isAdministrator: state.userRole === "admin",
		displayName: state.userName || "Guest",
	}),
	debug: process.env.NODE_ENV === "development",
});

/**
 * Application settings store for managing user preferences.
 * Shows how multiple stores can coexist independently.
 */
export const settingsStore = createServerStore({
	initial: {
		themeName: "light" as "light" | "dark" | "system",
		languageCode: "en",
		notificationsEnabled: true,
	},
	derive: (state) => ({
		isDarkMode: state.themeName === "dark",
	}),
});
