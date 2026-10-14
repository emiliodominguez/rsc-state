import { defineConfig } from "waku/config";

export default defineConfig({
	vite: {
		resolve: {
			// rsc-state is linked from the repository root (file:../..), which has its own copy
			// of React. Without deduping, the library would import that copy, whose cache() is
			// never active during this app's render, and request-scoped state would be lost.
			// Monorepos with linked workspace packages need the same setting.
			dedupe: ["react", "react-dom"],
		},
	},
});
