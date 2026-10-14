import fc from "fast-check";
import { describe, it, expect, vi, afterEach } from "vitest";

import { createServerStore } from "../src";
import type { StorageAdapter } from "../src";

import { simulateNewRequest } from "./request-scope";

// Default run counts keep `npm test` fast; PROPERTY_RUNS_MULTIPLIER=20 explores 20x more cases
const runMultiplier = Number(process.env.PROPERTY_RUNS_MULTIPLIER ?? 1);

/**
 * Scales a property's default number of runs by PROPERTY_RUNS_MULTIPLIER.
 *
 * @param defaultRuns - Runs used by a plain `npm test`
 * @returns Number of runs for this invocation
 */
function runs(defaultRuns: number): number {
	return Math.max(1, Math.round(defaultRuns * runMultiplier));
}

afterEach(() => {
	vi.restoreAllMocks();
	simulateNewRequest();
});

interface CounterState {
	count: number;
	tag: string;
	lastOperation: number;
}

type PlannedOperation =
	| { kind: "update"; amount: number; failure: "none" | "middleware" | "write" }
	| { kind: "patch"; tag: string; failure: "none" | "middleware" | "write" }
	| { kind: "set"; count: number; tag: string; failure: "none" | "middleware" | "write" }
	| { kind: "batch"; amounts: number[]; failure: "none" | "middleware" | "write" }
	| { kind: "reset" }
	| { kind: "forceHydrate" };

const INITIAL_COUNTER_STATE: CounterState = { count: 0, tag: "initial", lastOperation: -1 };

const failureArbitrary = fc.constantFrom<"none" | "middleware" | "write">("none", "none", "none", "middleware", "write");

const plannedOperationArbitrary: fc.Arbitrary<PlannedOperation> = fc.oneof(
	fc.record({ kind: fc.constant("update" as const), amount: fc.integer({ min: -5, max: 5 }), failure: failureArbitrary }),
	fc.record({ kind: fc.constant("patch" as const), tag: fc.string({ maxLength: 4 }), failure: failureArbitrary }),
	fc.record({
		kind: fc.constant("set" as const),
		count: fc.integer({ min: -50, max: 50 }),
		tag: fc.string({ maxLength: 4 }),
		failure: failureArbitrary,
	}),
	fc.record({
		kind: fc.constant("batch" as const),
		amounts: fc.array(fc.integer({ min: -3, max: 3 }), { maxLength: 4 }),
		failure: failureArbitrary,
	}),
	fc.constant({ kind: "reset" as const }),
	fc.constant({ kind: "forceHydrate" as const }),
);

/**
 * Applies one successful operation to the reference model: the plain, synchronous meaning of
 * each store method, without queues, middleware or adapters.
 *
 * @param model - Model state before the operation
 * @param operation - Operation to apply
 * @param operationIndex - Position of the operation, recorded in `lastOperation`
 * @returns Model state after the operation
 */
function applyToModel(model: CounterState, operation: PlannedOperation, operationIndex: number): CounterState {
	switch (operation.kind) {
		case "update":
			return { ...model, count: model.count + operation.amount, lastOperation: operationIndex };
		case "patch":
			return { ...model, tag: operation.tag, lastOperation: operationIndex };
		case "set":
			return { count: operation.count, tag: operation.tag, lastOperation: operationIndex };
		case "batch":
			return { ...model, count: operation.amounts.reduce((total, amount) => total + amount, model.count), lastOperation: operationIndex };
		case "reset":
			return { ...INITIAL_COUNTER_STATE };
		case "forceHydrate":
			return model;
	}
}

