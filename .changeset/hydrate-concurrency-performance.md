---
"rsc-state": minor
---

Hydration, concurrency safety, transactional batches and faster reads

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
