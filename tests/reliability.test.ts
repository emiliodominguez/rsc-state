import { describe, it, expect, vi, afterEach } from "vitest";

import { createServerStore } from "../src";
import type { Middleware, StorageAdapter } from "../src";

import { simulateMissingRequestScope, simulateNewRequest } from "./request-scope";

/**
 * Resolves after the given number of milliseconds.
 *
 * @param milliseconds - Delay duration
 * @returns Promise resolving after the delay
 */
function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Creates an in-memory adapter with spies and optional latency.
 *
 * @param storedState - Initial stored value
 * @param latencyInMilliseconds - Simulated latency for reads and writes
 * @returns Adapter plus accessor for the stored value
 */
function createMemoryAdapter<T>(storedState: T | null, latencyInMilliseconds = 0) {
	let currentValue = storedState;

	const adapter = {
		read: vi.fn(async (): Promise<T | null> => {
			await delay(latencyInMilliseconds);

			return currentValue;
		}),
		write: vi.fn(async (state: T): Promise<void> => {
			await delay(latencyInMilliseconds);
			currentValue = state;
		}),
	} satisfies StorageAdapter<T>;

	return {
		adapter,
		getStoredValue(): T | null {
			return currentValue;
		},
		setStoredValue(value: T | null): void {
			currentValue = value;
		},
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("request isolation", () => {
	it("should give each request a fresh request-scoped state", async () => {
		// Given
		const store = createServerStore({ initial: { userId: null as string | null } });
		await store.initialize({ userId: "user-1" });

		// When
		simulateNewRequest();

		// Then
		expect(store.read().userId).toEqual(null);
	});

	it("should share persistent state across requests", async () => {
		// Given
		const store = createServerStore({ storage: "persistent", initial: { visits: 0 } });
		await store.patch({ visits: 1 });

		// When
		simulateNewRequest();

		// Then
		expect(store.read().visits).toEqual(1);
	});

	it("should call the initial factory once per request", () => {
		// Given
		const factory = vi.fn(() => ({ requestedAt: Math.random() }));
		const store = createServerStore({ initial: factory });

		// When
		store.read();
		store.read();
		simulateNewRequest();
		store.read();

		// Then
		expect(factory).toHaveBeenCalledTimes(2);
	});
});

describe("read performance guarantees", () => {
	it("should return the same reference across reads while state is unchanged", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 1 },
			derive: (state) => ({ doubled: state.count * 2 }),
		});
		await store.initialize({ count: 2 });

		// When
		const firstRead = store.read();
		const secondRead = store.read();

		// Then
		expect(firstRead).toBe(secondRead);
	});

	it("should return a new reference after state changes", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 1 },
			derive: (state) => ({ doubled: state.count * 2 }),
		});
		const before = store.read();

		// When
		await store.patch({ count: 5 });
		const after = store.read();

		// Then
		expect(after).not.toBe(before);
		expect(after.doubled).toEqual(10);
	});

	it("should return the base state reference when no derive function is configured", async () => {
		// Given
		const store = createServerStore({ initial: { count: 0 } });
		const nextState = { count: 3 };

		// When
		await store.set(nextState);

		// Then
		expect(store.read()).toBe(nextState);
	});

	it("should report a failing derive once per state instead of on every read", async () => {
		// Given
		const onError = vi.fn();
		const store = createServerStore({
			initial: { value: null as string | null },
			derive: (state) => ({ length: state.value!.length }),
			onError,
		});

		// When
		store.read();
		store.read();
		store.read();

		// Then
		expect(onError).toHaveBeenCalledTimes(1);
	});

	it("should commit synchronously when nothing needs to be awaited", () => {
		// Given
		const store = createServerStore({ initial: { count: 0 } });

		// When
		void store.patch({ count: 7 });

		// Then
		expect(store.read().count).toEqual(7);
	});
});

