import { defineConfig } from "tsup";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs", "esm"],
	dts: true,
	clean: true,
	sourcemap: !isProduction,
	external: ["react"],
	treeshake: true,
	minify: isProduction,
	splitting: false,
});
