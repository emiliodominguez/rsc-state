# rsc-state

Type-safe state management for React Server Components.

## Features

- **Two storage modes**: Request-scoped (isolated per user) or persistent (shared across requests)
- **Type-safe**: Full TypeScript inference with derived state
- **Zero client JS**: Purely server-side using React's [`cache`](https://react.dev/reference/react/cache) API
- **No hooks needed**: Direct read/write API for Server Components
- **Derived state**: Compute values automatically from base state (memoized for performance)
- **Middleware**: Intercept and transform state operations with async support
- **Storage adapters**: Pluggable backends for persistent mode (Redis, database, etc.)
- **Async callbacks**: `onInitialize`, `onUpdate`, `onReset` support async operations
- **Batch updates**: Combine multiple updates for better performance

## Installation

```bash
npm install rsc-state
```

## Migration from v1.x to v2.x

Version 2.0 introduces an async-first architecture. All state-mutating methods now return promises.

### Breaking Changes

| Method         | v1.x   | v2.0             |
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
// Before (v1.x)
userStore.initialize({ userId: "123", userName: "John" });
userStore.update((state) => ({ ...state, count: state.count + 1 }));
userStore.set({ userId: null, userName: "" });
userStore.reset();

// After (v2.0)
await userStore.initialize({ userId: "123", userName: "John" });
await userStore.update((state) => ({ ...state, count: state.count + 1 }));
await userStore.set({ userId: null, userName: "" });
await userStore.reset();
```

2. Ensure your Server Components and layouts are async:

```typescript
// Before (v1.x)
export default function RootLayout({ children }) {
  userStore.initialize({ userId: "123" });

  return <html><body>{children}</body></html>;
}

// After (v2.0)
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

**Warning:** Not suitable for user-specific data. State is lost on server restart and not synced across server instances.

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
| `derive`       | `(state: T) => D`                                                   | Optional function to compute derived state (memoized) |
| `middleware`   | `Middleware<T>[]`                                                   | Array of middleware functions to intercept operations |
| `adapter`      | `StorageAdapter<T>`                                                 | Storage adapter for persistent mode                   |
| `debug`        | `boolean`                                                           | Enable debug logging                                  |
| `onInitialize` | `(state: T) => void \| Promise<void>`                               | Callback after store initialization                   |
| `onUpdate`     | `(prev: T, next: T) => void \| Promise<void>`                       | Callback after state updates                          |
| `onReset`      | `() => void \| Promise<void>`                                       | Callback after store reset                            |
| `onError`      | `(error: Error, context: ErrorContext<T>) => void \| Promise<void>` | Callback when derive function throws                  |

**Returns:** `ServerStore<T, D>` instance

### Store Methods

| Method              | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `initialize(state)` | Initialize store with values (async, for request-scoped)     |
| `read()`            | Read current state including derived properties (sync)       |
| `update(fn)`        | Update state via reducer: `(prev) => next` (async)           |
| `set(state)`        | Replace entire state (async)                                 |
| `patch(partial)`    | Partially update state by merging (async)                    |
| `select(fn)`        | Select specific value: `(state) => value` (sync)             |
| `reset()`           | Reset to initial state (async)                               |
| `batch(fn)`         | Execute multiple updates, compute derived state once (async) |

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
- Validate state
- Transform state before it's applied
- Perform async operations

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

Derived state is automatically memoized and only recalculated when the base state changes:

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
store.read(); // Returns cached result (no recomputation)
await store.update((s) => ({ items: [...s.items, 5] }));
store.read(); // Recomputes derived state
```

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

### Batch Updates

Combine multiple updates for better performance:

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
```

## Examples

Working examples are available for different Next.js versions:

| Version    | Directory                                | Notes                                    |
| ---------- | ---------------------------------------- | ---------------------------------------- |
| Next.js 14 | [`examples/next-14`](./examples/next-14) | Synchronous `cookies()` API              |
| Next.js 15 | [`examples/next-15`](./examples/next-15) | Async `cookies()` API, Turbopack         |
| Next.js 16 | [`examples/next-16`](./examples/next-16) | Async `cookies()` API, Turbopack default |

```bash
cd examples/next-15  # or next-14, next-16
npm install
npm run dev
```

Each example demonstrates:

- **Both storage modes** side by side
- Request-scoped user store with cookie persistence
- Persistent theme store without cookies
- Reading state without prop drilling
- Server Actions with revalidation

### Framework Support

| Framework      | RSC Status     | Support         |
| -------------- | -------------- | --------------- |
| Next.js 14+    | Stable         | ✅ Full support |
| React Router 7 | Preview        | ⏳ Coming soon  |
| TanStack Start | In development | ⏳ Coming soon  |
| Waku           | Stable         | ⏳ Planned      |

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
- Can use storage adapters for external persistence (Redis, database, etc.)

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
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
