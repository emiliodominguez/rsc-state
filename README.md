# rsc-state

Type-safe state management for React Server Components.

## Features

- **Two storage modes**: Request-scoped (isolated per user) or persistent (shared across requests)
- **Type-safe**: Full TypeScript inference with derived state
- **Zero client JS**: Purely server-side using React's [`cache`](https://react.dev/reference/react/cache) API
- **No hooks needed**: Direct read/write API for Server Components
- **Derived state**: Compute values automatically from base state

## Installation

```bash
npm install rsc-state
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

	userStore.initialize({ userId, userName });

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
	settingsStore.set({ theme: current === "light" ? "dark" : "light" });
	revalidatePath("/");
}
```

## API

### `createServerStore(configuration)`

Creates a new server store.

**Parameters:**

| Option    | Type                        | Description                                |
| --------- | --------------------------- | ------------------------------------------ |
| `initial` | `T \| () => T`              | Initial state value or factory function    |
| `storage` | `"request" \| "persistent"` | Storage mode (default: `"request"`)        |
| `derive`  | `(state: T) => D`           | Optional function to compute derived state |
| `debug`   | `boolean`                   | Enable debug logging                       |

**Returns:** `ServerStore<T, D>` instance

### Store Methods

| Method              | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `initialize(state)` | Initialize store with values (for request-scoped, call in layout) |
| `read()`            | Read current state including derived properties                   |
| `update(fn)`        | Update state via reducer: `(prev) => next`                        |
| `set(state)`        | Replace entire state                                              |
| `select(fn)`        | Select specific value: `(state) => value`                         |
| `reset()`           | Reset to initial state                                            |

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
