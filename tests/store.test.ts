import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createServerStore } from "../src";

describe("createServerStore", () => {
	it("should initialize store with provided state", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
		});

		// When
		await store.initialize({ count: 5 });

		// Then
		expect(store.read().count).toEqual(5);
	});

	it("should compute derived state correctly", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
			derive: (state) => ({
				doubleCount: state.count * 2,
				isPositive: state.count > 0,
			}),
		});

		// When
		await store.initialize({ count: 5 });
		const state = store.read();

		// Then
		expect(state.count).toEqual(5);
		expect(state.doubleCount).toEqual(10);
		expect(state.isPositive).toEqual(true);
	});

	it("should update state immutably", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
		});
		await store.initialize({ count: 0 });

		// When
		await store.update((previousState) => ({ count: previousState.count + 1 }));

		// Then
		expect(store.read().count).toEqual(1);
	});

	it("should set entire state at once", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0, name: "test" },
		});
		await store.initialize({ count: 5, name: "initial" });

		// When
		await store.set({ count: 10, name: "updated" });

		// Then
		const state = store.read();
		expect(state.count).toEqual(10);
		expect(state.name).toEqual("updated");
	});

	it("should select specific values from state", async () => {
		// Given
		const store = createServerStore({
			initial: { user: { name: "John", age: 30 } },
			derive: (state) => ({
				displayName: `User: ${state.user.name}`,
			}),
		});
		await store.initialize({ user: { name: "Jane", age: 25 } });

		// When
		const userName = store.select((state) => state.user.name);
		const displayName = store.select((state) => state.displayName);

		// Then
		expect(userName).toEqual("Jane");
		expect(displayName).toEqual("User: Jane");
	});

	it("should reset to initial state", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
		});
		await store.initialize({ count: 0 });
		await store.update(() => ({ count: 10 }));

		// When
		await store.reset();

		// Then
		expect(store.read().count).toEqual(0);
	});

	it("should support factory function for initial state", async () => {
		// Given
		const store = createServerStore({
			initial: () => ({ timestamp: Date.now() }),
		});

		// When
		await store.initialize(store.read());

		const state = store.read();

		// Then
		expect(typeof state.timestamp).toEqual("number");
	});

	describe("storage modes", () => {
		it("should default to request storage mode", async () => {
			// Given
			const store = createServerStore({
				initial: { value: "test" },
			});

			// When
			await store.initialize({ value: "test" });

			// Then
			expect(store.read().value).toEqual("test");
		});

		it("should support explicit request storage mode", async () => {
			// Given
			const store = createServerStore({
				storage: "request",
				initial: { count: 0 },
			});

			// When
			await store.initialize({ count: 10 });

			// Then
			expect(store.read().count).toEqual(10);
		});

		it("should support persistent storage mode", async () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
			});

			// When - no initialization needed for persistent mode
			await store.set({ count: 42 });

			// Then
			expect(store.read().count).toEqual(42);
		});

		it("should persist state across multiple reads in persistent mode", async () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { value: "initial" },
			});

			// When
			await store.set({ value: "updated" });
			const firstRead = store.read();
			const secondRead = store.read();

			// Then
			expect(firstRead.value).toEqual("updated");
			expect(secondRead.value).toEqual("updated");
		});

		it("should compute derived state in persistent mode", async () => {
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
			await store.set({ count: 5 });
			const state = store.read();

			// Then
			expect(state.count).toEqual(5);
			expect(state.doubled).toEqual(10);
			expect(state.isPositive).toEqual(true);
		});

		it("should reset to initial state in persistent mode", async () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
			});

			await store.set({ count: 100 });

			// When
			await store.reset();

			// Then
			expect(store.read().count).toEqual(0);
		});

		it("should update state with updater function in persistent mode", async () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
			});

			await store.set({ count: 5 });

			// When
			await store.update((previous) => ({ count: previous.count + 10 }));

			// Then
			expect(store.read().count).toEqual(15);
		});

		it("should select values in persistent mode", async () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { user: { name: "Alice", age: 30 } },
				derive: (state) => ({
					greeting: `Hello, ${state.user.name}!`,
				}),
			});

			await store.set({ user: { name: "Bob", age: 25 } });

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

		it("should log on initialize when debug is enabled", async () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Initialized"), { count: 5 });
		});

		it("should log on update when debug is enabled", async () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});

			await store.initialize({ count: 0 });

			// When
			await store.update((previous) => ({ count: previous.count + 1 }));

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Updated"), { count: 1 });
		});

		it("should log on set when debug is enabled", async () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});

			await store.initialize({ count: 0 });

			// When
			await store.set({ count: 42 });

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Set"), { count: 42 });
		});

		it("should log on patch when debug is enabled", async () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0, name: "test" },
			});

			await store.initialize({ count: 0, name: "test" });

			// When
			await store.patch({ count: 42 });

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Patched"), { count: 42, name: "test" });
		});

		it("should log on reset when debug is enabled", async () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0 },
			});

			await store.initialize({ count: 0 });

			await store.set({ count: 100 });

			// When
			await store.reset();

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

		it("should log on batch update when debug is enabled", async () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { count: 0, name: "test" },
			});

			await store.initialize({ count: 0, name: "test" });

			// When
			await store.batch((api) => {
				api.update((state) => ({ ...state, count: state.count + 1 }));
				api.set({ count: 10, name: "batched" });
			});

			// Then
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Batch updated"), { count: 10, name: "batched" });
		});

		it("should warn when derive function throws error with debug enabled", async () => {
			// Given
			const store = createServerStore({
				debug: true,
				initial: { value: null as string | null },
				derive: (state) => ({
					// This will throw when value is null
					length: state.value!.length,
				}),
			});

			await store.initialize({ value: null });

			// When
			store.read();

			// Then
			expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Error in derive function"), expect.any(String));
		});
	});

	describe("derived state memoization", () => {
		it("should memoize derived state when base state has not changed", async () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 5 },
				derive: deriveSpy,
			});

			await store.initialize({ count: 5 });

			// When
			store.read();
			store.read();
			store.read();

			// Then - derive should only be called once due to memoization
			expect(deriveSpy).toHaveBeenCalledTimes(1);
		});

		it("should recalculate derived state when base state changes", async () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});

			await store.initialize({ count: 5 });

			// When
			store.read(); // First call
			await store.update((state) => ({ count: state.count + 1 }));
			store.read(); // Second call after update

			// Then - derive should be called twice (once per state change)
			expect(deriveSpy).toHaveBeenCalledTimes(2);
		});

		it("should invalidate derived cache on reset", async () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});

			await store.initialize({ count: 5 });

			// When
			store.read();
			await store.reset();
			store.read();

			// Then - derive should be called twice
			expect(deriveSpy).toHaveBeenCalledTimes(2);
		});

		it("should invalidate derived cache on set", async () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});

			await store.initialize({ count: 5 });

			// When
			store.read();

			await store.set({ count: 10 });
			store.read();

			// Then - derive should be called twice
			expect(deriveSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe("error boundaries", () => {
		it("should call onError callback when derive function throws", async () => {
			// Given
			const onErrorSpy = vi.fn();
			const store = createServerStore({
				initial: { value: null as string | null },
				derive: (state) => ({
					length: state.value!.length, // Will throw when value is null
				}),
				onError: onErrorSpy,
			});

			await store.initialize({ value: null });

			// When
			store.read();

			// Then
			expect(onErrorSpy).toHaveBeenCalledTimes(1);
			expect(onErrorSpy).toHaveBeenCalledWith(expect.any(Error), { method: "derive", state: { value: null } });
		});

		it("should return base state without derived properties when derive throws", async () => {
			// Given
			const store = createServerStore({
				initial: { value: null as string | null },
				derive: (state) => ({
					length: state.value!.length,
				}),
				onError: vi.fn(),
			});

			await store.initialize({ value: null });

			// When
			const state = store.read();

			// Then
			expect(state.value).toEqual(null);
			expect(state).not.toHaveProperty("length");
		});

		it("should recover and compute derived state after error is fixed", async () => {
			// Given
			const store = createServerStore({
				initial: { value: null as string | null },
				derive: (state) => ({
					length: state.value?.length ?? 0,
					hasValue: state.value !== null,
				}),
			});

			await store.initialize({ value: null });

			// When
			const stateWithNull = store.read();

			await store.set({ value: "hello" });
			const stateWithValue = store.read();

			// Then
			expect(stateWithNull.length).toEqual(0);
			expect(stateWithNull.hasValue).toEqual(false);
			expect(stateWithValue.length).toEqual(5);
			expect(stateWithValue.hasValue).toEqual(true);
		});

		it("should handle non-Error thrown values in derive function", async () => {
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

			await store.initialize({ shouldThrow: true });

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
		it("should call onInitialize when store is initialized", async () => {
			// Given
			const onInitializeSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: onInitializeSpy,
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(onInitializeSpy).toHaveBeenCalledTimes(1);
			expect(onInitializeSpy).toHaveBeenCalledWith({ count: 5 });
		});

		it("should call onUpdate when state is updated via update()", async () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onUpdate: onUpdateSpy,
			});

			await store.initialize({ count: 0 });

			// When
			await store.update((state) => ({ count: state.count + 5 }));

			// Then
			expect(onUpdateSpy).toHaveBeenCalledTimes(1);
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0 }, { count: 5 });
		});

		it("should call onUpdate when state is updated via set()", async () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onUpdate: onUpdateSpy,
			});

			await store.initialize({ count: 0 });

			// When
			await store.set({ count: 42 });

			// Then
			expect(onUpdateSpy).toHaveBeenCalledTimes(1);
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0 }, { count: 42 });
		});

		it("should call onUpdate when state is updated via patch()", async () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0, name: "test" },
				onUpdate: onUpdateSpy,
			});

			await store.initialize({ count: 0, name: "test" });

			// When
			await store.patch({ count: 42 });

			// Then
			expect(onUpdateSpy).toHaveBeenCalledTimes(1);
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0, name: "test" }, { count: 42, name: "test" });
		});

		it("should call onReset when store is reset", async () => {
			// Given
			const onResetSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onReset: onResetSpy,
			});

			await store.initialize({ count: 0 });

			await store.set({ count: 100 });

			// When
			await store.reset();

			// Then
			expect(onResetSpy).toHaveBeenCalledTimes(1);
		});

		it("should call lifecycle hooks in correct order", async () => {
			// Given
			const callOrder: string[] = [];
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: () => {
					callOrder.push("initialize");
				},
				onUpdate: () => {
					callOrder.push("update");
				},
				onReset: () => {
					callOrder.push("reset");
				},
			});

			// When
			await store.initialize({ count: 0 });
			await store.update((state) => ({ count: state.count + 1 }));

			await store.set({ count: 10 });
			await store.reset();

			// Then
			expect(callOrder).toEqual(["initialize", "update", "update", "reset"]);
		});

		it("should support async lifecycle callbacks", async () => {
			// Given
			const callOrder: string[] = [];
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					callOrder.push("initialize");
				},
				onUpdate: async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					callOrder.push("update");
				},
				onReset: async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					callOrder.push("reset");
				},
			});

			// When
			await store.initialize({ count: 0 });
			await store.update((state) => ({ count: state.count + 1 }));
			await store.reset();

			// Then
			expect(callOrder).toEqual(["initialize", "update", "reset"]);
		});
	});

	describe("batch updates", () => {
		it("should apply multiple updates in a single batch", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0, name: "initial" },
			});

			await store.initialize({ count: 0, name: "initial" });

			// When
			await store.batch((api) => {
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

		it("should compute derived state only once after batch completes", async () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number }) => ({
				doubled: state.count * 2,
			}));
			const store = createServerStore({
				initial: { count: 0 },
				derive: deriveSpy,
			});

			await store.initialize({ count: 0 });
			store.read(); // Initial read
			deriveSpy.mockClear();

			// When
			await store.batch((api) => {
				api.update((state) => ({ count: state.count + 1 }));
				api.update((state) => ({ count: state.count + 1 }));
				api.update((state) => ({ count: state.count + 1 }));
			});
			store.read();

			// Then - derive should only be called once after batch, not three times
			expect(deriveSpy).toHaveBeenCalledTimes(1);
		});

		it("should call onUpdate once after batch with initial and final state", async () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0 },
				onUpdate: onUpdateSpy,
			});

			await store.initialize({ count: 0 });

			// When
			await store.batch((api) => {
				api.update((state) => ({ count: state.count + 1 }));
				api.update((state) => ({ count: state.count + 2 }));
				api.update((state) => ({ count: state.count + 3 }));
			});

			// Then
			expect(onUpdateSpy).toHaveBeenCalledTimes(1);
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0 }, { count: 6 });
		});

		it("should work with persistent storage mode", async () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { value: 0 },
			});

			await store.set({ value: 10 });

			// When
			await store.batch((api) => {
				api.update((state) => ({ value: state.value * 2 }));
				api.update((state) => ({ value: state.value + 5 }));
			});

			// Then
			expect(store.read().value).toEqual(25);
		});

		it("should support patch in batch operations", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0, name: "initial", email: "test@example.com" },
			});

			await store.initialize({ count: 0, name: "initial", email: "test@example.com" });

			// When
			await store.batch((api) => {
				api.patch({ count: 10 });
				api.patch({ name: "updated" });
			});

			// Then
			const state = store.read();
			expect(state.count).toEqual(10);
			expect(state.name).toEqual("updated");
			expect(state.email).toEqual("test@example.com");
		});
	});

	describe("patch method", () => {
		it("should partially update state", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0, name: "initial", active: false },
			});

			await store.initialize({ count: 0, name: "initial", active: false });

			// When
			await store.patch({ count: 10 });

			// Then
			const state = store.read();
			expect(state.count).toEqual(10);
			expect(state.name).toEqual("initial");
			expect(state.active).toEqual(false);
		});

		it("should update multiple properties at once", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0, name: "initial", active: false },
			});

			await store.initialize({ count: 0, name: "initial", active: false });

			// When
			await store.patch({ count: 10, name: "updated" });

			// Then
			const state = store.read();
			expect(state.count).toEqual(10);
			expect(state.name).toEqual("updated");
			expect(state.active).toEqual(false);
		});

		it("should trigger onUpdate callback", async () => {
			// Given
			const onUpdateSpy = vi.fn();
			const store = createServerStore({
				initial: { count: 0, name: "initial" },
				onUpdate: onUpdateSpy,
			});

			await store.initialize({ count: 0, name: "initial" });

			// When
			await store.patch({ count: 10 });

			// Then
			expect(onUpdateSpy).toHaveBeenCalledWith({ count: 0, name: "initial" }, { count: 10, name: "initial" });
		});

		it("should invalidate derived cache", async () => {
			// Given
			const deriveSpy = vi.fn((state: { count: number; name: string }) => ({
				description: `${state.name}: ${state.count}`,
			}));
			const store = createServerStore({
				initial: { count: 0, name: "initial" },
				derive: deriveSpy,
			});

			await store.initialize({ count: 0, name: "initial" });
			store.read();
			deriveSpy.mockClear();

			// When
			await store.patch({ count: 10 });
			store.read();

			// Then
			expect(deriveSpy).toHaveBeenCalledTimes(1);
		});

		it("should work with persistent storage mode", async () => {
			// Given
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0, name: "initial" },
			});

			await store.set({ count: 5, name: "test" });

			// When
			await store.patch({ count: 10 });

			// Then
			const state = store.read();
			expect(state.count).toEqual(10);
			expect(state.name).toEqual("test");
		});
	});

	describe("middleware", () => {
		it("should intercept state operations", async () => {
			// Given
			const middlewareSpy = vi.fn((operation) => operation.nextState);
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [middlewareSpy],
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(middlewareSpy).toHaveBeenCalledWith({
				type: "initialize",
				previousState: { count: 0 },
				nextState: { count: 5 },
			});
		});

		it("should allow middleware to transform state", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [
					(operation) => ({
						...operation.nextState,
						count: operation.nextState.count * 2,
					}),
				],
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(store.read().count).toEqual(10);
		});

		it("should chain multiple middleware in order", async () => {
			// Given
			const callOrder: string[] = [];
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [
					(operation) => {
						callOrder.push("first");
						return { ...operation.nextState, count: operation.nextState.count + 1 };
					},
					(operation) => {
						callOrder.push("second");
						return { ...operation.nextState, count: operation.nextState.count * 2 };
					},
				],
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(callOrder).toEqual(["first", "second"]);
			expect(store.read().count).toEqual(12); // (5 + 1) * 2
		});

		it("should pass correct operation type for each method", async () => {
			// Given
			const operationTypes: string[] = [];
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [
					(operation) => {
						operationTypes.push(operation.type);
						return operation.nextState;
					},
				],
			});

			// When
			await store.initialize({ count: 0 });
			await store.update((state) => ({ count: state.count + 1 }));

			await store.set({ count: 10 });
			await store.patch({ count: 20 });
			await store.reset();
			await store.batch((api) => {
				api.update((state) => ({ count: state.count + 1 }));
			});

			// Then
			expect(operationTypes).toEqual(["initialize", "update", "set", "patch", "reset", "batch"]);
		});

		it("should support async middleware", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [
					async (operation) => {
						await new Promise((resolve) => setTimeout(resolve, 10));
						return { ...operation.nextState, count: operation.nextState.count + 100 };
					},
				],
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(store.read().count).toEqual(105);
		});

		it("should apply middleware once for batch operations", async () => {
			// Given
			const middlewareSpy = vi.fn((operation) => operation.nextState);
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [middlewareSpy],
			});

			await store.initialize({ count: 0 });
			middlewareSpy.mockClear();

			// When
			await store.batch((api) => {
				api.update((state) => ({ count: state.count + 1 }));
				api.update((state) => ({ count: state.count + 2 }));
				api.update((state) => ({ count: state.count + 3 }));
			});

			// Then
			expect(middlewareSpy).toHaveBeenCalledTimes(1);
			expect(middlewareSpy).toHaveBeenCalledWith({
				type: "batch",
				previousState: { count: 0 },
				nextState: { count: 6 },
			});
		});

		it("should not call middleware when array is empty", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [],
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(store.read().count).toEqual(5);
		});

		it("should propagate middleware errors", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0 },
				middleware: [
					() => {
						throw new Error("Middleware error");
					},
				],
			});

			// When/Then
			await expect(store.initialize({ count: 5 })).rejects.toThrow("Middleware error");
		});
	});

	describe("storage adapters", () => {
		it("should read initial state from adapter", async () => {
			// Given
			const adapter = {
				read: vi.fn().mockResolvedValue({ count: 100 }),
				write: vi.fn(),
			};
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
				adapter,
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(adapter.read).toHaveBeenCalled();
		});

		it("should write state to adapter on changes", async () => {
			// Given
			const adapter = {
				read: vi.fn().mockResolvedValue(null),
				write: vi.fn(),
			};
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
				adapter,
			});

			// When
			await store.initialize({ count: 5 });

			await store.set({ count: 10 });

			// Then
			expect(adapter.write).toHaveBeenCalledWith({ count: 5 });
			expect(adapter.write).toHaveBeenCalledWith({ count: 10 });
		});

		it("should fall back to initial state when adapter returns null", async () => {
			// Given
			const adapter = {
				read: vi.fn().mockResolvedValue(null),
				write: vi.fn(),
			};
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 42 },
				adapter,
			});

			// When
			const state = store.read();

			// Then
			expect(state.count).toEqual(42);
		});

		it("should support async adapter operations", async () => {
			// Given
			let storedValue: { count: number } | null = null;
			const adapter = {
				read: async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					return storedValue;
				},
				write: async (state: { count: number }) => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					storedValue = state;
				},
			};
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
				adapter,
			});

			// When
			await store.set({ count: 100 });

			// Then
			expect(storedValue).toEqual({ count: 100 });
		});

		it("should not use adapter in request mode", async () => {
			// Given
			const adapter = {
				read: vi.fn().mockResolvedValue({ count: 100 }),
				write: vi.fn(),
			};
			const store = createServerStore({
				storage: "request",
				initial: { count: 0 },
				adapter,
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(adapter.read).not.toHaveBeenCalled();
			expect(adapter.write).not.toHaveBeenCalled();
		});

		it("should write to adapter on reset", async () => {
			// Given
			const adapter = {
				read: vi.fn().mockResolvedValue(null),
				write: vi.fn(),
			};
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
				adapter,
			});

			await store.set({ count: 100 });
			adapter.write.mockClear();

			// When
			await store.reset();

			// Then
			expect(adapter.write).toHaveBeenCalledWith({ count: 0 });
		});

		it("should write to adapter on batch", async () => {
			// Given
			const adapter = {
				read: vi.fn().mockResolvedValue(null),
				write: vi.fn(),
			};
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
				adapter,
			});

			await store.initialize({ count: 0 });
			adapter.write.mockClear();

			// When
			await store.batch((api) => {
				api.update((state) => ({ count: state.count + 5 }));
				api.update((state) => ({ count: state.count + 10 }));
			});

			// Then
			expect(adapter.write).toHaveBeenCalledTimes(1);
			expect(adapter.write).toHaveBeenCalledWith({ count: 15 });
		});

		it("should handle concurrent access to persistent instance with adapter", async () => {
			// Given
			const adapter = {
				read: vi.fn(async () => {
					await new Promise((resolve) => setTimeout(resolve, 50));
					return { count: 100 };
				}),
				write: vi.fn(),
			};
			const store = createServerStore({
				storage: "persistent",
				initial: { count: 0 },
				adapter,
			});

			// When - trigger concurrent operations that both need the cache instance
			await Promise.all([store.initialize({ count: 1 }), store.update((state) => ({ count: state.count + 10 }))]);

			// Then - adapter.read should only be called once despite concurrent access
			expect(adapter.read).toHaveBeenCalledTimes(1);
		});
	});

	describe("async callbacks", () => {
		it("should await async onInitialize", async () => {
			// Given
			let callbackCompleted = false;
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: async () => {
					await new Promise((resolve) => setTimeout(resolve, 20));
					callbackCompleted = true;
				},
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(callbackCompleted).toEqual(true);
		});

		it("should await async onUpdate", async () => {
			// Given
			let callbackCompleted = false;
			const store = createServerStore({
				initial: { count: 0 },
				onUpdate: async () => {
					await new Promise((resolve) => setTimeout(resolve, 20));
					callbackCompleted = true;
				},
			});

			await store.initialize({ count: 0 });

			// When
			await store.set({ count: 5 });

			// Then
			expect(callbackCompleted).toEqual(true);
		});

		it("should await async onReset", async () => {
			// Given
			let callbackCompleted = false;
			const store = createServerStore({
				initial: { count: 0 },
				onReset: async () => {
					await new Promise((resolve) => setTimeout(resolve, 20));
					callbackCompleted = true;
				},
			});

			await store.initialize({ count: 0 });

			// When
			await store.reset();

			// Then
			expect(callbackCompleted).toEqual(true);
		});

		it("should propagate errors from async callbacks", async () => {
			// Given
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					throw new Error("Callback error");
				},
			});

			// When/Then
			await expect(store.initialize({ count: 5 })).rejects.toThrow("Callback error");
		});

		it("should work with sync callbacks (backward compatible)", async () => {
			// Given
			let callbackCalled = false;
			const store = createServerStore({
				initial: { count: 0 },
				onInitialize: () => {
					callbackCalled = true;
				},
			});

			// When
			await store.initialize({ count: 5 });

			// Then
			expect(callbackCalled).toEqual(true);
		});
	});
});
