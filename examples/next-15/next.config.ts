import path from "node:path";

import type { NextConfig } from "next";

// rsc-state is linked from the repository root (file:../..), so the workspace root must include it.
// Declaring it explicitly also silences the "inferred your workspace root" warning caused by the
// repository's own lockfile.
const workspaceRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
	outputFileTracingRoot: workspaceRoot,
	turbopack: {
		root: workspaceRoot,
	},
	eslint: {
		// The example has no ESLint setup of its own; the repository config ignores examples
		ignoreDuringBuilds: true,
	},
};

export default nextConfig;
