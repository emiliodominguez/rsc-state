import "./globals.css";

import { getSettings } from "@/lib/stores";

export const metadata = {
	title: "RSC State - Storage Adapters Example",
	description: "Demonstrating storage adapters for persistent state with rsc-state",
};

export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.ReactNode> {
	const settings = await getSettings();

	return (
		<html lang={settings.language}>
			<body className={settings.isDarkMode ? "dark" : "light"}>{children}</body>
		</html>
	);
}