describe("onError robustness", () => {
	it("should log instead of throwing when onError throws synchronously", () => {
		// Given
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const store = createServerStore({
			initial: { value: null as string | null },
			derive: (state) => ({ length: state.value!.length }),
			onError: () => {
				throw new Error("reporter down");
			},
		});

		// When
		const state = store.read();

		// Then
		expect(state.value).toEqual(null);
		expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("onError callback failed"), expect.any(Error));
	});

	it("should log rejected async onError callbacks instead of leaking unhandled rejections", async () => {
		// Given
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const store = createServerStore({
			initial: { value: null as string | null },
			derive: (state) => ({ length: state.value!.length }),
			onError: async () => {
				await Promise.resolve();
				throw new Error("reporter down");
			},
		});

		// When
		store.read();
		await delay(0);

		// Then
		expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("onError callback failed"), expect.any(Error));
	});
});

describe("no-op transitions", () => {
	it("should skip middleware, adapter and onUpdate when update returns the same reference", async () => {
		// Given
		const { adapter } = createMemoryAdapter<{ count: number }>(null);
		const middleware = vi.fn<Middleware<{ count: number }>>((operation) => operation.nextState);
		const onUpdate = vi.fn();
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter, middleware: [middleware], onUpdate });

		// When
		await store.update((state) => state);

		// Then
		expect(middleware).not.toHaveBeenCalled();
		expect(adapter.write).not.toHaveBeenCalled();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("should treat a patch with identical values as a no-op", async () => {
		// Given
		const onUpdate = vi.fn();
		const store = createServerStore({ initial: { count: 1, label: "a" }, onUpdate });
		await store.initialize({ count: 1, label: "a" });
		const before = store.read();

		// When
		await store.patch({ count: 1, label: "a" });

		// Then
		expect(onUpdate).not.toHaveBeenCalled();
		expect(store.read()).toBe(before);
	});

	it("should apply a patch that adds a key missing from the current state", async () => {
		// Given
		const store = createServerStore({ initial: { label: "a" } as { label: string; note?: string } });

		// When
		await store.patch({ note: undefined });

		// Then
		expect(store.read()).toHaveProperty("note");
	});

	it("should skip onUpdate when a batch makes no changes", async () => {
		// Given
		const onUpdate = vi.fn();
		const store = createServerStore({ initial: { count: 0 }, onUpdate });

		// When
		await store.batch((api) => {
			api.patch({ count: 0 });
		});

		// Then
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("should always run initialize and reset even when state is unchanged", async () => {
		// Given
		const initialState = { count: 0 };
		const onInitialize = vi.fn();
		const onReset = vi.fn();
		const store = createServerStore({ initial: initialState, onInitialize, onReset });

		// When
		await store.initialize(initialState);
		await store.reset();

		// Then
		expect(onInitialize).toHaveBeenCalledTimes(1);
		expect(onReset).toHaveBeenCalledWith(initialState, initialState);
	});
});

describe("middleware guarantees", () => {
	it("should let middleware veto a transition by returning previousState", async () => {
		// Given
		const onUpdate = vi.fn();
		const store = createServerStore({
			initial: { volume: 50 },
			middleware: [(operation) => (operation.nextState.volume > 100 ? operation.previousState : operation.nextState)],
			onUpdate,
		});

		// When
		await store.patch({ volume: 150 });

		// Then
		expect(store.read().volume).toEqual(50);
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("should reject middleware that returns undefined and keep state unchanged", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
			middleware: [(() => undefined) as unknown as Middleware<{ count: number }>],
		});

		// When
		const result = store.patch({ count: 1 });

		// Then
		await expect(result).rejects.toThrow(/Middleware at index 0 returned undefined/);
		expect(store.read().count).toEqual(0);
	});

	it("should keep the mutation queue usable after a middleware error", async () => {
		// Given
		let shouldFail = true;
		const store = createServerStore({
			initial: { count: 0 },
			middleware: [
				(operation) => {
					if (shouldFail) {
						throw new Error("validation failed");
					}

					return operation.nextState;
				},
			],
		});
		await expect(store.patch({ count: 1 })).rejects.toThrow("validation failed");

		// When
		shouldFail = false;
		await store.patch({ count: 2 });

		// Then
		expect(store.read().count).toEqual(2);
	});
});

describe("concurrency", () => {
	it("should not lose updates when concurrent mutations use async middleware", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
			middleware: [
				async (operation) => {
					await delay(1);

					return operation.nextState;
				},
			],
		});

		// When
		await Promise.all(Array.from({ length: 10 }, () => store.update((state) => ({ count: state.count + 1 }))));

		// Then
		expect(store.read().count).toEqual(10);
	});

	it("should write to the adapter in mutation order", async () => {
		// Given
		const { adapter, getStoredValue } = createMemoryAdapter<{ step: number }>(null, 2);
		const store = createServerStore({ storage: "persistent", initial: { step: 0 }, adapter });

		// When
		await Promise.all([store.set({ step: 1 }), store.set({ step: 2 }), store.set({ step: 3 })]);

		// Then
		expect(adapter.write.mock.calls.map(([state]) => state.step)).toEqual([1, 2, 3]);
		expect(getStoredValue()).toEqual({ step: 3 });
	});

	it("should allow lifecycle callbacks to mutate the same store without deadlocking", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0, lastChangedAt: 0 },
			onUpdate: async (previousState, nextState) => {
				if (previousState.count !== nextState.count) {
					await store.patch({ lastChangedAt: 42 });
				}
			},
		});

		// When
		await store.patch({ count: 1 });

		// Then
		expect(store.read()).toEqual({ count: 1, lastChangedAt: 42 });
	});
});

