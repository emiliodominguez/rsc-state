import { settingsStore, userStore } from "@/lib/stores";

/**
 * Header component - reads from stores without any props.
 * Demonstrates: no prop drilling needed.
 */
export function Header(): React.ReactNode {
	const user = userStore.read();
	const settings = settingsStore.read();

	return (
		<header
			style={{
				padding: "1rem 2rem",
				backgroundColor: settings.isDarkMode ? "#1a1a1a" : "#fff",
				color: settings.isDarkMode ? "#fff" : "#000",
				borderBottom: `1px solid ${settings.isDarkMode ? "#333" : "#eee"}`,
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
			}}
		>
			<strong>RSC State Demo</strong>

			<span>{user.isAuthenticated ? `Hello, ${user.displayName}` : "Not logged in"}</span>
		</header>
	);
}
