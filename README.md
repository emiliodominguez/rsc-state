![rsc-state: Server state. Clearly defined. Cyan state blocks in layered graphite trays.](https://raw.githubusercontent.com/emiliodominguez/rsc-state/main/docs/assets/rsc-state-banner.jpg)

[![TypeScript: strict](https://img.shields.io/badge/TS-strict-3178c6?style=for-the-badge&labelColor=161b22&logo=typescript&logoColor=white)](./tsconfig.json)
[![React: Server Components](https://img.shields.io/badge/React-RSC-087ea4?style=for-the-badge&labelColor=161b22&logo=react&logoColor=white)](#features)
[![License: MIT](https://img.shields.io/badge/license-MIT-3da639?style=for-the-badge&labelColor=161b22&logo=opensourceinitiative&logoColor=white)](./LICENSE)

**Type-safe state for React Server Components.**

Choose request-scoped or shared persistent storage, with inferred derived state, middleware, transactional batches and pluggable storage adapters.

## Features

- **Two storage modes**: Request-scoped (isolated per user) or persistent (shared across requests)
- **Type-safe**: Base and derived state inferred from `initial` and `derive`, no generics needed
- **Zero client JS**: Purely server-side using React's [`cache`](https://react.dev/reference/react/cache) API
- **No hooks needed**: Direct read/write API for Server Components
- **Derived state**: Memoized per state reference; `read()` returns a stable object and never allocates on a cache hit
- **Middleware**: Transform, validate or veto state transitions, sync or async
- **Storage adapters**: Pluggable backends for persistent mode, with explicit `hydrate()` and write-before-commit consistency
- **Concurrency-safe**: Mutations on a store are serialized, so concurrent calls never lose updates
- **Transactional batches**: Sync or async, committed atomically, rolled back on error
- **No-op detection**: Unchanged updates skip middleware, adapter writes and callbacks
- **Async callbacks**: `onInitialize`, `onUpdate`, `onReset` support async operations

## Installation

```bash
npm install rsc-state
```

## Compatibility

| Requirement | Supported                                 | Verified with                                                        |
| ----------- | ----------------------------------------- | -------------------------------------------------------------------- |
| React       | 19.x (persistent stores also run on 18.3) | 19.3.0; 18.3.1 for persistent stores and the missing-`cache()` error |
| TypeScript  | Inferred types, no generics               | 6.0 and 7.0 (`skipLibCheck: false`, `nodenext` and `bundler` modes)  |
| Runtime     | Any RSC server runtime                    | Node.js 22; the library uses no Node-specific APIs                   |
| Modules     | ESM and CommonJS                          | `publint` and `arethetypeswrong` clean                               |

Request-scoped stores need React's `cache()`, which ships in React 19. Stable React 18 doesn't export it: there, creating a request-scoped store throws an error explaining this, while persistent stores keep working.

### Frameworks

Request-scoped stores work in any framework that renders React Server Components, because they rely only on React's `cache`. Each framework below was verified with a production build and concurrent requests for different users: every response rendered only its own user's state.

| Framework      | Verified version           | Framework RSC status | rsc-state                                                              |
| -------------- | -------------------------- | -------------------- | ---------------------------------------------------------------------- |
| Next.js        | 15.5.27, 16.4.0            | Stable               | ✅ Supported ([examples](#examples))                                   |
| Waku           | 1.0.0-rc.3                 | Release candidate    | ✅ Supported ([example](./examples/waku))                              |
| React Router   | 8.4.0, RSC framework mode  | Experimental         | ✅ Works; initialize in `ServerComponent`, not in `loader`             |
| TanStack Start | 1.169.1 with `rsc.enabled` | Experimental         | ✅ Works; initialize inside the tree passed to `renderServerComponent` |

React Router 8.4.0's RSC build fails with `@vitejs/plugin-rsc` 0.5.36 and later ("Vite RSC assets manifest not found"), independently of rsc-state; 0.5.35 works.

## Migration from v0.x to v1.x

Version 1.0 introduced an async-first architecture. All state-mutating methods return promises.

### Breaking Changes

| Method         | v0.x   | v1.x             |
| -------------- | ------ | ---------------- |
| `initialize()` | `void` | `Promise<void>`  |
| `update()`     | `void` | `Promise<void>`  |
| `set()`        | `void` | `Promise<void>`  |
| `patch()`      | N/A    | `Promise<void>`  |
| `reset()`      | `void` | `Promise<void>`  |
| `batch()`      | `void` | `Promise<void>`  |
| `read()`       | sync   | sync (unchanged) |
| `select()`     | sync   | sync (unchanged) |

### Migration Steps

1. Add `await` before all state-mutating calls:

```typescript
// Before (v0.x)
userStore.initialize({ userId: "123", userName: "John" });
userStore.update((state) => ({ ...state, count: state.count + 1 }));
userStore.set({ userId: null, userName: "" });
userStore.reset();

// After (v1.x)
await userStore.initialize({ userId: "123", userName: "John" });
await userStore.update((state) => ({ ...state, count: state.count + 1 }));
await userStore.set({ userId: null, userName: "" });
await userStore.reset();
```

2. Ensure your Server Components and layouts are async:

```typescript
// Before (v0.x)
export default function RootLayout({ children }) {
  userStore.initialize({ userId: "123" });

  return <html><body>{children}</body></html>;
}

// After (v1.x)
export default async function RootLayout({ children }) {
  await userStore.initialize({ userId: "123" });

  return <html><body>{children}</body></html>;
}
```

## Storage Modes

### Request Storage (Default)

State is isolated per request using React's `cache` API. Safe for user-specific data.

```typescript
const userStore = createServerStore({
	storage: "request", // default, can be omitted
	initial: { userId: null, userName: "" },
});
```

**Use for:** User sessions, authentication, user preferences, any user-specific data.

**Where it works:** while React renders Server Components. Outside a render React's `cache` doesn't memoize, so every call gets a fresh instance and writes are discarded. The store warns once when it detects this.

| Framework      | Initialize the store in                                             | Not in (runs outside the render)                                        |
| -------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Next.js        | Layouts, pages, Server Components                                   | Route handlers, middleware                                              |
| Waku           | Pages, layouts, Server Components                                   | Middleware, API routes                                                  |
| React Router   | `ServerComponent` of a route or layout                              | `loader`, `action`; return data and initialize in the component instead |
| TanStack Start | A Server Component inside the tree given to `renderServerComponent` | The server function body before `renderServerComponent`                 |

In TanStack Start each `renderServerComponent` call is its own React request, so state doesn't carry over between two calls. In Server Actions, persist changes to cookies or a database and revalidate, as shown below.

**Troubleshooting:** if the "React cache() is not active" warning appears _during_ a render, rsc-state is importing a different copy of React than your app renders with. This happens with linked or workspace packages (`file:`, `link:`, monorepos). Dedupe React in your bundler, for example in Vite:

```typescript
export default defineConfig({
	resolve: { dedupe: ["react", "react-dom"] },
});
```

**How it works:**

1. Layout reads from data source (cookies/database)
2. Layout initializes store with that data
3. Any component reads from store (no props needed!)
4. Server Action updates data source → revalidates
5. New request: layout re-initializes store

### Persistent Storage

State persists across requests using module-level storage. Shared across ALL users.

```typescript
const settingsStore = createServerStore({
	storage: "persistent",
	initial: { theme: "light" },
});
```

**Use for:** Feature flags, app-wide configuration, demos/prototypes.

Give persistent stores a `key` so their state survives dev hot reloads and is shared when the bundler loads the store module more than once (Next.js can instantiate a module separately for pages and route handlers):

```typescript
const settingsStore = createServerStore({
	storage: "persistent",
	key: "app-settings",
	initial: { theme: "light" },
});
```

Keyed state lives in a registry on `globalThis`. Every store created with the same key shares one state, mutation queue and adapter hydration.

**Warning:** Not suitable for user-specific data. Without an adapter, state is lost on server restart and not synced across server instances. Use a [storage adapter](#storage-adapters) to persist it.

## Quick Start

### Request-Scoped Store (User Data)

```typescript
// lib/stores.ts
import { createServerStore } from "rsc-state";

export const userStore = createServerStore({
	initial: {
		userId: null as string | null,
		userName: "",
	},
	derive: (state) => ({
		isAuthenticated: state.userId !== null,
	}),
});

// app/layout.tsx - Initialize from cookies each request
import { cookies } from "next/headers";
import { userStore } from "@/lib/stores";

export default async function Layout({ children }) {
	const cookieStore = await cookies();
	const userId = cookieStore.get("userId")?.value ?? null;
	const userName = cookieStore.get("userName")?.value ?? "";

	await userStore.initialize({ userId, userName });

	return <html><body>{children}</body></html>;
}

// components/Header.tsx - Read without props
import { userStore } from "@/lib/stores";

export function Header() {
	const user = userStore.read(); // No props needed!

	return <h1>Welcome, {user.isAuthenticated ? user.userName : "Guest"}</h1>;
}

// lib/actions.ts - Update cookies, revalidate
"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function login(formData: FormData) {
	const cookieStore = await cookies();

	cookieStore.set("userId", "123");
	cookieStore.set("userName", formData.get("name") as string);

	revalidatePath("/"); // New request → layout re-initializes store
}
```

### Persistent Store (Global App State)

```typescript
// lib/stores.ts
import { createServerStore } from "rsc-state";

export const settingsStore = createServerStore({
	storage: "persistent",
	initial: { theme: "light" as "light" | "dark" },
	derive: (state) => ({
		isDarkMode: state.theme === "dark",
	}),
});

// app/layout.tsx - Just read, no initialization needed
import { settingsStore } from "@/lib/stores";

export default function Layout({ children }) {
	const settings = settingsStore.read();

	return (
		<html>
			<body style={{ background: settings.isDarkMode ? "#121212" : "#fff" }}>
				{children}
			</body>
		</html>
	);
}

// lib/actions.ts - Update store directly, revalidate
"use server";
import { revalidatePath } from "next/cache";
import { settingsStore } from "./stores";

export async function toggleTheme() {
	const current = settingsStore.read().theme;

	await settingsStore.set({ theme: current === "light" ? "dark" : "light" });

	revalidatePath("/");
}
```

## API

### `createServerStore(configuration)`

Creates a new server store.

**Parameters:**

| Option         | Type                                                                | Description                                           |
| -------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `initial`      | `T \| () => T`                                                      | Initial state value or factory function               |
| `storage`      | `"request" \| "persistent"`                                         | Storage mode (default: `"request"`)                   |
| `key`          | `string`                                                            | Registry key for persistent stores (survives HMR)     |
| `derive`       | `(state: T) => D`                                                   | Derived state, inferred and memoized per state        |
| `middleware`   | `Middleware<T>[]`                                                   | Array of middleware functions to intercept operations |
| `adapter`      | `StorageAdapter<T>`                                                 | Storage adapter for persistent mode                   |
| `debug`        | `boolean`                                                           | Enable debug logging                                  |
| `onInitialize` | `(state: T) => void \| Promise<void>`                               | Callback after store initialization                   |
| `onUpdate`     | `(prev: T, next: T) => void \| Promise<void>`                       | Callback after effective state changes                |
| `onReset`      | `(prev: T, next: T) => void \| Promise<void>`                       | Callback after store reset                            |
| `onError`      | `(error: Error, context: ErrorContext<T>) => void \| Promise<void>` | Callback when derive throws (once per failing state)  |

**Returns:** `ServerStore<T, D>` instance

### Store Methods

| Method              | Description                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| `initialize(state)` | Initialize store with values (async, for request-scoped)                      |
| `hydrate(options?)` | Load state from the adapter and return full state (async)                     |
| `read()`            | Read current state including derived properties (sync, stable ref)            |
| `update(fn)`        | Update state via reducer: `(prev) => next` (async)                            |
| `set(state)`        | Replace entire state (async)                                                  |
| `patch(partial)`    | Shallow-merge into state; no-op if nothing changed (async)                    |
| `select(fn)`        | Select specific value: `(state) => value` (sync)                              |
| `reset()`           | Reset to initial state (async)                                                |
| `batch(fn)`         | Apply several changes atomically; sync or async callback, rolls back on throw |

### Middleware

Intercept and transform state operations:

```typescript
import type { Middleware } from "rsc-state";

const loggingMiddleware: Middleware<MyState> = (operation) => {
	console.log(`[${operation.type}]`, operation.previousState, "→", operation.nextState);
	return operation.nextState;
};

const validationMiddleware: Middleware<MyState> = async (operation) => {
	await validateState(operation.nextState);
	return operation.nextState;
};

const store = createServerStore({
	initial: { count: 0 },
	middleware: [loggingMiddleware, validationMiddleware],
});
```

Middleware receives:

- `operation.type`: `"initialize" | "update" | "set" | "patch" | "reset" | "batch"`
- `operation.previousState`: State before the operation
- `operation.nextState`: State after the operation (can be transformed)

Middleware can:

- Log state changes
- Validate state (throwing rejects the operation; nothing is committed)
- Transform state before it's applied
- Veto a transition by returning `operation.previousState` (`update`, `set`, `patch`, `batch`)
- Perform async operations

Middleware must return a state object; returning `undefined` (a forgotten `return`) throws a descriptive `TypeError` instead of corrupting the store.

> Middleware runs while the store holds its mutation lock. Don't `await` mutating methods of the **same** store inside middleware or a batch callback: that waits on itself. Lifecycle callbacks (`onUpdate`, etc.) run after the lock is released and may mutate the store freely.

### Storage Adapters

Use custom storage backends for persistent mode:

```typescript
import type { StorageAdapter } from "rsc-state";

const redisAdapter: StorageAdapter<MyState> = {
	read: async () => {
		const data = await redis.get("store:key");
		return data ? JSON.parse(data) : null;
	},
	write: async (state) => {
		await redis.set("store:key", JSON.stringify(state));
	},
};

const store = createServerStore({
	storage: "persistent",
	initial: { theme: "light" },
	adapter: redisAdapter,
});

// Load persisted state before the first read
const settings = await store.hydrate();
```

How adapters behave:

- **Hydration**: `read()` is synchronous and can't wait for I/O, so call `await store.hydrate()` before the first read (for example in a cached loader). Mutating methods hydrate automatically. Concurrent callers share one adapter read; a failed read is retried on the next call.
- **Multi-instance deployments**: `hydrate({ force: true })` re-reads the adapter after pending mutations finish. Wrap it in React's `cache()` to re-sync once per request.
- **Consistency**: the adapter is written _before_ the in-memory commit. If `write()` throws, the store keeps its previous state and the error propagates to the caller.
- **Empty storage**: `read()` returning `null` or `undefined` keeps the configured initial state.

```typescript
import { cache } from "react";

export const getSettings = cache(() => settingsStore.hydrate({ force: true }));
```

### Patch Method

Partially update state without spread syntax:

```typescript
// Instead of:
await store.update((state) => ({ ...state, userName: "John" }));

// Use:
await store.patch({ userName: "John" });

// Update multiple properties:
await store.patch({ userName: "John", email: "john@example.com" });
```

### Derived State Memoization

Derived state is memoized per base state reference. On a cache hit `read()` returns the exact same object, so it's free to call from every component:

```typescript
const store = createServerStore({
	initial: { items: [] as number[] },
	derive: (state) => ({
		// Only recalculated when `items` changes
		total: state.items.reduce((sum, item) => sum + item, 0),
		count: state.items.length,
	}),
});

store.read(); // Computes derived state
store.read() === store.read(); // true: cached object, no recomputation, no allocation
await store.update((s) => ({ items: [...s.items, 5] }));
store.read(); // Recomputes derived state
```

State is treated as immutable: always return new objects from `update()`. Returning the same reference (or a `patch()` whose values are all identical) is a no-op that skips middleware, adapter writes and `onUpdate`.

### Lifecycle Hooks

React to state changes with lifecycle callbacks (supports async):

```typescript
const store = createServerStore({
	initial: { count: 0 },
	onInitialize: async (state) => {
		console.log("Store initialized with:", state);
		await analytics.track("store_initialized", state);
	},
	onUpdate: async (previousState, nextState) => {
		console.log("State changed from", previousState, "to", nextState);
		await syncToDatabase(nextState);
	},
	onReset: async () => {
		console.log("Store was reset");
		await clearCache();
	},
});
```

### Error Handling

Handle errors in derive functions gracefully:

```typescript
const store = createServerStore({
	initial: { data: null as Data | null },
	derive: (state) => ({
		// This might throw if data is null
		processedData: processData(state.data!),
	}),
	onError: async (error, context) => {
		console.error(`Error in ${context.method}:`, error.message);
		await reportError(error);
	},
});

// When derive throws, base state is returned without derived properties
const state = store.read(); // { data: null } - no crash!
```

Lifecycle callbacks (`onInitialize`, `onUpdate`, `onReset`) run after the state is committed. If one throws, the mutating call rejects, but the new state stays in place.

`onError` fires once per failing state rather than on every read. If `onError` itself throws or rejects, the failure is logged instead of crashing the render or leaking an unhandled rejection.

### Batch Updates

Combine multiple updates into one atomic transition. Changes are applied to a private draft; middleware, the adapter write and `onUpdate` run once when the callback settles:

```typescript
const store = createServerStore({
	initial: { count: 0, name: "" },
	derive: (state) => ({
		description: `${state.name} has count ${state.count}`,
	}),
});

// Without batch: derived state recalculated 3 times
await store.update((s) => ({ ...s, count: s.count + 1 }));
await store.update((s) => ({ ...s, count: s.count + 1 }));
await store.set({ count: 100, name: "Final" });

// With batch: derived state recalculated only once
await store.batch((api) => {
	api.update((s) => ({ ...s, count: s.count + 1 }));
	api.update((s) => ({ ...s, count: s.count + 1 }));
	api.set({ count: 100, name: "Final" });
});

// Batch also supports patch:
await store.batch((api) => {
	api.patch({ count: 10 });
	api.patch({ name: "Updated" });
});

// Async transactions: rolled back if anything throws
await cartStore.batch(async (api) => {
	const prices = await fetchPrices(api.read().items); // api.read() sees the draft
	api.patch({ prices });
});
```

If the callback throws or rejects, nothing is committed. Calling the batch API after the callback settled throws.

### Concurrency

Mutations on a store instance are queued and applied one at a time, in call order. Concurrent calls (e.g. `Promise.all` in a Server Action, or simultaneous requests hitting a persistent store) can't overwrite each other, even with async middleware or adapters:

```typescript
await Promise.all(Array.from({ length: 10 }, () => counterStore.update((s) => ({ count: s.count + 1 }))));

counterStore.read().count; // 10
```

When no middleware, adapter or batch callback needs to await anything, the mutation commits synchronously, in the same tick it was called. Always `await` mutating methods anyway; that's the only behavior the API guarantees.

## Performance

Per-call throughput (Node 22, persistent store, 200-item derived cart), measured with the Vitest 3 benchmark harness before and after the rewrite:

| Operation                        | ops/s (v1.0.0) | ops/s (current) |
| -------------------------------- | -------------- | --------------- |
| `read()` with memoized derive    | 8.1M           | 13.2M           |
| `select()` with memoized derive  | 7.1M           | 12.2M           |
| `patch()`                        | 1.0M           | 1.4M            |
| `batch()` with 10 updates        | 0.77M          | 1.39M           |
| `patch()` + `read()` with derive | 0.31M          | 0.52M           |

These figures include the harness overhead of one function call per sample. `npm run bench` (Vitest 5) batches 1000 reads per sample to remove that overhead and reports about 250M reads/s with memoized derived state (~4 ns per `read()`).

Where it comes from:

- `read()` returns a cached merged object instead of spreading base and derived state on every call
- Mutations skip every `await` that isn't needed (no adapter, no middleware, sync callbacks)
- No-op updates skip middleware, adapter writes, derive recomputation and callbacks

## Examples

Working examples:

| Version               | Directory                                                  | Notes                                    |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Next.js 15            | [`examples/next-15`](./examples/next-15)                   | Async `cookies()` API, Turbopack         |
| Next.js 16            | [`examples/next-16`](./examples/next-16)                   | Async `cookies()` API, Turbopack default |
| Next.js 16 + Adapters | [`examples/next-16-adapters`](./examples/next-16-adapters) | Storage adapters with file persistence   |
| Waku 1.0              | [`examples/waku`](./examples/waku)                         | Route params, keyed persistent store     |

```bash
cd examples/next-15  # or next-16, next-16-adapters, waku
npm install
npm run dev
```

Each Next.js example demonstrates:

- **Both storage modes** side by side
- Request-scoped user store with cookie persistence
- Persistent theme store without cookies
- Reading state without prop drilling
- Server Actions with revalidation

The **adapters example** additionally shows:

- Custom file-based storage adapter (JSON persistence)
- In-memory adapter for comparison
- State that survives server restarts
- Middleware for logging operations

## How It Works

### Request Storage

Uses React's [`cache`](https://react.dev/reference/react/cache) API for request-scoped memoization:

- Cache is automatically invalidated between server requests
- Same cached instance shared across all components in one request
- No state leakage between different users/requests

### Persistent Storage

Uses module-level variables:

- State persists in Node.js process memory
- Shared across all requests and users
- Lost on server restart or deployment
- Can use storage adapters for external persistence (Redis, database, etc.), loaded with `hydrate()`

## TypeScript

Full type inference for state and derived values:

```typescript
const store = createServerStore({
	initial: {
		userId: null as string | null,
		userName: "",
	},
	derive: (state) => ({
		isAuthenticated: state.userId !== null,
	}),
});

// Type: { userId: string | null; userName: string; isAuthenticated: boolean }
const state = store.read();

// Type error: Property 'invalidProperty' does not exist
state.invalidProperty;

// patch() is type-safe
await store.patch({ userName: "John" }); // ✅
await store.patch({ invalidKey: "value" }); // ❌ Type error

// Reuse the full state type elsewhere
import type { InferStoreState } from "rsc-state";
type UserState = InferStoreState<typeof store>;
```

Let inference do the work. Passing explicit generics (`createServerStore<MyState>(...)`) disables inference of the derived type, because TypeScript can't partially infer type arguments. To type the state precisely, annotate `initial` instead:

```typescript
const store = createServerStore({
	initial: { theme: "light" } as Settings,
	derive: (state) => ({ isDarkMode: state.theme === "dark" }),
});
```

Interfaces work as state types.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
