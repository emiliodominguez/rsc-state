---
"rsc-state": patch
---

Verified compatibility with the latest frameworks and toolchains

- Verified with Next.js 15.5.27 and 16.4.0 (React 19.3), Waku 1.0.0-rc.3, React Router 8.4.0 (RSC framework mode) and TanStack Start 1.169.1 (RSC enabled), using production builds and concurrent requests.
- Published types verified with TypeScript 6.0 and 7.0.
- The "React cache() is not active" warning now also explains duplicate React copies (linked or workspace packages) and how to dedupe them.
- Build migrated from tsup to tsdown; the published files and exports are unchanged.
- Request-scoped stores on React builds without `cache()` (stable React 18) now throw a descriptive error at creation instead of failing with `cache is not a function`, and importing the library no longer fails under Node ESM there. Persistent stores keep working.
- Next.js 14 is no longer covered: its example was removed because 14.x has unpatched security advisories (fixed only in Next.js 15.5.24 and later). Request-scoped stores require React 19; persistent stores still run on React 18.3.
