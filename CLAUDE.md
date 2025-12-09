# Claude Development Context

## Project Overview

**rsc-state** is a TypeScript library for type-safe state management in React Server Components.

### Core Philosophy

- Request-scoped state using React's native `cache` API
- Zero client-side JavaScript
- Full TypeScript inference with derived state
- No hooks, no Context API (server-side only)

## Tech Stack

- **Language**: TypeScript 5.8+
- **Build**: tsup (dual CJS/ESM output)
- **Testing**: Vitest
- **Linting**: ESLint 9 (flat config)
- **Formatting**: Prettier
- **Commits**: Commitizen + Commitlint (conventional commits)
- **Versioning**: Changesets
- **Git Hooks**: Husky + lint-staged

## Code Style

### TypeScript

- Use **function declarations**, not arrow functions for named exports
- Explicit return types required (`@typescript-eslint/explicit-function-return-type`)
- No `any` types (`@typescript-eslint/no-explicit-any`)
- Consistent type imports (`type { ... }`)
- PascalCase for interfaces, type aliases, enums

### Formatting

- Tabs (width: 4)
- Print width: 150
- Trailing commas: all
- Semicolons: required
- Single quotes: false

### Naming Conventions

- **NO ACRONYMS**: Write full, descriptive names
- **Be explicit**: `getUserById` not `getUser`, `isAuthenticated` not `isAuth`
- Variables: `camelCase` and descriptive
- Functions: `camelCase` verbs (e.g., `createServerStore`, `computeDerivedState`)
- Types/Interfaces: `PascalCase` nouns (e.g., `StoreConfig`, `ServerStore`)

Examples:

```typescript
// Good
function computeDerivedState(state: State): DerivedState;
const userAuthentication = checkUserAuthentication();
const maximumRetryCount = 3;

// Bad
function computeDerived(st: State): DS;
const userAuth = checkAuth();
const maxRetries = 3;
```

### Functions

```typescript
// Correct
export function createServerStore<T>(config: StoreConfig<T>): ServerStore<T> {
	// implementation
}

// Incorrect
export const createServerStore = <T>(config: StoreConfig<T>): ServerStore<T> => {
	// implementation
};
```

### Documentation (JSDoc)

**CRITICAL RULES:**

1. **ALL public APIs MUST have JSDoc comments**
2. **ALL parameters MUST have `@param` tags with descriptions**
3. **ALL functions with return values MUST have `@returns` tags with descriptions**
4. **Write in English**
5. **NO auto-generated or AI-like boilerplate comments**
6. **NO obvious statements** (e.g., "Gets the value" for `getValue()`)
7. **Explain WHY and WHAT, not HOW** (the code shows HOW)
8. **Include `@example` for complex APIs**

````typescript
// EXCELLENT - Clear, meaningful, complete
/**
 * Creates a request-scoped store for managing server-side state in React Server Components.
 * The store uses React's cache API to ensure state is isolated per request and automatically
 * invalidated between requests.
 *
 * @param configuration - Store configuration object
 * @returns Store instance with methods to read and update state
 *
 * @example
 * ```typescript
 * const userStore = createServerStore({
 *   initial: { id: null, name: '' },
 *   derive: (state) => ({
 *     isAuthenticated: state.id !== null
 *   })
 * });
 * ```
 */
export function createServerStore<T>(configuration: StoreConfig<T>): ServerStore<T> {
	// ...
}

// GOOD - Clear parameter descriptions
/**
 * Updates the store state by applying a reducer function to the previous state.
 * The reducer receives the current state and must return a new state object.
 *
 * @param updaterFunction - Function that receives previous state and returns new state
 * @returns void
 */
function updateState(updaterFunction: (previous: State) => State): void {
	// ...
}

// BAD - Auto-generated, obvious, no value
/**
 * Update function
 * @param updater - The updater
 * @returns Nothing
 */
function update(updater: Function): void {
	// ...
}

// BAD - Missing @param and @returns
/**
 * Computes derived state
 */
function computeDerived(state: State): DerivedState {
	// ...
}

// BAD - Using acronyms, unclear
/**
 * Gets cfg
 * @param cfg - The cfg
 * @returns The result
 */
function getCfg(cfg: Config): Result {
	// ...
}
````

### Internal Helper Functions

Even private/internal functions should have JSDoc if they're non-trivial:

```typescript
/**
 * Computes derived state by applying the derive function from configuration
 * to the base state. Returns base state unchanged if no derive function exists.
 *
 * @param baseState - Current base state
 * @returns Combined base and derived state
 */
function computeDerivedState(baseState: State): FullState {
	if (!configuration.derive) {
		return baseState as FullState;
	}

	const derivedState = configuration.derive(baseState) as DerivedState;
	return { ...baseState, ...derivedState } as FullState;
}
```

### Comments in Code

