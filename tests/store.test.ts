import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createServerStore } from "../src";

describe("createServerStore", () => {
	it("should initialize store with provided state", () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
		});

		// When
		store.initialize({ count: 5 });

		// Then
		expect(store.read().count).toEqual(5);
	});

	it("should compute derived state correctly", () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
			derive: (state) => ({
				doubleCount: state.count * 2,
				isPositive: state.count > 0,
			}),
		});

		// When
		store.initialize({ count: 5 });
		const state = store.read();

		// Then
		expect(state.count).toEqual(5);
		expect(state.doubleCount).toEqual(10);
		expect(state.isPositive).toEqual(true);
	});

	it("should update state immutably", () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
		});
		store.initialize({ count: 0 });

		// When
		store.update((previousState) => ({ count: previousState.count + 1 }));

		// Then
		expect(store.read().count).toEqual(1);
	});

	it("should set entire state at once", () => {
		// Given
		const store = createServerStore({
			initial: { count: 0, name: "test" },
		});
		store.initialize({ count: 5, name: "initial" });

		// When
		store.set({ count: 10, name: "updated" });

		// Then
		const state = store.read();
		expect(state.count).toEqual(10);
		expect(state.name).toEqual("updated");
	});

	it("should select specific values from state", () => {
		// Given
		const store = createServerStore({
			initial: { user: { name: "John", age: 30 } },
			derive: (state) => ({
				displayName: `User: ${state.user.name}`,
			}),
		});
		store.initialize({ user: { name: "Jane", age: 25 } });

		// When
		const userName = store.select((state) => state.user.name);
		const displayName = store.select((state) => state.displayName);

		// Then
		expect(userName).toEqual("Jane");
		expect(displayName).toEqual("User: Jane");
	});

	it("should reset to initial state", () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
		});
		store.initialize({ count: 0 });
		store.update(() => ({ count: 10 }));

		// When
		store.reset();

		// Then
		expect(store.read().count).toEqual(0);
	});

	it("should support factory function for initial state", () => {
		// Given
		const store = createServerStore({
			initial: () => ({ timestamp: Date.now() }),
		});

		// When
		store.initialize(store.read());

		const state = store.read();

		// Then
		expect(typeof state.timestamp).toEqual("number");
	});

	describe("storage modes", () => {
		it("should default to request storage mode", () => {
			// Given
			const store = createServerStore({
				initial: { value: "test" },
			});

			// When
			store.initialize({ value: "test" });

			// Then
			expect(store.read().value).toEqual("test");
		});

		it("should support explicit request storage mode", () => {
			// Given
			const store = createServerStore({
				storage: "request",
				initial: { count: 0 },
			});

			// When
			store.initialize({ count: 10 });

			// Then
			expect(store.read().count).toEqual(10);
		});

		it("should support persistent storage mode", () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
			});

			// When - no initialization needed for persistent mode
			store.set({ count: 42 });

			// Then
			expect(store.read().count).toEqual(42);
		});

		it("should persist state across multiple reads in persistent mode", () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { value: "initial" },
			});

			// When
			store.set({ value: "updated" });
			const firstRead = store.read();
			const secondRead = store.read();

			// Then
			expect(firstRead.value).toEqual("updated");
			expect(secondRead.value).toEqual("updated");
		});

		it("should compute derived state in persistent mode", () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
				derive: (state) => ({
					doubled: state.count * 2,
					isPositive: state.count > 0,
				}),
			});

			// When
			store.set({ count: 5 });
			const state = store.read();

			// Then
			expect(state.count).toEqual(5);
			expect(state.doubled).toEqual(10);
			expect(state.isPositive).toEqual(true);
		});

		it("should reset to initial state in persistent mode", () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
			});
			store.set({ count: 100 });

			// When
			store.reset();

			// Then
			expect(store.read().count).toEqual(0);
		});

		it("should update state with updater function in persistent mode", () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
			});
			store.set({ count: 5 });

			// When
			store.update((previous) => ({ count: previous.count + 10 }));

			// Then
			expect(store.read().count).toEqual(15);
		});

		it("should select values in persistent mode", () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { user: { name: "Alice", age: 30 } },
				derive: (state) => ({
					greeting: `Hello, ${state.user.name}!`,
				}),
			});
			store.set({ user: { name: "Bob", age: 25 } });

			// When
			const name = store.select((state) => state.user.name);
			const greeting = store.select((state) => state.greeting);

			// Then
			expect(name).toEqual("Bob");
			expect(greeting).toEqual("Hello, Bob!");
		});
	});

	describe("debug mode", () => {
		beforeEach(() => {
			vi.spyOn(console, "log").mockImplementation(() => {});
			vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should log on initialize when debug is enabled", () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});

			// When
			store.initialize({ count: 5 });

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Initialized"), { count: 5 });
		});

		it("should log on update when debug is enabled", () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});
			store.initialize({ count: 0 });

			// When
			store.update((previous) => ({ count: previous.count + 1 }));

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Updated"), { count: 1 });
		});

		it("should log on set when debug is enabled", () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});
			store.initialize({ count: 0 });

			// When
			store.set({ count: 42 });

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Set"), { count: 42 });
		});

		it("should log on reset when debug is enabled", () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});
			store.initialize({ count: 0 });
			store.set({ count: 100 });

			// When
			store.reset();

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Reset"));
		});

		it("should warn when reading uninitialized store with debug enabled", () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});

			// When
			store.read();

			// Then
			expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("uninitialized"));
		});
	});
});
