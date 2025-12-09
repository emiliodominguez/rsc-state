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
 */
export const featureFlagsStore = createServerStore({
	storage: "persistent",
	initial: {
		betaFeatures: false,
	},
});

/**
 * User store - REQUEST storage mode (default).
 * State is isolated per request. Safe for user-specific data.
 */
export const userStore = createServerStore({
	storage: "request",
	initial: {
		userId: null as string | null,
		userName: "",
		userEmail: "",
		theme: "light" as "light" | "dark",
	},
	derive: (state) => ({
		isAuthenticated: state.userId !== null,
		displayName: state.userName || "Guest",
		isDarkMode: state.theme === "dark",
	}),
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
			userStore.initialize(userData);
		} catch {
			// Invalid cookie
		}
	}

	return userStore.read();
});
