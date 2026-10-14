import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Path to the JSON data file.
 * Stored in .data directory to avoid git commits.
 */
const DATA_FILE = join(process.cwd(), ".data", "settings.json");

export const SUPPORTED_LANGUAGES = ["en", "es", "fr"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Settings state shape (duplicated for type safety in this module).
 */
export interface SettingsState {
	theme: "light" | "dark";
	language: SupportedLanguage;
	notifications: boolean;
	volume: number;
}

/**
 * Checks that a language code is one the app supports.
 *
 * @param value - Candidate language code
 * @returns True for a supported language
 */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
	return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Checks that a volume is an integer between 0 and 100.
 *
 * @param value - Candidate volume
 * @returns True for a valid volume
 */
export function isValidVolume(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

/**
 * Validates data read from disk. The file is outside the app's control (hand edits, partial
 * writes, other processes), so its content is untrusted until it has exactly the settings shape.
 *
 * @param value - Parsed file content
 * @returns True when the value is a well-formed settings object
 */
function isSettingsState(value: unknown): value is SettingsState {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return (
		Object.keys(candidate).length === 4 &&
		(candidate.theme === "light" || candidate.theme === "dark") &&
		isSupportedLanguage(candidate.language) &&
		typeof candidate.notifications === "boolean" &&
		isValidVolume(candidate.volume)
	);
}

/**
 * Reads settings from the JSON file.
 *
 * @returns The stored settings, or null if the file doesn't exist or is invalid
 */
export async function readDataFile(): Promise<SettingsState | null> {
	let content: string;

	try {
		content = await readFile(DATA_FILE, "utf-8");
	} catch {
		console.log("[File Adapter] No data file found, returning null");

		return null;
	}

	try {
		const data: unknown = JSON.parse(content);

		if (isSettingsState(data)) {
			return data;
		}
	} catch {
		// Fall through to the invalid-content warning
	}

	console.warn("[File Adapter] Ignoring invalid settings file; using defaults");

	return null;
}

/**
 * Writes settings to the JSON file atomically: the content goes to a uniquely named temporary
 * file that is then renamed over the target, so a crash mid-write never leaves a truncated file.
 *
 * @param state - The settings state to persist
 */
export async function writeDataFile(state: SettingsState): Promise<void> {
	const temporaryFile = `${DATA_FILE}.${randomUUID()}.tmp`;

	await mkdir(dirname(DATA_FILE), { recursive: true });

	try {
		await writeFile(temporaryFile, JSON.stringify(state, null, 2), "utf-8");
		await rename(temporaryFile, DATA_FILE);
	} catch (error) {
		await rm(temporaryFile, { force: true });

		throw error;
	}
}

/**
 * Deletes the data file (for reset functionality).
 */
export async function deleteDataFile(): Promise<void> {
	await rm(DATA_FILE, { force: true });
}
