---
"rsc-state": minor
---

## v0.2.0 - Performance & Reliability

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
