"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { settingsStore, userStore } from "./stores";

/**
 * Cookie name for storing user session data.
 */
const USER_COOKIE = "user_session";

/**
 * Login action - demonstrates REQUEST storage with cookie persistence.
 *
 * 1. Saves user data to cookie (persists across requests)
 * 2. Updates request-scoped store for current request
 * 3. Revalidates to trigger re-render
 */
export async function login(formData: FormData): Promise<void> {
	const userData = {
		userId: `user-${Date.now()}`,
		userName: formData.get("userName") as string,
		userEmail: formData.get("userEmail") as string,
	};

	// Save to cookie for future requests
	const cookieStore = await cookies();

	cookieStore.set(USER_COOKIE, JSON.stringify(userData), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 7, // 1 week
	});

	// Update store for current request
	userStore.set(userData);

	revalidatePath("/", "layout");
}

/**
 * Logout action - clears both cookie and store.
 */
export async function logout(): Promise<void> {
	const cookieStore = await cookies();

	cookieStore.delete(USER_COOKIE);
	userStore.reset();

	revalidatePath("/", "layout");
}

/**
 * Toggle theme - demonstrates PERSISTENT storage.
 *
 * No cookies needed! State persists in module-level storage.
 * Note: This is shared across ALL users (suitable for demo/global settings).
 */
export async function toggleTheme(): Promise<void> {
	const currentTheme = settingsStore.read().theme;

	settingsStore.set({ theme: currentTheme === "light" ? "dark" : "light" });

	revalidatePath("/", "layout");
}

/**
 * Helper to get user data from cookie.
 * Called in layout to hydrate request-scoped store.
 */
export async function getUserFromCookie(): Promise<{
	userId: string | null;
	userName: string;
	userEmail: string;
} | null> {
	try {
		const cookieStore = await cookies();
		const userCookie = cookieStore.get(USER_COOKIE);

		return userCookie ? JSON.parse(userCookie.value) : null;
	} catch {
		return null;
	}
}
