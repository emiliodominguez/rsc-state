"use server";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, decodeSession, encodeSession, parseLoginForm } from "./session";
import { featureFlagsStore, errorDemoStore } from "./stores";

/**
 * Demo sign-in: creates a signed session cookie from the submitted name and email.
 * Invalid input is ignored. A real app would verify credentials before this point.
 *
 * @param formData - Form data containing userName and userEmail fields
 */
export async function login(formData: FormData): Promise<void> {
	const loginForm = parseLoginForm(formData);

	if (!loginForm) {
		return;
	}

	const cookieStore = await cookies();

	cookieStore.set(
		SESSION_COOKIE,
		encodeSession({
			userId: `user-${randomUUID()}`,
			...loginForm,
			theme: "light",
			preferences: {
				notifications: true,
				newsletter: false,
			},
		}),
		SESSION_COOKIE_OPTIONS,
	);

	revalidatePath("/", "layout");
}

/**
 * End user session by deleting the session cookie.
 * After logout, the user store will return default (unauthenticated) state.
 */
export async function logout(): Promise<void> {
	const cookieStore = await cookies();

	cookieStore.delete(SESSION_COOKIE);
	revalidatePath("/", "layout");
}

/**
 * Toggle theme by updating the cookie directly.
 * Note: For request-scoped stores, state changes must be persisted externally
 * (e.g., cookies, database) since each request gets a fresh store instance.
 */
export async function toggleTheme(): Promise<void> {
	const cookieStore = await cookies();
	const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);

	if (session) {
		cookieStore.set(SESSION_COOKIE, encodeSession({ ...session, theme: session.theme === "light" ? "dark" : "light" }), SESSION_COOKIE_OPTIONS);
	}

	revalidatePath("/", "layout");
}

// The actions below change persistent state for every visitor. Server Actions are public HTTP
// endpoints that anyone can call directly, so a real app must authorize the caller (for example,
// require an admin session) before mutating a persistent store. This demo deliberately lets any
// visitor toggle them.

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
