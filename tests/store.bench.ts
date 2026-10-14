import { bench, describe } from "vitest";

import { createServerStore } from "../src";

interface CartItem {
	productId: string;
	quantity: number;
	pricePerUnit: number;
}

/**
 * Builds a cart with enough items to make the derive function measurably expensive,
 * so memoization effects are visible in the benchmark results.
 *
 * @param itemCount - Number of cart items to generate
 * @returns Array of generated cart items
 */
function createCartItems(itemCount: number): CartItem[] {
	return Array.from({ length: itemCount }, (_, index) => ({
		productId: `product-${index}`,
		quantity: (index % 5) + 1,
		pricePerUnit: index * 1.5,
	}));
}

const cartStore = createServerStore({
	storage: "persistent",
	initial: { items: createCartItems(200), couponCode: null as string | null },
	derive: (state) => ({
		itemCount: state.items.reduce((total, item) => total + item.quantity, 0),
		subtotal: state.items.reduce((total, item) => total + item.quantity * item.pricePerUnit, 0),
		hasCoupon: state.couponCode !== null,
	}),
});

const plainStore = createServerStore({
	storage: "persistent",
	initial: { count: 0, label: "counter" },
});

describe("read", () => {
	bench("read() with memoized derived state", () => {
		cartStore.read();
	});

	bench("select() with memoized derived state", () => {
		cartStore.select((state) => state.subtotal);
	});

	bench("read() without derive", () => {
		plainStore.read();
	});
});

describe("write", () => {
	bench("update()", async () => {
		await plainStore.update((state) => ({ ...state, count: state.count + 1 }));
	});

	bench("patch()", async () => {
		await plainStore.patch({ count: Math.random() });
	});

	bench("batch() with 10 updates", async () => {
		await plainStore.batch((api) => {
			for (let index = 0; index < 10; index++) {
				api.update((state) => ({ ...state, count: state.count + 1 }));
			}
		});
	});

	bench("update() + read() with derive", async () => {
		await cartStore.patch({ couponCode: String(Math.random()) });
		cartStore.read();
	});
});
