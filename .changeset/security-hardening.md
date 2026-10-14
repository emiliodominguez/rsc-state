---
"rsc-state": major
---

Security release. Upgrade from 1.x promptly: mutating what `read()` returned in place could leak one request's data into later requests. See "Migration from v1.x to v2.x" in the README; most apps need no code changes.

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
