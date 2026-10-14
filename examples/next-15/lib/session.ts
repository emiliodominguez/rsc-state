import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Session cookie handling for the example.
 *
 * The session is stored client-side, so it must be signed: without a signature anyone can
 * edit the cookie and be rendered as any user, with any extra fields they like. The payload
 * is signed with HMAC-SHA256 and validated field by field before it reaches the store.
 */

export const SESSION_COOKIE = "user_session";

export const SESSION_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax",
	maxAge: 60 * 60 * 24 * 7,
	path: "/",
} as const;

const MAXIMUM_USER_NAME_LENGTH = 64;
const MAXIMUM_USER_EMAIL_LENGTH = 254;

export interface SessionData {
	userId: string;
	userName: string;
	userEmail: string;
	theme: "light" | "dark";
	preferences: {
		notifications: boolean;
		newsletter: boolean;
	};
}

type GlobalScopeWithSessionSecret = typeof globalThis & { __rscStateExampleSessionSecret?: string };

/**
 * Returns the signing secret. Production deployments must set SESSION_SECRET (shared by every
 * server instance). Without it, a random per-process secret is used, kept on globalThis so dev
 * hot reloads don't invalidate sessions; sessions then end when the process restarts.
 *
 * @returns Secret used to sign session cookies
 */
function getSessionSecret(): string {
	if (process.env.SESSION_SECRET) {
		return process.env.SESSION_SECRET;
	}

	const globalScope = globalThis as GlobalScopeWithSessionSecret;

	globalScope.__rscStateExampleSessionSecret ??= randomBytes(32).toString("hex");

	return globalScope.__rscStateExampleSessionSecret;
}

/**
 * Computes the signature of an encoded session payload.
 *
 * @param encodedPayload - Base64url-encoded JSON payload
 * @returns Base64url-encoded HMAC-SHA256 signature
 */
function signPayload(encodedPayload: string): string {
	return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

/**
 * Checks that a value has exactly the session shape, so a cookie can never inject extra
 * fields (such as `isAdmin`) or wrong types into the store.
 *
 * @param value - Parsed cookie payload
 * @returns True when the value is a well-formed session
 */
function isSessionData(value: unknown): value is SessionData {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	const preferences = candidate.preferences as Record<string, unknown> | null | undefined;

	return (
		Object.keys(candidate).length === 5 &&
		typeof candidate.userId === "string" &&
		typeof candidate.userName === "string" &&
		candidate.userName.length <= MAXIMUM_USER_NAME_LENGTH &&
		typeof candidate.userEmail === "string" &&
		candidate.userEmail.length <= MAXIMUM_USER_EMAIL_LENGTH &&
		(candidate.theme === "light" || candidate.theme === "dark") &&
		typeof preferences === "object" &&
		preferences !== null &&
		Object.keys(preferences).length === 2 &&
		typeof preferences.notifications === "boolean" &&
		typeof preferences.newsletter === "boolean"
	);
}

/**
 * Serializes and signs a session for storage in a cookie.
 *
 * @param session - Session to encode
 * @returns Cookie value in the form `payload.signature`
 */
export function encodeSession(session: SessionData): string {
	const encodedPayload = Buffer.from(JSON.stringify(session)).toString("base64url");

	return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

/**
 * Verifies and parses a session cookie. Any tampering, malformed content or unexpected
 * shape yields null, which renders the visitor as signed out.
 *
 * @param cookieValue - Raw cookie value, if present
 * @returns The session, or null when the cookie is missing or invalid
 */
export function decodeSession(cookieValue: string | undefined): SessionData | null {
	if (cookieValue === undefined) {
		return null;
	}

	const [encodedPayload, signature, ...unexpectedParts] = cookieValue.split(".");

	if (encodedPayload === undefined || signature === undefined || unexpectedParts.length > 0) {
		return null;
	}

	const expectedSignature = Buffer.from(signPayload(encodedPayload));
	const receivedSignature = Buffer.from(signature);

	// Constant-time comparison so the signature can't be guessed byte by byte from timings
	if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
		return null;
	}

	try {
		const payload: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

		return isSessionData(payload) ? payload : null;
	} catch {
		return null;
	}
}

/**
 * Validates login form input. Returns null for anything that isn't a reasonable name and
 * email, so oversized or non-text values never reach the cookie.
 *
 * @param formData - Submitted login form
 * @returns Trimmed name and email, or null when invalid
 */
export function parseLoginForm(formData: FormData): Pick<SessionData, "userName" | "userEmail"> | null {
	const userName = formData.get("userName");
	const userEmail = formData.get("userEmail");

	if (typeof userName !== "string" || typeof userEmail !== "string") {
		return null;
	}

	const trimmedUserName = userName.trim();
	const trimmedUserEmail = userEmail.trim();
	const isValidUserName = trimmedUserName.length > 0 && trimmedUserName.length <= MAXIMUM_USER_NAME_LENGTH;
	const isValidUserEmail = trimmedUserEmail.length <= MAXIMUM_USER_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+$/.test(trimmedUserEmail);

	return isValidUserName && isValidUserEmail ? { userName: trimmedUserName, userEmail: trimmedUserEmail } : null;
}
