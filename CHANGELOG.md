# Changelog

## 1.1.0

### Minor Changes

- 292c087: Hydration, concurrency safety, transactional batches and faster reads

    ### New Features
    - **`hydrate(options?)`**: Loads adapter-backed persistent state and returns the full state. Concurrent callers share one adapter read, failed reads are retried, and `{ force: true }` re-reads the adapter after pending mutations (multi-instance deployments).
    - **Transactional `batch()`**: Callbacks may be async, `api.read()` exposes the draft, and a throwing callback rolls back without committing, writing or calling `onUpdate`.
    - **Middleware veto**: Returning `operation.previousState` cancels an `update`, `set`, `patch` or `batch`.
    - **New types**: `StoreState`, `InferStoreState`, `HydrateOptions`, `EmptyDerivedState`.
    - `onReset` now receives `(previousState, nextState)`.

    ### Fixes
    - Derived state is now actually inferred: `read()`, `select()` and `ServerStore<T, D>` previously resolved properties to `never`.
    - State types may be interfaces (`T extends object` instead of `Record<string, unknown>`).
    - Concurrent mutations are serialized per store instance; async middleware or adapters no longer lose updates.
    - Adapter-backed stores read the adapter even if `read()` was called before the first mutation.
    - The adapter is written before the in-memory commit, so a failed write no longer leaves memory and storage out of sync.
    - A failed adapter read no longer permanently breaks the store.
    - `onError` rejections are logged instead of surfacing as unhandled rejections.
    - Middleware returning `undefined` throws a descriptive `TypeError` instead of corrupting state.
    - Package `exports` now resolve `.d.mts` types for ESM consumers.

    ### Performance
    - `read()` returns a cached merged object (no allocation on cache hits): ~1.6x faster with derived state.
    - Mutations skip unnecessary `await`s and commit synchronously when nothing is async.
    - No-op updates (same reference, or a `patch()` with identical values) skip middleware, adapter writes, derive and callbacks.

    ### Behavior Changes
    - `onUpdate` is no longer called for no-op `update`/`set`/`patch`/`batch` calls.
    - `onError` fires once per failing state instead of on every read.
    - Debug log for `reset()` now includes the reset state.

- 1981c3f: Keyed persistent stores and request scope detection

    - **`key` option** for persistent stores: state lives in a `globalThis` registry, so it survives dev hot reloads and is shared when a bundler instantiates the store module more than once. Stores with the same key share state, mutation queue and hydration.
    - Request-scoped stores warn once when React's `cache` isn't memoizing (outside a Server Component render), instead of silently discarding writes.
    - Derived state is recomputed when a store definition with a new `derive` reuses a keyed instance.

### Patch Changes

- 155de41: Verified compatibility with the latest frameworks and toolchains

    - Verified with Next.js 15.5.27 and 16.4.0 (React 19.3), Waku 1.0.0-rc.3, React Router 8.4.0 (RSC framework mode) and TanStack Start 1.169.1 (RSC enabled), using production builds and concurrent requests.
    - Published types verified with TypeScript 6.0 and 7.0.
    - The "React cache() is not active" warning now also explains duplicate React copies (linked or workspace packages) and how to dedupe them.
    - Build migrated from tsup to tsdown; the published files and exports are unchanged.
    - Request-scoped stores on React builds without `cache()` (stable React 18) now throw a descriptive error at creation instead of failing with `cache is not a function`, and importing the library no longer fails under Node ESM there. Persistent stores keep working.
    - Next.js 14 is no longer covered: its example was removed because 14.x has unpatched security advisories (fixed only in Next.js 15.5.24 and later). Request-scoped stores require React 19; persistent stores still run on React 18.3.

## 1.0.0

### Major Changes

- cd172a6: Async-first architecture with middleware, storage adapters, and patch method

    BREAKING CHANGE: All state-mutating methods now return `Promise<void>`

    ### New Features
    - **`patch()` method**: Partial state updates without spread syntax
    - **Middleware system**: Intercept and transform state operations with async support
    - **Storage adapters**: Pluggable backends for persistent mode (Redis, database, file, etc.)
    - **Async lifecycle callbacks**: `onInitialize`, `onUpdate`, `onReset`, `onError` support async

    ### Breaking Changes

    | Method         | v1.x   | v2.0            |
    | -------------- | ------ | --------------- |
    | `initialize()` | `void` | `Promise<void>` |
    | `update()`     | `void` | `Promise<void>` |
    | `set()`        | `void` | `Promise<void>` |
    | `patch()`      | N/A    | `Promise<void>` |
    | `reset()`      | `void` | `Promise<void>` |
    | `batch()`      | `void` | `Promise<void>` |

    ### Migration

    Add `await` before all state-mutating method calls:

    ```typescript
    // Before
    userStore.initialize({ userId: "123" });
    userStore.update((s) => ({ ...s, count: s.count + 1 }));

    // After
    await userStore.initialize({ userId: "123" });
    await userStore.update((s) => ({ ...s, count: s.count + 1 }));
    ```

## 0.2.2

### Patch Changes

- cab594b: Add usage examples to all public API methods in JSDoc documentation for improved developer experience and IDE tooltips

## 0.2.1

### Patch Changes

- 00bc930: Optimize package size and code style
    - Production builds now minify output and exclude source maps, reducing npm unpacked size from 69.2 kB to 33.9 kB
    - Development builds (`npm run dev`) include source maps for easier debugging
    - Refactored callback invocations to use optional chaining for cleaner code

## 0.2.0

### Minor Changes

- bb8ec35: ## v0.2.0 - Performance & Reliability

    ### New Features
    - **Derived State Memoization**: Derived state is now cached and only recalculated when base state changes, improving performance for expensive computations
    - **Error Boundaries**: Added `onError` callback to handle errors in derive functions gracefully without crashing the store
    - **Lifecycle Hooks**: Added `onInitialize`, `onUpdate`, and `onReset` callbacks for logging, analytics, and side effects
    - **Batch Updates**: New `batch()` method to combine multiple updates and compute derived state only once

    ### API Additions
    - `StoreConfig.onInitialize`: Callback invoked after store initialization
    - `StoreConfig.onUpdate`: Callback invoked after state updates (via `update()`, `set()`, or `batch()`)
    - `StoreConfig.onReset`: Callback invoked after store reset
    - `StoreConfig.onError`: Callback invoked when derive function throws an error
    - `ServerStore.batch()`: Execute multiple updates with a single derived state computation
    - `ErrorContext`: New exported type for error callback context
    - `BatchApi`: New exported type for batch callback API

## 0.1.0

### Minor Changes

- Initial release of rsc-state - Type-safe state management for React Server Components.

    Features:
    - Request-scoped state using React's native `cache` API
    - Persistent storage mode for app-wide state (feature flags, config)
    - Full TypeScript inference with derived state
    - Zero client-side JavaScript
    - Compatible with React 18.3+ and React 19
