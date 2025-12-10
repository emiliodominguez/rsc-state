import { cache } from "react";

import { createServerStore } from "rsc-state";
import type { StorageAdapter } from "rsc-state";

import { readDataFile, writeDataFile } from "./file-adapter";

/**
 * JSON file storage adapter.
 *
 * This adapter demonstrates how to persist store state to a JSON file.
 * In production, you would typically use Redis, a database, or another
 * persistent storage backend.
 *
 * The adapter interface is simple:
 * - `read()`: Load state from storage (returns null if not found)
 * - `write(state)`: Save state to storage
 *
 * Both methods support async operations for database/cache backends.
 */
const jsonFileAdapter: StorageAdapter<SettingsState> = {
	read: async () => {
		const data = await readDataFile();

		return data;
	},
	write: async (state) => {
		await writeDataFile(state);
	},
};

/**
 * Settings state shape.
 */
interface SettingsState {
	theme: "light" | "dark";
	language: "en" | "es" | "fr";
	notifications: boolean;
	volume: number;
}

/**
 * Settings store with file-based persistence.
 *
 * This demonstrates:
 * - Storage adapters for custom persistence backends
 * - Async read/write operations
 * - Middleware for logging state changes
 * - State survives server restarts (persisted to file)
 */
export const settingsStore = createServerStore({
	storage: "persistent",
	initial: {
		theme: "light" as "light" | "dark",
		language: "en" as "en" | "es" | "fr",
		notifications: true,
		volume: 80,
	},
	adapter: jsonFileAdapter,
	middleware: [
		(operation) => {
			console.log(`[Settings] ${operation.type}:`, JSON.stringify(operation.nextState));

			return operation.nextState;
		},
	],
	derive: (state) => ({
		isDarkMode: state.theme === "dark",
		volumeLabel: state.volume === 0 ? "Muted" : state.volume < 30 ? "Low" : state.volume < 70 ? "Medium" : "High",
	}),
	onUpdate: (previousState, nextState) => {
		console.log("[Settings] State persisted to file");
		console.log("  Previous:", JSON.stringify(previousState));
		console.log("  Next:", JSON.stringify(nextState));
	},
});

/**
 * In-memory adapter for demonstration.
 *
 * This shows an adapter that stores state in memory with simulated async delay.
 * Useful for testing or when you want to demonstrate adapter behavior
 * without external dependencies.
 */
let memoryStorage: CounterState | null = null;

const memoryAdapter: StorageAdapter<CounterState> = {
	read: async () => {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 10));
		console.log("[Memory Adapter] Read:", memoryStorage);

		return memoryStorage;
	},
	write: async (state) => {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 10));
		memoryStorage = state;
		console.log("[Memory Adapter] Write:", state);
	},
};

/**
 * Counter state shape.
 */
interface CounterState {
	count: number;
	lastUpdated: string;
}

/**
 * Counter store with in-memory adapter.
 *
 * This demonstrates:
 * - Simple adapter implementation
 * - State isolation from the file adapter
 * - Multiple stores with different adapters
 */
export const counterStore = createServerStore({
	storage: "persistent",
	initial: {
		count: 0,
		lastUpdated: new Date().toISOString(),
	},
	adapter: memoryAdapter,
	middleware: [
		(operation) => {
			// Add timestamp on every update
			if (operation.type === "update" || operation.type === "set") {
				return {
					...operation.nextState,
					lastUpdated: new Date().toISOString(),
				};
			}

			return operation.nextState;
		},
	],
	derive: (state) => ({
		isZero: state.count === 0,
		isNegative: state.count < 0,
	}),
});

/**
 * Loads settings from the file adapter and returns current state.
 * Reads directly from the file adapter to ensure we always get persisted data.
 * Uses React's cache() to dedupe calls within the same request.
 */
export const getSettings = cache(async () => {
	// Read directly from adapter to get persisted state
	const persistedState = await readDataFile();

	if (persistedState) {
		// Sync the store with persisted state
		await settingsStore.set(persistedState);
	}

	return settingsStore.read();
});

/**
 * Loads counter from the memory adapter and returns current state.
 * Uses React's cache() to dedupe calls within the same request.
 */
export const getCounter = cache(async () => {
	// For in-memory adapter, just trigger an update to ensure instance exists
	await counterStore.update((state) => state);

	return counterStore.read();
});
