import "./globals.css";

import { Header } from "@/components/Header";
import { getUser } from "@/lib/stores";

export const metadata = {
	title: "RSC State - Next.js 14 Example",
	description: "Demonstrating rsc-state with both storage modes",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
	const user = getUser();

	return (
		<html lang="en">
			<body className={user.isDarkMode ? "dark" : "light"}>
				<Header />

				<main>{children}</main>
			</body>
		</html>
	);
}
