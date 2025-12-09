import { userStore, settingsStore } from "@/lib/stores";

export const metadata = {
	title: "rsc-state Example",
	description: "Basic example of rsc-state library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	// Initialize stores at the root layout
	// In a real app, you would fetch user data from a session/database
	userStore.initialize({
		userId: "user-123",
		userName: "John Doe",
		userEmail: "john@example.com",
		userRole: "user",
	});

	settingsStore.initialize({
		themeName: "light",
		languageCode: "en",
		notificationsEnabled: true,
	});

	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
