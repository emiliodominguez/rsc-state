# rsc-state

Type-safe state management for React Server Components.

## Features

- **Request-scoped**: State isolated per request, no global leakage
- **Type-safe**: Full TypeScript inference with derived state
- **Zero client JS**: Purely server-side using React's `cache`
- **No hooks needed**: Direct read/write API for Server Components
- **Derived state**: Compute values automatically from base state

## Installation

```bash
npm install rsc-state
```

## Quick Start

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

// app/layout.tsx
import { userStore } from "@/lib/stores";

export default async function Layout({ children }) {
	userStore.initialize({ userId: "123", userName: "John" });
	return (
		<html>
			<body>{children}</body>
		</html>
	);
}

// app/page.tsx
import { userStore } from "@/lib/stores";

async function Header() {
	const user = userStore.read();
	return <h1>Welcome, {user.userName}</h1>;
}
```

## API

### `createServerStore(configuration)`

Creates a new server store.

**Parameters:**

- `configuration.initial`: Initial state value or factory function
- `configuration.derive`: Optional function to compute derived state
- `configuration.debug`: Enable debug logging

**Returns:** `ServerStore` instance

### `store.initialize(state)`

Initialize the store with values (typically in root layout).

### `store.read()`

Read current state (works anywhere in the Server Component tree).

### `store.update(updaterFunction)`

Update state via reducer function.

### `store.set(newState)`

Replace entire state.

### `store.select(selectorFunction)`

Select specific value from state.

### `store.reset()`

Reset to initial state.

## Examples

See the [examples](./examples) directory for complete working examples.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
