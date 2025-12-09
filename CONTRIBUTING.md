# Contributing to rsc-state

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/yourusername/rsc-state.git
cd rsc-state
npm install
```

## Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## Code Style

This project uses:

- ESLint for linting
- Prettier for formatting
- Conventional commits via commitizen

All checks run automatically on pre-commit via husky.

## Documentation Requirements

All code must be documented in English using JSDoc:

- All public functions require JSDoc comments
- All parameters must have `@param` tags
- All return values must have `@returns` tags
- No auto-generated or obvious comments
- No acronyms in function or variable names

See CLAUDE.md for detailed documentation guidelines.

## Making Changes

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes with complete JSDoc
3. Add tests for your changes
4. Create a changeset: `npm run changeset`
5. Commit using: `npm run commit` (or use conventional commit format)
6. Push and create a PR

## Commit Format

We use conventional commits:

```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

## Code Guidelines

- Use function declarations, not arrow functions for exports
- Add comprehensive JSDoc comments to all public APIs
- Use descriptive names without acronyms
- Maintain test coverage above 90%
- Follow existing code style

## Questions?

Open an issue or discussion on GitHub.
