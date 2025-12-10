# Changelog

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

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial implementation of `createServerStore`
- Support for derived state computation
- TypeScript type definitions
- Test suite with vitest
- Documentation and examples
