import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";

/**
 * Path to the JSON data file.
 * Stored in .data directory to avoid git commits.
 */
const DATA_FILE = join(process.cwd(), ".data", "settings.json");

/**
 * Settings state shape (duplicated for type safety in this module).
 */
interface SettingsState {
	theme: "light" | "dark";
	language: "en" | "es" | "fr";
	notifications: boolean;
	volume: number;
}

/**
 * Reads settings from the JSON file.
 *
 * @returns The stored settings or null if file doesn't exist
 */
export async function readDataFile(): Promise<SettingsState | null> {
	try {
		if (!existsSync(DATA_FILE)) {
			console.log("[File Adapter] No data file found, returning null");

			return null;
		}

		const content = await readFile(DATA_FILE, "utf-8");
		const data = JSON.parse(content) as SettingsState;

		console.log("[File Adapter] Read from file:", data);

		return data;
	} catch (error) {
		console.error("[File Adapter] Error reading file:", error);

		return null;
	}
}

/**
 * Writes settings to the JSON file.
 * Creates the .data directory if it doesn't exist.
 *
 * @param state - The settings state to persist
 */
export async function writeDataFile(state: SettingsState): Promise<void> {
	try {
		const directory = dirname(DATA_FILE);

		if (!existsSync(directory)) {
			await mkdir(directory, { recursive: true });
			console.log("[File Adapter] Created .data directory");
		}

		await writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");

		console.log("[File Adapter] Wrote to file:", state);
	} catch (error) {
		console.error("[File Adapter] Error writing file:", error);

		throw error;
	}
}

/**
 * Deletes the data file (for reset functionality).
 */
export async function deleteDataFile(): Promise<void> {
	try {
		if (existsSync(DATA_FILE)) {
			const { unlink } = await import("fs/promises");

			await unlink(DATA_FILE);
			console.log("[File Adapter] Deleted data file");
		}
	} catch (error) {
		console.error("[File Adapter] Error deleting file:", error);

		throw error;
	}
}
