# Examples

This folder contains example applications demonstrating `rsc-state` with different Next.js versions.

## Available Examples

| Example               | Next.js Version | Cookies API | Description                             |
| --------------------- | --------------- | ----------- | --------------------------------------- |
| [next-14](./next-14/) | 14.x            | Synchronous | Uses sync `cookies()` API               |
| [next-15](./next-15/) | 15.x            | Async       | Uses async `cookies()` API with `await` |

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
// Next.js 14 (sync)
export const getUser = cache(() => {
	const userCookie = cookies().get(USER_COOKIE);

	if (userCookie) {
		userStore.initialize(JSON.parse(userCookie.value));
	}

	return userStore.read();
});

// Next.js 15+ (async)
export const getUser = cache(async () => {
	const cookieStore = await cookies();
	const userCookie = cookieStore.get(USER_COOKIE);

	if (userCookie) {
		userStore.initialize(JSON.parse(userCookie.value));
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
