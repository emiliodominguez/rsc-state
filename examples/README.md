# Examples

This folder contains example applications demonstrating `rsc-state` with Next.js 14, 15 and 16, and with Waku.

## Available Examples

| Example                                 | Next.js Version | Description                                                    |
| --------------------------------------- | --------------- | -------------------------------------------------------------- |
| [next-14](./next-14/)                   | 14.x            | Basic usage with sync `cookies()` API                          |
| [next-15](./next-15/)                   | 15.x            | Basic usage with async `cookies()` API                         |
| [next-16](./next-16/)                   | 16.x            | Basic usage with latest Next.js                                |
| [next-16-adapters](./next-16-adapters/) | 16.x            | Storage adapters for persistent state (file, memory)           |
| [waku](./waku/)                         | Waku 1.0 RC     | Request-scoped store from route params, keyed persistent store |

## Running an Example

```bash
# Navigate to the example directory
cd examples/next-14  # or next-15/16

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## What the Examples Demonstrate

Each example showcases both storage modes available in `rsc-state`:

### Persistent Storage

- **Use case**: Feature flags, app configuration
- **Behavior**: State persists in module memory across requests
- **Scope**: Shared across ALL users
- **Example**: `featureFlagsStore` with `betaFeatures` toggle

```typescript
export const featureFlagsStore = createServerStore({
	storage: "persistent",
	initial: { betaFeatures: false },
});
```

### Request Storage (Default)

- **Use case**: User sessions, authentication, preferences
- **Behavior**: State is isolated per request
- **Scope**: Unique to each user
- **Example**: `userStore` with authentication and theme

```typescript
export const userStore = createServerStore({
	storage: "request",
	initial: {
		userId: null,
		userName: "",
		userEmail: "",
		theme: "light",
	},
	derive: (state) => ({
		isAuthenticated: state.userId !== null,
		displayName: state.userName || "Guest",
		isDarkMode: state.theme === "dark",
	}),
});
```

## Key Patterns Demonstrated

### Cached Initialization

The examples use React's `cache()` API to ensure user state is initialized once per request:

```typescript
// Next.js 14 (sync cookies(), async store)
export const getUser = cache(async () => {
	const userCookie = cookies().get(USER_COOKIE);

	if (userCookie) {
		await userStore.initialize(JSON.parse(userCookie.value));
	}

	return userStore.read();
});

// Components must await it
export async function Header() {
	const user = await getUser();
	// ...
}

// Next.js 15+ (async)
export const getUser = cache(async () => {
	const cookieStore = await cookies();
	const userCookie = cookieStore.get(USER_COOKIE);

	if (userCookie) {
		await userStore.initialize(JSON.parse(userCookie.value));
	}

	return userStore.read();
});
```

### Server Actions

State updates happen through server actions that modify cookies and revalidate:

```typescript
export async function toggleTheme(): Promise<void> {
	const cookieStore = await cookies();
	const userCookie = cookieStore.get(USER_COOKIE);

	if (userCookie) {
		const userData = JSON.parse(userCookie.value);
		const newTheme = userData.theme === "light" ? "dark" : "light";
		cookieStore.set(USER_COOKIE, JSON.stringify({ ...userData, theme: newTheme }));
	}

	revalidatePath("/", "layout");
}
```

### Navigation Persistence

The About page demonstrates that state persists correctly across navigation:

- **Feature flags**: Same value on every page, for every user
- **User data**: Loaded from cookie on each request, isolated per user
- **Theme**: Part of user data, persists across navigation via cookie

### Storage Adapters (next-16-adapters)

The adapters example demonstrates custom storage backends for persistent mode:

```typescript
// JSON file adapter
const jsonFileAdapter: StorageAdapter<SettingsState> = {
	read: async () => {
		const data = await readDataFile();
		return data;
	},
	write: async (state) => {
		await writeDataFile(state);
	},
};

// Create store with adapter
export const settingsStore = createServerStore({
	storage: "persistent",
	initial: { theme: "light", language: "en" },
	adapter: jsonFileAdapter,
	middleware: [
		(operation) => {
			console.log(`[${operation.type}]:`, operation.nextState);
			return operation.nextState;
		},
	],
});
```

Load persisted state before reading with `hydrate()` (wrapped in React's `cache()` so it runs once per request):

```typescript
export const getSettings = cache(async () => settingsStore.hydrate({ force: true }));
```

This example also demonstrates:

- **Middleware**: Intercept and log state operations
- **Derived state**: Compute values from base state
- **Server actions with async store methods**: All mutating methods return promises
- **Minimal client components**: Only interactive inputs are client-side

### Waku (waku)

The Waku example initializes a request-scoped store from a route parameter (`/users/[name]`) and reads it in a nested Server Component without props:

```typescript
export default async function UserPage({ name }: UserPageProps): Promise<React.JSX.Element> {
	await visitorStore.initialize({ visitorName: name });

	return <Greeting />;
}
```

Its `waku.config.ts` dedupes React. That is required here because `rsc-state` is linked from the repository root, which has its own copy of React; monorepos with linked packages need the same setting.

```bash
cd examples/waku
npm install
npm run dev
# open http://localhost:3000/users/your-name
```

## Project Structure

```
examples/next-{version}/
├── app/
│   ├── layout.tsx      # Root layout with Header
│   ├── page.tsx        # Home page with storage mode demos
│   ├── about/
│   │   └── page.tsx    # Navigation demo page
│   └── globals.css     # Responsive styles
├── components/
│   └── Header.tsx      # Navigation header
├── lib/
│   ├── stores.ts       # Store definitions
│   └── actions.ts      # Server actions
└── package.json
```
