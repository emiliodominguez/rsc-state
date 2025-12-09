import { describe, it, expect } from "vitest";
import { createServerStore } from "../src";

describe("createServerStore", () => {
	it("initializes with provided state", () => {
		const store = createServerStore({
			initial: { count: 0 },
		});

		store.initialize({ count: 5 });
		expect(store.read().count).toBe(5);
	});

	it("computes derived state correctly", () => {
		const store = createServerStore({
			initial: { count: 0 },
			derive: (state) => ({
				doubleCount: state.count * 2,
				isPositive: state.count > 0,
			}),
		});

		store.initialize({ count: 5 });
		const state = store.read();

		expect(state.count).toBe(5);
		expect(state.doubleCount).toBe(10);
		expect(state.isPositive).toBe(true);
	});

	it("updates state immutably", () => {
		const store = createServerStore({
			initial: { count: 0 },
		});

		store.initialize({ count: 0 });
		store.update((previousState) => ({ count: previousState.count + 1 }));

		expect(store.read().count).toBe(1);
	});

	it("sets entire state", () => {
		const store = createServerStore({
			initial: { count: 0, name: "test" },
		});

		store.initialize({ count: 5, name: "initial" });
		store.set({ count: 10, name: "updated" });

		const state = store.read();
		expect(state.count).toBe(10);
		expect(state.name).toBe("updated");
	});

	it("selects specific values", () => {
		const store = createServerStore({
			initial: { user: { name: "John", age: 30 } },
			derive: (state) => ({
				displayName: `User: ${state.user.name}`,
			}),
		});

		store.initialize({ user: { name: "Jane", age: 25 } });

		const userName = store.select((state) => state.user.name);
		const displayName = store.select((state) => state.displayName);

		expect(userName).toBe("Jane");
		expect(displayName).toBe("User: Jane");
	});

	it("resets to initial state", () => {
		const store = createServerStore({
			initial: { count: 0 },
		});

		store.initialize({ count: 0 });
		store.update(() => ({ count: 10 }));
		expect(store.read().count).toBe(10);

		store.reset();
		expect(store.read().count).toBe(0);
	});

	it("supports factory function for initial state", () => {
		const store = createServerStore({
			initial: () => ({ timestamp: Date.now() }),
		});

		store.initialize(store.read());
		const state = store.read();

		expect(typeof state.timestamp).toBe("number");
	});
});
