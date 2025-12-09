import { describe, it, expect } from "vitest";

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
});
