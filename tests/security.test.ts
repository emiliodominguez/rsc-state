import { describe, it, expect, vi, afterEach } from "vitest";

import { createServerStore } from "../src";
import type { StorageAdapter } from "../src";

import { simulateNewRequest } from "./request-scope";

afterEach(() => {
	vi.restoreAllMocks();
	simulateNewRequest();
});

describe("cross-request isolation", () => {
	it("should not leak in-place mutations of nested initial state into the next request", () => {
		// Given
		const cartStore = createServerStore({ initial: { items: [] as string[] } });

		// When - request 1 mutates what read() returned instead of calling update()
		try {
			cartStore.read().items.push("request-1-secret");
		} catch {
			// Rejecting the mutation is an acceptable outcome
		}

		simulateNewRequest();

		// Then - request 2 must start from a clean initial state
		expect(cartStore.read().items).toEqual([]);
	});

	it("should not leak in-place mutations of top-level initial state into the next request", () => {
		// Given
		const sessionStore = createServerStore({ initial: { userId: null as string | null } });

		// When
		try {
			(sessionStore.read() as { userId: string | null }).userId = "request-1-user";
		} catch {
			// Rejecting the mutation is an acceptable outcome
		}

		simulateNewRequest();

		// Then
		expect(sessionStore.read().userId).toEqual(null);
	});

	it("should not leak through reset() after an in-place mutation", async () => {
		// Given
		const store = createServerStore({ initial: { roles: ["guest"] } });

		// When
		await store.initialize({ roles: ["admin"] });
		await store.reset();

		try {
			store.read().roles.push("admin");
		} catch {
			// Rejecting the mutation is an acceptable outcome
		}

		simulateNewRequest();

		// Then
		expect(store.read().roles).toEqual(["guest"]);
	});
});

describe("prototype pollution", () => {
	it("should not pollute Object.prototype through patch() with a JSON payload", async () => {
		// Given
		const store = createServerStore({ initial: { name: "" } });
		const payload = JSON.parse('{"__proto__": {"polluted": true}, "name": "attacker"}') as { name: string };

		// When
		await store.patch(payload);

		// Then
		expect(({} as Record<string, unknown>).polluted).toEqual(undefined);
	});

	it("should not pollute Object.prototype through initialize() and batch()", async () => {
		// Given
		const store = createServerStore({ initial: { name: "" } });
		const payload = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "name": "x"}') as {
			name: string;
		};

		// When
		await store.initialize(payload);
		await store.batch((api) => {
			api.patch(payload);
		});

		// Then
		expect(({} as Record<string, unknown>).polluted).toEqual(undefined);
	});
});

describe("invalid state", () => {
	it("should reject null passed to initialize() and keep the previous state", async () => {
		// Given
		const store = createServerStore({ initial: { userId: null as string | null } });

		// When
		const result = store.initialize(JSON.parse("null") as { userId: string | null });

		// Then
		await expect(result).rejects.toThrow(TypeError);
		expect(store.read()).toEqual({ userId: null });
	});

	it("should reject a primitive returned by update()", async () => {
		// Given
		const store = createServerStore({ initial: { count: 0 } });

		// When
		const result = store.update(() => "corrupted" as unknown as { count: number });

		// Then
		await expect(result).rejects.toThrow(TypeError);
		expect(store.read().count).toEqual(0);
	});

	it("should reject a primitive returned by middleware", async () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
			middleware: [() => 42 as unknown as { count: number }],
		});

		// When
		const result = store.patch({ count: 1 });

		// Then
		await expect(result).rejects.toThrow(TypeError);
		expect(store.read().count).toEqual(0);
	});

	it("should reject a corrupted value read from the adapter", async () => {
		// Given
		const adapter: StorageAdapter<{ theme: string }> = {
			read: () => "corrupted" as unknown as { theme: string },
			write: vi.fn(),
		};
		const store = createServerStore({ storage: "persistent", initial: { theme: "light" }, adapter });

		// When
		const result = store.hydrate();

		// Then
		await expect(result).rejects.toThrow(TypeError);
		expect(store.read().theme).toEqual("light");
	});
});

describe("derived access checks", () => {
	it("should fail closed when a derived access flag throws and throwOnDeriveError is enabled", async () => {
		// Given
		const store = createServerStore({
			initial: { role: "user" as string, permissions: null as string[] | null },
			derive: (state) => ({ canDeleteUsers: state.permissions!.includes("users:delete") }),
			throwOnDeriveError: true,
			onError: vi.fn(),
		});

		// When
		const readAccessFlag = (): unknown => store.read().canDeleteUsers;

		// Then
		expect(readAccessFlag).toThrow(TypeError);
	});
});

describe("hostile payloads", () => {
	it("should accept deeply nested state without overflowing the stack", async () => {
		// Given
		const store = createServerStore({ initial: { payload: {} as unknown } });
		const depth = 100_000;
		const deeplyNested = JSON.parse("[".repeat(depth) + "]".repeat(depth)) as unknown;

		// When
		await store.patch({ payload: deeplyNested });

		// Then
		expect(store.read().payload).toBe(deeplyNested);
	});
});

