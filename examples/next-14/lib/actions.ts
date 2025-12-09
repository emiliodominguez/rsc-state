"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { featureFlagsStore } from "./stores";

const USER_COOKIE = "user_session";

export async function login(formData: FormData): Promise<void> {
	const userData = {
		userId: `user-${Date.now()}`,
		userName: formData.get("userName") as string,
		userEmail: formData.get("userEmail") as string,
		theme: "light",
	};

	cookies().set(USER_COOKIE, JSON.stringify(userData), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 7,
		path: "/",
	});

	revalidatePath("/", "layout");
}

export async function logout(): Promise<void> {
	cookies().delete(USER_COOKIE);
	revalidatePath("/", "layout");
}

export async function toggleTheme(): Promise<void> {
	const userCookie = cookies().get(USER_COOKIE);

	if (userCookie) {
		try {
			const userData = JSON.parse(userCookie.value);
			const newTheme = userData.theme === "light" ? "dark" : "light";

			cookies().set(USER_COOKIE, JSON.stringify({ ...userData, theme: newTheme }), {
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

export async function toggleBetaFeatures(): Promise<void> {
	const current = featureFlagsStore.read().betaFeatures;

	featureFlagsStore.set({ betaFeatures: !current });
	revalidatePath("/", "layout");
}
