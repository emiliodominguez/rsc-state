# Changelog

## 2.0.0

### Major Changes

- 807e568: Security release. Upgrade from 1.x promptly: mutating what `read()` returned in place could leak one request's data into later requests. See "Migration from v1.x to v2.x" in the README; most apps need no code changes.

    ### Fixes
    - **Cross-request data leak**: request-scoped instances all started from the same literal `initial` object, so mutating what `read()` returned in place (for example `read().items.push(...)` or assigning a property) leaked into every later request, including other users'. Each instance and each `reset()` now gets its own copy of the plain objects and arrays in a literal `initial`. A literal `initial` containing class instances (`Map`, `Set`, `Date`, ...), which can't be copied, logs a warning recommending a factory.
    - **Forced hydration pile-up**: concurrent `hydrate({ force: true })` calls each queued their own adapter read behind the mutation lock, so the documented per-request pattern grew the queue without bound under load (100 concurrent requests: 100 sequential reads, and mutations waiting behind them). Concurrent callers now join a queued read that hasn't started yet; each caller still gets data read after its call.
    - **Registry version skew**: keyed persistent instances live in a global registry, so two rsc-state versions in one process could read each other's instances; a 1.1.0 instance crashed `hydrate({ force: true })` in newer code. The registry key now includes an instance schema version.
    - **Unprintable thrown values**: a `derive` that threw a null-prototype object, or a value whose `toString` throws, made `read()` throw despite the fallback; the error is now normalized safely, with the original value as `cause`.
    - **Lost update through re-entrancy**: a mutation started synchronously from inside another (an updater, or a synchronous middleware or adapter calling the store without awaiting) ran immediately and was then overwritten by the outer commit. Queue entries are now registered before a mutation starts, so such calls queue behind it in call order.
    - **Silent deadlocks**: a middleware, adapter or batch callback that awaits a mutating method of its own store hangs that store forever (for a persistent store, every user). A warning is now logged, once per store, when a queued mutation waits more than 10 seconds.
    - **Invalid state**: `null`, `undefined` and primitives from `initialize`, `set`, `update`, `patch`, `batch`, middleware or an adapter read are rejected with a `TypeError` instead of being committed (for example `JSON.parse("null")` from a tampered cookie).

    ### Type Changes
    - `patch()` and the batch draft's `patch()` take `Pick<T, K>` instead of `Partial<T>`, the same approach as React's class `setState`. `Partial` accepted `patch({ userId: session?.userId })` for a `string | null` field and stored `undefined`, which made a check like `userId !== null` report a signed-out user as signed in. Object literals keep working; code passing a `Partial<T>` variable now needs `update((state) => ({ ...state, ...changes }))`.

    ### New Features
    - **`throwOnDeriveError`**: when `derive` fails, `read()`, `select()` and `hydrate()` rethrow instead of returning state without derived properties, so derived access flags fail closed.

    ### Documentation
    - New Security section covering what the library enforces and what applications must do.
    - The Next.js examples now use HMAC-signed, schema-validated sessions with a signed expiry and a minimum secret length: the previous unsigned JSON cookie let anyone impersonate any user, forever. The adapters example validates Server Action input and writes its file atomically.
    - The README Quick Start no longer trusts raw `userId` cookies; it initializes from a verified session.

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
