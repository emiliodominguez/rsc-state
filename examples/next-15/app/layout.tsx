import { Header } from "@/components/Header";
import { getUserFromCookie } from "@/lib/actions";
import { settingsStore, userStore } from "@/lib/stores";

export const metadata = {
	title: "RSC State - Next.js 15 Example",
	description: "Demonstrating rsc-state with both storage modes",
};

/**
 * Root layout - demonstrates both storage modes:
 *
 * 1. PERSISTENT (settingsStore): Just read - no initialization needed
 * 2. REQUEST (userStore): Must initialize from cookie each request
 */
export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.ReactNode> {
	// PERSISTENT: Just read, state persists automatically
	const settings = settingsStore.read();

	// REQUEST: Must hydrate from cookie on each request
	const userData = await getUserFromCookie();

	if (userData) {
		userStore.initialize(userData);
	}

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					fontFamily: "system-ui, sans-serif",
					backgroundColor: settings.isDarkMode ? "#121212" : "#fafafa",
					color: settings.isDarkMode ? "#fff" : "#000",
					minHeight: "100vh",
				}}
			>
				<Header />

				<main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>{children}</main>
			</body>
		</html>
	);
}
