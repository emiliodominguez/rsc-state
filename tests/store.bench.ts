import { test } from "vitest";

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

// Reads take tens of nanoseconds, so each sample runs a batch of reads. This keeps timer
// overhead out of the measurement and the sample count small enough to analyze quickly.
// Multiply the reported hz by READS_PER_SAMPLE for per-call throughput.
const READS_PER_SAMPLE = 1000;

const benchmarkOptions = { time: 500, warmupTime: 100 };

test("read throughput (hz × 1000 = reads per second)", async ({ bench }) => {
	await bench.compare(
		bench("read() with memoized derived state", benchmarkOptions, () => {
			for (let index = 0; index < READS_PER_SAMPLE; index++) {
				cartStore.read();
			}
		}),
		bench("select() with memoized derived state", benchmarkOptions, () => {
			for (let index = 0; index < READS_PER_SAMPLE; index++) {
				cartStore.select((state) => state.subtotal);
			}
		}),
		bench("read() without derive", benchmarkOptions, () => {
			for (let index = 0; index < READS_PER_SAMPLE; index++) {
				plainStore.read();
			}
		}),
	);
});

test("write throughput", async ({ bench }) => {
	await bench.compare(
		bench("update()", benchmarkOptions, async () => {
			await plainStore.update((state) => ({ ...state, count: state.count + 1 }));
		}),
		bench("patch()", benchmarkOptions, async () => {
			await plainStore.patch({ count: Math.random() });
		}),
		bench("batch() with 10 updates", benchmarkOptions, async () => {
			await plainStore.batch((api) => {
				for (let index = 0; index < 10; index++) {
					api.update((state) => ({ ...state, count: state.count + 1 }));
				}
			});
		}),
		bench("patch() + read() with derive", benchmarkOptions, async () => {
			await cartStore.patch({ couponCode: String(Math.random()) });
			cartStore.read();
		}),
	);
});