describe("model-based concurrency properties", () => {
	it("should match a sequential model for any operation sequence and any async interleaving", async () => {
		await fc.assert(
			fc.asyncProperty(fc.scheduler(), fc.array(plannedOperationArbitrary, { minLength: 1, maxLength: 12 }), async (scheduler, operations) => {
				// Given - every async step of the adapter, middleware and batches resolves when the scheduler says
				let storedState: CounterState | null = null;
				let onUpdateCalls = 0;
				let onResetCalls = 0;
				const failureByOperation = new Map<number, "none" | "middleware" | "write">();

				operations.forEach((operation, operationIndex) => {
					if ("failure" in operation) {
						failureByOperation.set(operationIndex, operation.failure);
					}
				});

				const adapter: StorageAdapter<CounterState> = {
					read: async () => {
						await scheduler.schedule(Promise.resolve(), "adapter.read");

						return storedState;
					},
					write: async (state) => {
						await scheduler.schedule(Promise.resolve(), "adapter.write");

						if (failureByOperation.get(state.lastOperation) === "write") {
							throw new Error(`planned write failure for operation ${state.lastOperation}`);
						}

						storedState = state;
					},
				};
				const store = createServerStore({
					storage: "persistent",
					initial: { ...INITIAL_COUNTER_STATE },
					adapter,
					middleware: [
						async (operation) => {
							await scheduler.schedule(Promise.resolve(), `middleware:${operation.type}`);

							if (failureByOperation.get(operation.nextState.lastOperation) === "middleware") {
								throw new Error(`planned middleware failure for operation ${operation.nextState.lastOperation}`);
							}

							return operation.nextState;
						},
					],
					onUpdate: () => {
						onUpdateCalls++;
					},
					onReset: () => {
						onResetCalls++;
					},
				});

				// When - all operations are issued concurrently, in plan order
				const outcomes = operations.map((operation, operationIndex) => {
					switch (operation.kind) {
						case "update":
							return store.update((state) => ({ ...state, count: state.count + operation.amount, lastOperation: operationIndex }));
						case "patch":
							return store.patch({ tag: operation.tag, lastOperation: operationIndex });
						case "set":
							return store.set({ count: operation.count, tag: operation.tag, lastOperation: operationIndex });
						case "batch":
							return store.batch(async (api) => {
								for (const amount of operation.amounts) {
									api.update((state) => ({ ...state, count: state.count + amount }));
									await scheduler.schedule(Promise.resolve(), "batch step");
								}

								api.patch({ lastOperation: operationIndex });
							});
						case "reset":
							return store.reset();
						case "forceHydrate":
							return store.hydrate({ force: true });
					}
				});
				const settledOutcomes = await scheduler.waitFor(Promise.allSettled(outcomes));

				// Then - the store equals the model built by applying successful operations in order
				let model: CounterState = { ...INITIAL_COUNTER_STATE };
				let expectedUpdates = 0;
				let expectedResets = 0;

				operations.forEach((operation, operationIndex) => {
					const succeeded = settledOutcomes[operationIndex]?.status === "fulfilled";
					const planned = failureByOperation.get(operationIndex) ?? "none";

					expect(succeeded).toEqual(planned === "none");

					if (succeeded) {
						model = applyToModel(model, operation, operationIndex);
						expectedUpdates += operation.kind === "reset" || operation.kind === "forceHydrate" ? 0 : 1;
						expectedResets += operation.kind === "reset" ? 1 : 0;
					}
				});

				expect(store.read()).toEqual(model);

				if (storedState !== null) {
					expect(storedState).toEqual(store.read());
				}

				expect(onUpdateCalls).toEqual(expectedUpdates);
				expect(onResetCalls).toEqual(expectedResets);
			}),
			{ numRuns: runs(200) },
		);
	});
});

/**
 * JSON objects produced by `JSON.parse`, so keys such as `__proto__` are own properties,
 * exactly as they would be when state comes from a request body or a cookie.
 */
