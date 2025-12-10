"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { featureFlagsStore, errorDemoStore } from "./stores";

const USER_COOKIE = "user_session";

/**
 * Authenticate user by creating a session cookie with user data from form submission.
 * Generates a unique user ID and stores user preferences in an HTTP-only cookie.
 *
 * @param formData - Form data containing userName and userEmail fields
 */
export async function login(formData: FormData): Promise<void> {
	const userData = {
		userId: `user-${Date.now()}`,
		userName: formData.get("userName") as string,
		userEmail: formData.get("userEmail") as string,
		theme: "light",
		preferences: {
			notifications: true,
			newsletter: false,
		},
	};

	const cookieStore = await cookies();

	cookieStore.set(USER_COOKIE, JSON.stringify(userData), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 7,
		path: "/",
	});

	revalidatePath("/", "layout");
}

/**
 * End user session by deleting the session cookie.
 * After logout, the user store will return default (unauthenticated) state.
 */
export async function logout(): Promise<void> {
	const cookieStore = await cookies();

	cookieStore.delete(USER_COOKIE);
	revalidatePath("/", "layout");
}

/**
 * Toggle theme by updating the cookie directly.
 * Note: For request-scoped stores, state changes must be persisted externally
 * (e.g., cookies, database) since each request gets a fresh store instance.
 */
export async function toggleTheme(): Promise<void> {
	const cookieStore = await cookies();
	const userCookie = cookieStore.get(USER_COOKIE);

	if (userCookie) {
		try {
			const userData = JSON.parse(userCookie.value);
			const newTheme = userData.theme === "light" ? "dark" : "light";

			cookieStore.set(USER_COOKIE, JSON.stringify({ ...userData, theme: newTheme }), {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 60 * 60 * 24 * 7,
				path: "/",
			});
		} catch {
			// Invalid cookie
		}
	}

	revalidatePath("/", "layout");
}

/**
 * Toggle beta features using update() method.
 * This triggers the onUpdate lifecycle hook.
 */
export async function toggleBetaFeatures(): Promise<void> {
	await featureFlagsStore.update((state) => ({
		...state,
		betaFeatures: !state.betaFeatures,
	}));

	revalidatePath("/", "layout");
}

/**
 * Toggle maintenance mode using update() method.
 * This triggers the onUpdate lifecycle hook.
 */
export async function toggleMaintenanceMode(): Promise<void> {
	await featureFlagsStore.update((state) => ({
		...state,
		maintenanceMode: !state.maintenanceMode,
	}));

	revalidatePath("/", "layout");
}

/**
 * Enable all feature flags using batch() method.
 * Multiple state changes are batched together, computing derived state only once.
 * Without batch(), each update would trigger separate derived state recalculation.
 * This triggers onUpdate once (not twice) with the final state.
 */
export async function enableAllFlags(): Promise<void> {
	await featureFlagsStore.batch((api) => {
		api.update((state) => ({ ...state, betaFeatures: true }));
		api.update((state) => ({ ...state, maintenanceMode: true }));
	});

	revalidatePath("/", "layout");
}

/**
 * Reset feature flags to their initial state.
 * This triggers the onReset lifecycle hook.
 */
export async function resetFeatureFlags(): Promise<void> {
	await featureFlagsStore.reset();

	revalidatePath("/", "layout");
}

/**
 * Toggle error simulation to demonstrate onError callback.
 * When enabled, the derive function throws an error which is caught by onError.
 * The store continues to work, returning base state without derived properties.
 */
export async function toggleErrorSimulation(): Promise<void> {
	await errorDemoStore.update((state) => ({
		...state,
		simulateError: !state.simulateError,
	}));

	revalidatePath("/", "layout");
}
