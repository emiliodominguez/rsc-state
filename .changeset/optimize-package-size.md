---
"rsc-state": patch
---

Optimize package size and code style

- Production builds now minify output and exclude source maps, reducing npm unpacked size from 69.2 kB to 33.9 kB
- Development builds (`npm run dev`) include source maps for easier debugging
- Refactored callback invocations to use optional chaining for cleaner code