Avoid inline comments that state the obvious. Use them only to explain:

- **Non-obvious business logic**
- **Performance optimizations**
- **Workarounds for external library bugs**
- **Complex algorithms**

```typescript
// GOOD - Explains non-obvious behavior
// React cache invalidates automatically per request, ensuring
// no state leakage between different user requests
const getCacheInstance = cache(() => {
	// ...
});

// GOOD - Explains why, not what
// We check initialized flag to provide helpful warnings during development
// without throwing errors that would break production
if (!cacheInstance.initialized && configuration.debug) {
	console.warn("[rsc-state] Reading uninitialized store");
}

// BAD - States the obvious
// Set the state
cacheInstance.state = newState;

// BAD - Auto-generated noise
// TODO: Implement this function
// This function updates the state
function updateState() {
	// ...
}
```

## Development Workflow

### Adding Features

1. Create a changeset: `npm run changeset`
2. Write tests first (TDD approach)
3. Implement feature with complete JSDoc
4. Update documentation
5. Commit with conventional commit format

### Commit Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Always include scope** - enforced by commitlint.

**IMPORTANT**: Do NOT add the "Generated with Claude Code" footer or "Co-Authored-By" lines to commit messages. Keep commits clean and simple.

Example:

```
feat(store): add select method for derived state

Allows reading specific derived values without reading entire state.

Closes #123
```

### Testing

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

Coverage targets:

- Statements: 90%+
- Branches: 85%+
- Functions: 90%+
- Lines: 90%+

### Test Style Guide

**Test descriptions**: Use `"should..."` convention for all test descriptions:

```typescript
// Good
it("should initialize store with provided state", () => { ... });
it("should compute derived state correctly", () => { ... });

// Bad
it("initializes with provided state", () => { ... });
it("computes derived state", () => { ... });
```

**Test structure**: Use `// Given // When // Then` comments to organize test logic:

```typescript
it("should update state immutably", () => {
	// Given
	const store = createServerStore({
		initial: { count: 0 },
	});
	store.initialize({ count: 0 });

	// When
	store.update((previousState) => ({ count: previousState.count + 1 }));

	// Then
	expect(store.read().count).toEqual(1);
});
```

**Assertions**: Prefer `toEqual` over `toBe` for value comparisons (stricter type checking):

```typescript
// Good - toEqual for values
expect(state.count).toEqual(5);
expect(state.isAuthenticated).toEqual(true);
expect(state.userName).toEqual("John");

// Use toBe only for reference equality or specific primitives when needed
expect(store).toBe(sameStoreReference);
```

### Pre-commit Checks

Automatically runs via husky:

1. ESLint with auto-fix on staged TypeScript files
2. Prettier format on staged files
3. Type checking (no emit)

### Releasing

```bash
npm run changeset:version  # Bump versions based on changesets
npm run changeset:publish  # Publish to npm
```

## Architecture Decisions

### Why React `cache`?

- Native React primitive for request-scoped memoization
- Automatic cache invalidation per request
- No need for custom cache implementation

### Why No Client Components?

- Library is specifically for Server Components
- Client state has existing solutions (Zustand, Jotai, etc.)
- Keeps bundle size at zero

### Why Function Declarations?

- Better stack traces in errors
- Hoisting allows flexible code organization
- More explicit for public APIs

## Common Tasks

### Add New API Method

1. Update `types.d.ts` with interface definition
2. Implement in `create-store.ts` with full JSDoc
3. Add tests in `tests/store.test.ts`
4. Export from `src/index.ts`
5. Document in README.md
6. Create changeset

### Update Dependencies

```bash
npm outdated
npm update
npm test
```

### Debug Tests

```bash
npm run test:watch -- --reporter=verbose
```

## Resources

- [React `cache` API](https://react.dev/reference/react/cache)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [TypeScript 5.8 Release](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html)

## Documentation Philosophy

### What Makes Good Documentation

1. **Clear purpose**: Start with WHAT the function does
2. **Context**: Explain WHY it exists or when to use it
3. **Complete parameters**: Every parameter needs description
4. **Return value**: What does the function give back
5. **Examples**: Show real usage for complex APIs
6. **NO fluff**: Skip obvious statements

### Examples of Quality Documentation

See `src/create-store.ts` for reference implementations of:

- Complex function documentation
- Parameter documentation
- Return value documentation
- Usage examples in JSDoc

## Preferences

- Prefer composition over inheritance
- Keep functions pure when possible
- Avoid premature optimization
- Write tests that document behavior
- Favor explicit over implicit
- No magic - clear, readable code
- Descriptive names over short names
- Documentation over cleverness

## Contact

- Issues: [GitHub Issues](https://github.com/emiliodominguez/rsc-state/issues)
- Discussions: [GitHub Discussions](https://github.com/emiliodominguez/rsc-state/discussions)