describe("storage adapter consistency", () => {
	it("should keep in-memory state unchanged when the adapter write fails", async () => {
		// Given
		const adapter: StorageAdapter<{ count: number }> = {
			read: () => null,
			write: () => {
				throw new Error("disk full");
			},
		};
		const onUpdate = vi.fn();
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter, onUpdate });

		// When
		const result = store.patch({ count: 1 });

		// Then
		await expect(result).rejects.toThrow("disk full");
		expect(store.read().count).toEqual(0);
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("should treat an undefined adapter result as empty storage", async () => {
		// Given
		const store = createServerStore({
			storage: "persistent",
			initial: { count: 5 },
			adapter: { read: () => undefined, write: vi.fn() },
		});

		// When
		const state = await store.hydrate();

		// Then
		expect(state.count).toEqual(5);
	});

	it("should ignore the adapter and warn in request mode when debug is enabled", () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		// When
		createServerStore({ debug: true, initial: { count: 0 }, adapter: { read: () => null, write: vi.fn() } });

		// Then
		expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('ignored in "request" mode'));
	});
});

describe("hydrate", () => {
	it("should load adapter state and return it with derived properties", async () => {
		// Given
		const { adapter } = createMemoryAdapter({ theme: "dark" }, 1);
		const store = createServerStore({
			storage: "persistent",
			initial: { theme: "light" },
			adapter,
			derive: (state) => ({ isDarkMode: state.theme === "dark" }),
		});

		// When
		const state = await store.hydrate();

		// Then
		expect(state).toEqual({ theme: "dark", isDarkMode: true });
		expect(store.read()).toBe(state);
	});

	it("should still hydrate on the first mutation when read() was called first", async () => {
		// Given
		const { adapter } = createMemoryAdapter({ count: 100 });
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter });
		const beforeHydration = store.read();

		// When
		await store.update((state) => ({ count: state.count + 1 }));

		// Then
		expect(beforeHydration.count).toEqual(0);
		expect(store.read().count).toEqual(101);
	});

	it("should share a single adapter read between concurrent callers", async () => {
		// Given
		const { adapter } = createMemoryAdapter({ count: 1 }, 5);
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter });

		// When
		await Promise.all([store.hydrate(), store.hydrate(), store.patch({ count: 2 })]);

		// Then
		expect(adapter.read).toHaveBeenCalledTimes(1);
		expect(store.read().count).toEqual(2);
	});

	it("should not read the adapter again once hydrated", async () => {
		// Given
		const { adapter } = createMemoryAdapter({ count: 1 });
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter });

		// When
		await store.hydrate();
		await store.hydrate();

		// Then
		expect(adapter.read).toHaveBeenCalledTimes(1);
	});

	it("should retry hydration after a failed adapter read", async () => {
		// Given
		const read = vi.fn().mockRejectedValueOnce(new Error("connection reset")).mockResolvedValueOnce({ count: 9 });
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter: { read, write: vi.fn() } });
		await expect(store.hydrate()).rejects.toThrow("connection reset");

		// When
		const state = await store.hydrate();

		// Then
		expect(state.count).toEqual(9);
		expect(read).toHaveBeenCalledTimes(2);
	});

	it("should re-read the adapter when force is set", async () => {
		// Given
		const { adapter, setStoredValue } = createMemoryAdapter({ count: 1 });
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter });
		await store.hydrate();

		// When
		setStoredValue({ count: 50 });
		const state = await store.hydrate({ force: true });

		// Then
		expect(state.count).toEqual(50);
		expect(adapter.read).toHaveBeenCalledTimes(2);
	});

	it("should wait for in-flight mutations before a forced re-read", async () => {
		// Given
		const { adapter } = createMemoryAdapter<{ count: number }>(null, 2);
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter });

		// When
		const pendingMutation = store.set({ count: 3 });
		const state = await store.hydrate({ force: true });
		await pendingMutation;

		// Then
		expect(state.count).toEqual(3);
	});

	it("should resolve immediately with current state for request-scoped stores", async () => {
		// Given
		const store = createServerStore({ initial: { count: 0 } });
		await store.initialize({ count: 4 });

		// When
		const state = await store.hydrate();

		// Then
		expect(state.count).toEqual(4);
	});

	it("should warn when reading an adapter-backed store before hydration with debug enabled", () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const store = createServerStore({
			debug: true,
			storage: "persistent",
			initial: { count: 0 },
			adapter: { read: () => null, write: vi.fn() },
		});

		// When
		store.read();

		// Then
		expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("before hydrate()"));
	});
});