describe("per-instance copies of a literal initial state", () => {
	it("should give each request its own copy of nested initial data", () => {
		// Given
		const initialState = { items: [{ id: 1 }] };
		const store = createServerStore({ initial: initialState });

		// When
		const firstRequestItems = store.read().items;
		simulateNewRequest();
		const secondRequestItems = store.read().items;

		// Then
		expect(firstRequestItems).not.toBe(secondRequestItems);
		expect(firstRequestItems).not.toBe(initialState.items);
		expect(secondRequestItems).toEqual([{ id: 1 }]);
	});

	it("should restore a fresh copy on reset() after an in-place mutation", async () => {
		// Given
		const store = createServerStore({ storage: "persistent", initial: { tags: ["default"] } });
		store.read().tags.push("mutated-in-place");

		// When
		await store.reset();

		// Then
		expect(store.read().tags).toEqual(["default"]);
	});

	it("should keep a JSON-sourced __proto__ key as an own property without changing the prototype", () => {
		// Given
		const initialState = JSON.parse('{"__proto__": {"isAdmin": true}, "name": "guest"}') as { name: string };
		const store = createServerStore({ initial: initialState });

		// When
		const state = store.read() as Record<string, unknown>;

		// Then
		expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
		expect(state.isAdmin).toEqual(undefined);
		expect(Object.prototype.hasOwnProperty.call(state, "__proto__")).toEqual(true);
	});

	it("should copy accessor properties without invoking them", () => {
		// Given
		const getter = vi.fn(() => "secret");
		const initialState = Object.defineProperty({ name: "guest" }, "token", { get: getter, enumerable: true, configurable: true });
		const store = createServerStore({ initial: initialState });

		// When
		store.read();

		// Then
		expect(getter).not.toHaveBeenCalled();
	});

	it("should preserve cycles in the initial state", () => {
		// Given
		const node: { name: string; self?: unknown } = { name: "root" };
		node.self = node;
		const store = createServerStore({ initial: { node } });

		// When
		const copiedNode = store.read().node;

		// Then
		expect(copiedNode).not.toBe(node);
		expect(copiedNode.self).toBe(copiedNode);
	});

	it("should share class instances by reference", () => {
		// Given
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const createdAt = new Date(0);
		const store = createServerStore({ initial: { createdAt } });

		// When
		const state = store.read();

		// Then
		expect(state.createdAt).toBe(createdAt);
	});
});

describe("shared mutable containers in literal initial state", () => {
	it("should warn when a request-scoped literal initial state contains a Map", () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		// When
		createServerStore({ initial: { sessions: new Map<string, string>() } });

		// Then
		expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("initial.sessions"));
	});

	it("should not warn when the initial state is a factory", () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		// When
		createServerStore({ initial: () => ({ sessions: new Map<string, string>() }) });

		// Then
		expect(consoleWarn).not.toHaveBeenCalled();
	});

	it("should not warn for persistent stores, which are shared by design", () => {
		// Given
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		// When
		createServerStore({ storage: "persistent", initial: { sessions: new Map<string, string>() } });

		// Then
		expect(consoleWarn).not.toHaveBeenCalled();
	});
});

describe("persistent registry across library versions", () => {
	it("should ignore keyed instances registered by an incompatible library version", async () => {
		// Given - what rsc-state 1.1.0 registers under its unversioned registry key
		const legacyRegistry = new Map<string, unknown>([
			["shared-across-versions", { state: { role: "admin" }, hydrated: true, pendingMutation: null }],
		]);
		(globalThis as Record<symbol, unknown>)[Symbol.for("rsc-state.persistent-instances")] = legacyRegistry;
		const store = createServerStore({
			storage: "persistent",
			key: "shared-across-versions",
			initial: { role: "user" },
			adapter: { read: () => null, write: vi.fn() },
		});

		// When
		const state = await store.hydrate({ force: true });

		// Then
		expect(state.role).toEqual("user");
	});

	it("should keep the registry schema version in sync with the instance shape", () => {
		// Given
		createServerStore({ storage: "persistent", key: "schema-guard", initial: { count: 0 } }).read();
		const registry = (globalThis as Record<symbol, Map<string, object> | undefined>)[Symbol.for("rsc-state.persistent-instances.v2")];

		// When
		const instanceFields = Object.keys(registry?.get("schema-guard") ?? {}).sort();

		// Then - if this fails, the instance shape changed: bump STORE_INSTANCE_SCHEMA_VERSION and update this list
		expect(instanceFields).toEqual([
			"deriveError",
			"derivedBy",
			"derivedSourceState",
			"fullState",
			"hydrated",
			"initialized",
			"pendingHydration",
			"pendingMutation",
			"queuedForcedHydration",
			"state",
		]);
	});
});

describe("hostile values thrown from derive", () => {
	it("should keep read() non-throwing when derive throws a null-prototype object", () => {
		// Given
		const thrownValue: unknown = Object.create(null);
		const onError = vi.fn();
		const store = createServerStore({
			initial: { count: 0 },
			derive: (): { doubled: number } => {
				throw thrownValue;
			},
			onError,
		});

		// When
		const state = store.read();

		// Then
		expect(state.count).toEqual(0);
		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ cause: thrownValue }), expect.anything());
	});

	it("should keep read() non-throwing when derive throws a value whose toString throws", () => {
		// Given
		const store = createServerStore({
			initial: { count: 0 },
			derive: (): { doubled: number } => {
				throw {
					toString(): string {
						throw new Error("toString exploded");
					},
				};
			},
			onError: vi.fn(),
		});

		// When
		const readState = (): unknown => store.read();

		// Then
		expect(readState).not.toThrow();
	});
});
