---
"rsc-state": minor
---

Security hardening

### Fixes

- **Cross-request data leak**: request-scoped instances all started from the same literal `initial` object, so mutating what `read()` returned in place (for example `read().items.push(...)` or assigning a property) leaked into every later request, including other users'. Each instance and each `reset()` now gets its own copy of the plain objects and arrays in a literal `initial`. A literal `initial` containing class instances (`Map`, `Set`, `Date`, ...), which can't be copied, logs a warning recommending a factory.
- **Invalid state**: `null`, `undefined` and primitives from `initialize`, `set`, `update`, `patch`, `batch`, middleware or an adapter read are rejected with a `TypeError` instead of being committed (for example `JSON.parse("null")` from a tampered cookie).

### New Features

- **`throwOnDeriveError`**: when `derive` fails, `read()`, `select()` and `hydrate()` rethrow instead of returning state without derived properties, so derived access flags fail closed.

### Documentation

- New Security section covering what the library enforces and what applications must do.
- The Next.js examples now use HMAC-signed, schema-validated sessions: the previous unsigned JSON cookie let anyone impersonate any user. The adapters example validates Server Action input and writes its file atomically.