describe("transactional batch", () => {
	it("should support async batch callbacks", async () => {
		// Given
		const store = createServerStore({ initial: { productId: "a", price: 0 } });

		// When
		await store.batch(async (api) => {
			await delay(1);
			api.patch({ price: api.read().productId === "a" ? 10 : 0 });
		});

		// Then
		expect(store.read().price).toEqual(10);
	});

	it("should expose the draft through api.read()", async () => {
		// Given
		const draftSnapshots: number[] = [];
		const store = createServerStore({ initial: { count: 0 } });

		// When
		await store.batch((api) => {
			api.patch({ count: 1 });
			draftSnapshots.push(api.read().count, store.read().count);
		});

		// Then
		expect(draftSnapshots).toEqual([1, 0]);
	});

	it("should roll back when the batch callback throws", async () => {
		// Given
		const { adapter } = createMemoryAdapter<{ count: number }>(null);
		const onUpdate = vi.fn();
		const store = createServerStore({ storage: "persistent", initial: { count: 0 }, adapter, onUpdate });

		// When
		const result = store.batch(async (api) => {
			api.patch({ count: 99 });
			await delay(1);
			throw new Error("price service unavailable");
		});

		// Then
		await expect(result).rejects.toThrow("price service unavailable");
		expect(store.read().count).toEqual(0);
		expect(adapter.write).not.toHaveBeenCalled();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("should reject batch API calls made after the callback settled", async () => {
		// Given
		const store = createServerStore({ initial: { count: 0 } });
		let leakedApi: { patch(partialState: { count?: number }): void } | null = null;

		// When
		await store.batch((api) => {
			leakedApi = api;
		});

		// Then
		expect(() => leakedApi?.patch({ count: 1 })).toThrow(/after the batch callback settled/);
		expect(store.read().count).toEqual(0);
	});
});

describe("request scope detection", () => {
	afterEach(() => {
		simulateNewRequest();
	});

	it("should warn once when request-scoped state cannot be kept outside a render", async () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const store = createServerStore({ initial: { count: 0 } });
		simulateMissingRequestScope();

		// When
		await store.patch({ count: 1 });
		await store.patch({ count: 2 });

		// Then
		expect(consoleWarn).toHaveBeenCalledTimes(1);
		expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("React cache() is not active"));
	});

	it("should not warn inside a request scope", async () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const store = createServerStore({ initial: { count: 0 } });

		// When
		await store.patch({ count: 1 });

		// Then
		expect(consoleWarn).not.toHaveBeenCalled();
	});

	it("should not warn for persistent stores outside a request scope", async () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const store = createServerStore({ storage: "persistent", initial: { count: 0 } });
		simulateMissingRequestScope();

		// When
		await store.patch({ count: 1 });

		// Then
		expect(consoleWarn).not.toHaveBeenCalled();
		expect(store.read().count).toEqual(1);
	});
});

