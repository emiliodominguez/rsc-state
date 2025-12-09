import "./globals.css";

import { Header } from "@/components/Header";
import { getUser } from "@/lib/stores";

export const metadata = {
	title: "RSC State - Next.js 15 Example",
	description: "Demonstrating rsc-state with both storage modes",
};

export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.ReactNode> {
	const user = await getUser();

	return (
		<html lang="en">
			<body className={user.isDarkMode ? "dark" : "light"}>
				<Header />
				<main>{children}</main>
			</body>
		</html>
	);
}
