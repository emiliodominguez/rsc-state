import { createServerStore } from "rsc-state";

/**
 * Visitor store - REQUEST storage mode (default).
 * Initialized from the route on every request and read anywhere below without props.
 * Each request gets its own instance, so concurrent visitors never see each other's data.
 */
export const visitorStore = createServerStore({
	initial: {
		visitorName: null as string | null,
	},
	derive: (state) => ({
		isIdentified: state.visitorName !== null,
		greeting: state.visitorName === null ? "Hello, stranger" : `Hello, ${state.visitorName}`,
	}),
});

/**
 * Site configuration store - PERSISTENT storage mode.
 * Shared across all requests. The `key` keeps the same state across dev hot reloads.
 */
export const siteConfigurationStore = createServerStore({
	storage: "persistent",
	key: "waku-example-site-configuration",
	initial: {
		siteName: "rsc-state on Waku",
	},
});
