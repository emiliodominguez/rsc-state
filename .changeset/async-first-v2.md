---
"rsc-state": major
---

Async-first architecture with middleware, storage adapters, and patch method

BREAKING CHANGE: All state-mutating methods now return `Promise<void>`

### New Features

- **`patch()` method**: Partial state updates without spread syntax
- **Middleware system**: Intercept and transform state operations with async support
- **Storage adapters**: Pluggable backends for persistent mode (Redis, database, file, etc.)
- **Async lifecycle callbacks**: `onInitialize`, `onUpdate`, `onReset`, `onError` support async

### Breaking Changes

| Method | v1.x | v2.0 |
|--------|------|------|
| `initialize()` | `void` | `Promise<void>` |
| `update()` | `void` | `Promise<void>` |
| `set()` | `void` | `Promise<void>` |
| `patch()` | N/A | `Promise<void>` |
| `reset()` | `void` | `Promise<void>` |
| `batch()` | `void` | `Promise<void>` |

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
