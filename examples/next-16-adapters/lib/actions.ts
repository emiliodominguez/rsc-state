"use server";

import { revalidatePath } from "next/cache";

import { settingsStore, counterStore } from "./stores";
import { deleteDataFile, isSupportedLanguage, isValidVolume } from "./file-adapter";

// These actions change persistent state shared by every visitor. Server Actions are public HTTP
// endpoints that anyone can call directly, so a real app must authorize the caller (for example,
// require an admin session) and validate every input before mutating a persistent store. This
// demo deliberately lets any visitor change the settings, but still validates the input.

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
	const language = formData.get("language");

	// Server Actions are public endpoints: never persist unvalidated input for every visitor
	if (!isSupportedLanguage(language)) {
		return;
	}

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
	const volumeInput = formData.get("volume");
	const volume = typeof volumeInput === "string" ? Number(volumeInput) : Number.NaN;

	if (!isValidVolume(volume)) {
		return;
	}

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
