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

		it("should log on batch update when debug is enabled", () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0, name: "test" },
			});
			store.initialize({ count: 0, name: "test" });

			// When
			store.batch((api) => {
				api.update((state) => ({ ...state, count: state.count + 1 }));
				api.set({ count: 10, name: "batched" });
			});

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Batch updated"), { count: 10, name: "batched" });
		});

		it("should warn when derive function throws error with debug enabled", () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { value: null as string | null },
				derive: (state) => ({
					// This will throw when value is null
					length: state.value!.length,
				}),
			});
			store.initialize({ value: null });

			// When
			store.read();

			// Then
			expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Error in derive function"), expect.any(String));
		});
	});

	describe("derived state memoization", () => {
		it("should memoize derived state when base state has not changed", () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 5 },
				derive: deriveSpy,
			});
			store.initialize({ count: 5 });

			// When
			store.read();
			store.read();
			store.read();

			// Then - derive should only be called once due to memoization
			expect(deriveSpy).toHaveBeenCalledTimes(1);
		});

		it("should recalculate derived state when base state changes", () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});
			store.initialize({ count: 5 });

			// When
			store.read(); // First call
			store.update((state) => ({ count: state.count + 1 }));
			store.read(); // Second call after update

			// Then - derive should be called twice (once per state change)
			expect(deriveSpy).toHaveBeenCalledTimes(2);
		});

		it("should invalidate derived cache on reset", () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});
			store.initialize({ count: 5 });

			// When
			store.read();
			store.reset();
			store.read();

			// Then - derive should be called twice
			expect(deriveSpy).toHaveBeenCalledTimes(2);
		});

		it("should invalidate derived cache on set", () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});
			store.initialize({ count: 5 });

			// When
			store.read();
			store.set({ count: 10 });
			store.read();

			// Then - derive should be called twice
			expect(deriveSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe("error boundaries", () => {
		it("should call onError callback when derive function throws", () => {
			// Given
			const onErrorSpy = vi.fn();
			const store = createServerStore({
				initial: { value: null as string | null },
				derive: (state) => ({
					length: state.value!.length, // Will throw when value is null
				}),
				onError: onErrorSpy,
			});
			store.initialize({ value: null });

			// When
			store.read();

			// Then
			expect(onErrorSpy).toHaveBeenCalledTimes(1);
			expect(onErrorSpy).toHaveBeenCalledWith(expect.any(Error), { method: "derive", state: { value: null } });
		});

		it("should return base state without derived properties when derive throws", () => {
			// Given
			const store = createServerStore({
				initial: { value: null as string | null },
				derive: (state) => ({
					length: state.value!.length,
				}),
				onError: vi.fn(),
			});
			store.initialize({ value: null });

			// When
			const state = store.read();

			// Then
			expect(state.value).toEqual(null);
			expect(state).not.toHaveProperty("length");
		});

		it("should recover and compute derived state after error is fixed", () => {
			// Given
			const store = createServerStore({
				initial: { value: null as string | null },
				derive: (state) => ({
					length: state.value?.length ?? 0,
					hasValue: state.value !== null,
				}),
			});
			store.initialize({ value: null });

			// When
			const stateWithNull = store.read();
			store.set({ value: "hello" });
			const stateWithValue = store.read();

			// Then
			expect(stateWithNull.length).toEqual(0);
			expect(stateWithNull.hasValue).toEqual(false);
			expect(stateWithValue.length).toEqual(5);
			expect(stateWithValue.hasValue).toEqual(true);
		});

		it("should handle non-Error thrown values in derive function", () => {
			// Given
			const onErrorSpy = vi.fn();
			const store = createServerStore({
				initial: { shouldThrow: true },
				derive: (state) => {
					if (state.shouldThrow) {
						// eslint-disable-next-line @typescript-eslint/only-throw-error
						throw "string error"; // Throwing a non-Error value
					}
					return { computed: true };
				},
				onError: onErrorSpy,
			});
			store.initialize({ shouldThrow: true });

			// When
			store.read();

			// Then
			expect(onErrorSpy).toHaveBeenCalledTimes(1);
			expect(onErrorSpy).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ method: "derive" }));
			// The error should be wrapped in an Error instance
			expect(onErrorSpy.mock.calls[0][0].message).toEqual("string error");
		});
	});

	describe("lifecycle hooks", () => {
		it("should call onInitialize when store is initialized", () => {
			// Given
			const onInitializeSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: onInitializeSpy,
			});

			// When
			store.initialize({ count: 5 });

			// Then
			expect(onInitializeSpy).toHaveBeenCalledTimes(1);
			expect(onInitializeSpy).toHaveBeenCalledWith({ count: 5 });
		});

		it("should call onUpdate when state is updated via update()", () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onUpdate: onUpdateSpy,
			});
			store.initialize({ count: 0 });

			// When
			store.update((state) => ({ count: state.count + 5 }));

			// Then
			expect(onUpdateSpy).toHaveBeenCalledTimes(1);
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0 }, { count: 5 });
		});

		it("should call onUpdate when state is updated via set()", () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onUpdate: onUpdateSpy,
			});
			store.initialize({ count: 0 });

			// When
			store.set({ count: 42 });

			// Then
			expect(onUpdateSpy).toHaveBeenCalledTimes(1);
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0 }, { count: 42 });
		});

		it("should call onReset when store is reset", () => {
			// Given
			const onResetSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onReset: onResetSpy,
			});
			store.initialize({ count: 0 });
			store.set({ count: 100 });

			// When
			store.reset();

			// Then
			expect(onResetSpy).toHaveBeenCalledTimes(1);
		});

		it("should call lifecycle hooks in correct order", () => {
			// Given
			const callOrder: string[] = [];
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: () => callOrder.push("initialize"),
				onUpdate: () => callOrder.push("update"),
				onReset: () => callOrder.push("reset"),
			});

			// When
			store.initialize({ count: 0 });
			store.update((state) => ({ count: state.count + 1 }));
			store.set({ count: 10 });
			store.reset();

			// Then
			expect(callOrder).toEqual(["initialize", "update", "update", "reset"]);
		});
	});

	describe("batch updates", () => {
		it("should apply multiple updates in a single batch", () => {
			// Given
			const store = createServerStore({
				initial: { count: 0, name: "initial" },
			});
			store.initialize({ count: 0, name: "initial" });

			// When
			store.batch((api) => {
				api.update((state) => ({ ...state, count: state.count + 1 }));
				api.update((state) => ({ ...state, count: state.count + 1 }));
				api.set({ count: 100, name: "batched" });
				api.update((state) => ({ ...state, count: state.count + 5 }));
			});

			// Then
			const state = store.read();
			expect(state.count).toEqual(105);
			expect(state.name).toEqual("batched");
		});

		it("should compute derived state only once after batch completes", () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});
			store.initialize({ count: 0 });
			store.read(); // Initial read
			deriveSpy.mockClear();

			// When
			store.batch((api) => {
				api.update((state) => ({ count: state.count + 1 }));
				api.update((state) => ({ count: state.count + 1 }));
				api.update((state) => ({ count: state.count + 1 }));
			});
			store.read();

			// Then - derive should only be called once after batch, not three times
			expect(deriveSpy).toHaveBeenCalledTimes(1);
		});

		it("should call onUpdate once after batch with initial and final state", () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onUpdate: onUpdateSpy,
			});
			store.initialize({ count: 0 });

			// When
			store.batch((api) => {
				api.update((state) => ({ count: state.count + 1 }));
				api.update((state) => ({ count: state.count + 2 }));
				api.update((state) => ({ count: state.count + 3 }));
			});

			// Then
			expect(onUpdateSpy).toHaveBeenCalledTimes(1);
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0 }, { count: 6 });
		});

		it("should work with persistent storage mode", () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { value: 0 },
			});
			store.set({ value: 10 });

			// When
			store.batch((api) => {
				api.update((state) => ({ value: state.value * 2 }));
				api.update((state) => ({ value: state.value + 5 }));
			});

			// Then
			expect(store.read().value).toEqual(25);
		});
	});
});
