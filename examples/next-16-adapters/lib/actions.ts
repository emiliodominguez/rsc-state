"use server";

import { revalidatePath } from "next/cache";

import { settingsStore, counterStore } from "./stores";
import { deleteDataFile } from "./file-adapter";

/**
 * Toggle theme between light and dark.
 */
export async function toggleTheme(): Promise<void> {
	await settingsStore.update((state) => ({
		...state,
		theme: state.theme === "light" ? "dark" : "light",
	}));

	revalidatePath("/");
}

/**
 * Change language setting.
 */
export async function changeLanguage(formData: FormData): Promise<void> {
	const language = formData.get("language") as "en" | "es" | "fr";

	await settingsStore.patch({ language });

	revalidatePath("/");
}

/**
 * Toggle notifications on/off.
 */
export async function toggleNotifications(): Promise<void> {
	await settingsStore.update((state) => ({
		...state,
		notifications: !state.notifications,
	}));

	revalidatePath("/");
}

/**
 * Set volume level.
 */
export async function setVolume(formData: FormData): Promise<void> {
	const volume = parseInt(formData.get("volume") as string, 10);

	await settingsStore.patch({ volume });

	revalidatePath("/");
}

/**
 * Reset settings to default and delete persisted file.
 */
export async function resetSettings(): Promise<void> {
	await settingsStore.reset();
	// Delete file after reset (reset writes initial state to adapter, so delete after)
	await deleteDataFile();

	revalidatePath("/");
}

/**
 * Increment counter.
 */
export async function incrementCounter(): Promise<void> {
	await counterStore.update((state) => ({
		...state,
		count: state.count + 1,
	}));

	revalidatePath("/");
}

/**
 * Decrement counter.
 */
export async function decrementCounter(): Promise<void> {
	await counterStore.update((state) => ({
		...state,
		count: state.count - 1,
	}));

	revalidatePath("/");
}

/**
 * Reset counter to zero.
 */
export async function resetCounter(): Promise<void> {
	await counterStore.reset();

	revalidatePath("/");
}

/**
 * Demonstrate batch operations with counter.
 * Increments counter 5 times in a single batch.
 */
export async function batchIncrement(): Promise<void> {
	await counterStore.batch((api) => {
		api.update((state) => ({ ...state, count: state.count + 1 }));
		api.update((state) => ({ ...state, count: state.count + 1 }));
		api.update((state) => ({ ...state, count: state.count + 1 }));
		api.update((state) => ({ ...state, count: state.count + 1 }));
		api.update((state) => ({ ...state, count: state.count + 1 }));
	});

	revalidatePath("/");
}
