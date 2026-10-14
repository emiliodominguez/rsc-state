import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Loads the library against a React module that lacks `cache`, like stable React 18.
 *
 * @returns The library's public exports
 */
async function importWithReactWithoutCache(): Promise<typeof import("../src")> {
	vi.resetModules();
	// A real ESM namespace yields undefined for a missing export; Vitest mocks throw unless it is declared
	vi.doMock("react", () => ({ version: "18.3.1", cache: undefined }));

	return import("../src");
}

describe("React builds without cache()", () => {
	afterEach(() => {
		vi.doUnmock("react");
		vi.resetModules();
	});

	it("should load the library without failing at import time", async () => {
		// Given / When
		const library = await importWithReactWithoutCache();

		// Then
		expect(typeof library.createServerStore).toEqual("function");
	});

	it("should throw a descriptive error when creating a request-scoped store", async () => {
		// Given
		const { createServerStore } = await importWithReactWithoutCache();

		// When
		const createRequestScopedStore = (): unknown => createServerStore({ initial: { count: 0 } });

		// Then
		expect(createRequestScopedStore).toThrow(/Request-scoped stores require React's cache\(\)/);
	});

	it("should keep persistent stores working", async () => {
		// Given
		const { createServerStore } = await importWithReactWithoutCache();
		const store = createServerStore({ storage: "persistent", initial: { count: 0 } });

		// When
		await store.patch({ count: 3 });

		// Then
		expect(store.read().count).toEqual(3);
	});
});
