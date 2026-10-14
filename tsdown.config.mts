import { defineConfig } from "tsdown";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs", "esm"],
	platform: "neutral",
	// Declaration maps would point at src/, which is not published
	dts: { sourcemap: false },
	clean: true,
	sourcemap: !isProduction,
	minify: isProduction,
	deps: { neverBundle: ["react"] },
});