const parsedJsonObjectArbitrary: fc.Arbitrary<Record<string, unknown>> = fc
	.uniqueArray(
		fc.tuple(fc.oneof(fc.string({ maxLength: 6 }), fc.constantFrom("__proto__", "constructor", "toString")), fc.jsonValue({ maxDepth: 3 })),
		{
			selector: ([key]) => key,
			maxLength: 6,
		},
	)
	.map(
		(entries) =>
			JSON.parse(`{${entries.map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`).join(",")}}`) as Record<string, unknown>,
	);

/**
 * Mutates every reachable plain object and array in place, the way careless render code would.
 *
 * @param value - Value to vandalize
 * @returns void
 */
function mutateEverythingInPlace(value: unknown): void {
	if (Array.isArray(value)) {
		value.forEach(mutateEverythingInPlace);
		value.push("mutated");

		return;
	}

	if (typeof value === "object" && value !== null) {
		Object.values(value).forEach(mutateEverythingInPlace);
		(value as Record<string, unknown>).injected = "mutated";
	}
}

describe("request isolation properties", () => {
	it("should give every request an equal but independent copy of any literal initial state", () => {
		fc.assert(
			fc.property(parsedJsonObjectArbitrary, (initialState) => {
				// Given
				const snapshotOfInitial = JSON.stringify(initialState);
				const store = createServerStore({ initial: initialState });

				// When - request 1 vandalizes everything it can reach
				const firstRequestState = store.read();

				expect(JSON.stringify(firstRequestState)).toEqual(snapshotOfInitial);
				mutateEverythingInPlace(firstRequestState);
				simulateNewRequest();

				// Then - request 2 and the configured initial state are untouched
				expect(JSON.stringify(store.read())).toEqual(snapshotOfInitial);
				expect(JSON.stringify(initialState)).toEqual(snapshotOfInitial);
				expect(Object.getPrototypeOf(store.read())).toBe(Object.prototype);
			}),
			{ numRuns: runs(300) },
		);
	});

	it("should never pollute Object.prototype through patch() with parsed JSON", async () => {
		await fc.assert(
			fc.asyncProperty(parsedJsonObjectArbitrary, parsedJsonObjectArbitrary, async (initialState, partialState) => {
				// Given
				const store = createServerStore({ initial: initialState });

				// When
				await store.patch(partialState);

				// Then
				expect(Object.getPrototypeOf(store.read())).toBe(Object.prototype);
				expect(Object.keys(Object.prototype)).toEqual([]);
				expect(({} as Record<string, unknown>).injected).toEqual(undefined);
			}),
			{ numRuns: runs(300) },
		);
	});
});

describe("patch() properties", () => {
	it("should equal a shallow merge and report a change exactly when some value differs", async () => {
		await fc.assert(
			fc.asyncProperty(parsedJsonObjectArbitrary, fc.boolean(), async (initialState, reuseValues) => {
				// Given - half the time the partial reuses the current values, which must be a no-op
				const onUpdate = vi.fn();
				const store = createServerStore({ storage: "persistent", initial: initialState, onUpdate });
				const currentState = store.read();
				const partialState: Record<string, unknown> = reuseValues ? { ...currentState } : { ...currentState, extraKey: Math.random() };
				const expectedChange = Object.keys(partialState).some(
					(key) => !(key in currentState) || !Object.is(currentState[key], partialState[key]),
				);

				// When
				await store.patch(partialState);

				// Then
				expect(store.read()).toEqual({ ...currentState, ...partialState });
				expect(onUpdate).toHaveBeenCalledTimes(expectedChange ? 1 : 0);
				expect(store.read() === currentState).toEqual(!expectedChange);
			}),
			{ numRuns: runs(300) },
		);
	});
});

describe("state validation properties", () => {
	it("should reject every non-object state and keep the previous state", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.oneof(
					fc.constant(null),
					fc.constant(undefined),
					fc.string(),
					fc.double(),
					fc.boolean(),
					fc.bigInt(),
					fc.constant(Symbol("state")),
				),
				async (invalidState) => {
					// Given
					const store = createServerStore({ storage: "persistent", initial: { count: 1 } });
					const previousState = store.read();

					// When
					const outcome = store.set(invalidState as unknown as { count: number });

					// Then
					await expect(outcome).rejects.toThrow(TypeError);
					expect(store.read()).toBe(previousState);
				},
			),
			{ numRuns: runs(200) },
		);
	});
});

describe("read() properties", () => {
	it("should return a stable reference until the state changes", async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(fc.integer(), { maxLength: 8 }), fc.integer(), async (items, appendedItem) => {
				// Given
				const store = createServerStore({
					storage: "persistent",
					initial: { items },
					derive: (state) => ({ total: state.items.reduce((sum, item) => sum + item, 0) }),
				});
				const firstRead = store.read();

				// When
				const secondRead = store.read();
				await store.update((state) => ({ items: [...state.items, appendedItem] }));
				const afterUpdate = store.read();

				// Then
				expect(secondRead).toBe(firstRead);
				expect(afterUpdate).not.toBe(firstRead);
				expect(afterUpdate.total).toEqual(items.reduce((sum, item) => sum + item, 0) + appendedItem);
			}),
			{ numRuns: runs(200) },
		);
	});
});
