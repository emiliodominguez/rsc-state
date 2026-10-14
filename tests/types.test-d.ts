import { describe, expectTypeOf, it } from "vitest";

import { createServerStore } from "../src";
import type { InferStoreState, ServerStore } from "../src";

describe("type inference", () => {
	it("should infer base state without a derive function", () => {
		const store = createServerStore({ initial: { count: 0, label: "counter" } });

		expectTypeOf(store.read()).toEqualTypeOf<{ count: number; label: string }>();
		expectTypeOf(store.read().count).toEqualTypeOf<number>();
	});

	it("should merge the inferred derive return type into read()", () => {
		const store = createServerStore({
			initial: { userId: null as string | null },
			derive: (state) => ({ isAuthenticated: state.userId !== null }),
		});

		expectTypeOf(store.read().userId).toEqualTypeOf<string | null>();
		expectTypeOf(store.read().isAuthenticated).toEqualTypeOf<boolean>();
		expectTypeOf(store.select((state) => state.isAuthenticated)).toEqualTypeOf<boolean>();
	});

	it("should keep derived properties typed through hydrate()", () => {
		const store = createServerStore({
			storage: "persistent",
			initial: { theme: "light" as "light" | "dark" },
			derive: (state) => ({ isDarkMode: state.theme === "dark" }),
		});

		expectTypeOf(store.hydrate()).resolves.toHaveProperty("isDarkMode").toEqualTypeOf<boolean>();
	});

	it("should infer state from a factory function", () => {
		const store = createServerStore({ initial: () => ({ createdAt: Date.now() }) });

		expectTypeOf(store.read().createdAt).toEqualTypeOf<number>();
	});

	it("should accept interfaces as state types", () => {
		interface Settings {
			theme: "light" | "dark";
			volume: number;
		}

		const store = createServerStore<Settings>({ initial: { theme: "light", volume: 50 } });

		expectTypeOf(store).toEqualTypeOf<ServerStore<Settings>>();
	});

	it("should reject unknown keys in patch()", () => {
		const store = createServerStore({ initial: { userName: "" } });

		// @ts-expect-error - unknown key
		void store.patch({ invalidKey: "value" });
	});

	it("should type the batch draft API", () => {
		const store = createServerStore({ initial: { count: 0 } });

		void store.batch(async (api) => {
			expectTypeOf(api.read()).toEqualTypeOf<{ count: number }>();
			await Promise.resolve();
		});
	});

	it("should extract the full state with InferStoreState", () => {
		const store = createServerStore({
			initial: { count: 0 },
			derive: (state) => ({ doubled: state.count * 2 }),
		});

		expectTypeOf<InferStoreState<typeof store>>().toEqualTypeOf<{ count: number } & { doubled: number }>();
	});
});
