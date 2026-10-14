---
"rsc-state": minor
---

Keyed persistent stores and request scope detection

- **`key` option** for persistent stores: state lives in a `globalThis` registry, so it survives dev hot reloads and is shared when a bundler instantiates the store module more than once. Stores with the same key share state, mutation queue and hydration.
- Request-scoped stores warn once when React's `cache` isn't memoizing (outside a Server Component render), instead of silently discarding writes.
- Derived state is recomputed when a store definition with a new `derive` reuses a keyed instance.
