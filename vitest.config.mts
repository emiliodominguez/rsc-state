import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// Only the project's own tests: never copies of the repository (such as .claude/worktrees)
		include: ["tests/**/*.test.ts"],
		setupFiles: ["./tests/setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "dist/", "tests/", "examples/", "*.config.ts", "*.config.mts", "*.config.mjs", "**/*.d.ts"],
		},
	},
});
