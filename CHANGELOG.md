# Changelog

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