describe("keyed persistent stores", () => {
	it("should share state between store definitions with the same key", async () => {
		// Given
		const firstDefinition = createServerStore({ storage: "persistent", key: "shared-counter", initial: { count: 0 } });
		const secondDefinition = createServerStore({ storage: "persistent", key: "shared-counter", initial: { count: 0 } });

		// When
		await firstDefinition.patch({ count: 5 });

		// Then
		expect(secondDefinition.read().count).toEqual(5);
	});

	it("should isolate stores with different keys", async () => {
		// Given
		const firstStore = createServerStore({ storage: "persistent", key: "isolated-a", initial: { count: 0 } });
		const secondStore = createServerStore({ storage: "persistent", key: "isolated-b", initial: { count: 0 } });

		// When
		await firstStore.patch({ count: 5 });

		// Then
		expect(secondStore.read().count).toEqual(0);
	});

	it("should recompute derived state when a redefined store changes its derive function", async () => {
		// Given
		const originalDefinition = createServerStore({
			storage: "persistent",
			key: "hot-reloaded",
			initial: { count: 2 },
			derive: (state) => ({ scaled: state.count * 2 }),
		});
		originalDefinition.read();

		// When
		const reloadedDefinition = createServerStore({
			storage: "persistent",
			key: "hot-reloaded",
			initial: { count: 2 },
			derive: (state) => ({ scaled: state.count * 10 }),
		});

		// Then
		expect(reloadedDefinition.read().scaled).toEqual(20);
	});

	it("should share one adapter read between definitions with the same key", async () => {
		// Given
		const { adapter } = createMemoryAdapter({ count: 7 }, 2);
		const firstDefinition = createServerStore({ storage: "persistent", key: "shared-hydration", initial: { count: 0 }, adapter });
		const secondDefinition = createServerStore({ storage: "persistent", key: "shared-hydration", initial: { count: 0 }, adapter });

		// When
		const [firstState, secondState] = await Promise.all([firstDefinition.hydrate(), secondDefinition.hydrate()]);

		// Then
		expect(adapter.read).toHaveBeenCalledTimes(1);
		expect(firstState.count).toEqual(7);
		expect(secondState.count).toEqual(7);
	});

	it("should serialize mutations across definitions with the same key", async () => {
		// Given
		const slowMiddleware: Middleware<{ count: number }> = async (operation) => {
			await delay(1);

			return operation.nextState;
		};
		const firstDefinition = createServerStore({
			storage: "persistent",
			key: "shared-queue",
			initial: { count: 0 },
			middleware: [slowMiddleware],
		});
		const secondDefinition = createServerStore({
			storage: "persistent",
			key: "shared-queue",
			initial: { count: 0 },
			middleware: [slowMiddleware],
		});

		// When
		await Promise.all([
			firstDefinition.update((state) => ({ count: state.count + 1 })),
			secondDefinition.update((state) => ({ count: state.count + 1 })),
		]);

		// Then
		expect(firstDefinition.read().count).toEqual(2);
	});
});
