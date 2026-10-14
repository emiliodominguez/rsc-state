import type { ReactNode } from "react";

import { siteConfigurationStore } from "../lib/stores";

interface RootLayoutProps {
	children: ReactNode;
}

/**
 * Root layout reading the persistent site configuration store.
 *
 * @param props - Layout props containing the routed page
 * @returns Page shell
 */
export default function RootLayout({ children }: RootLayoutProps): React.JSX.Element {
	const { siteName } = siteConfigurationStore.read();

	return (
		<div>
			<header>
				<strong>{siteName}</strong>
			</header>

			<main>{children}</main>
		</div>
	);
}

/**
 * Renders on every request so request-scoped state reflects the incoming request.
 *
 * @returns Waku render configuration
 */
export async function getConfig(): Promise<{ render: "dynamic" }> {
	return { render: "dynamic" };
}
