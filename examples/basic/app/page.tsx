import { userStore, settingsStore } from "@/lib/stores";

function UserGreeting() {
	const user = userStore.read();

	return (
		<div>
			<h2>Welcome, {user.displayName}!</h2>
			<p>Status: {user.isAuthenticated ? "Logged in" : "Guest"}</p>
			{user.isAdministrator && <p>You have admin privileges</p>}
		</div>
	);
}

function UserDetails() {
	const userEmail = userStore.select((state) => state.userEmail);
	const userRole = userStore.select((state) => state.userRole);

	return (
		<div>
			<h3>User Details</h3>
			<p>Email: {userEmail}</p>
			<p>Role: {userRole}</p>
		</div>
	);
}

function SettingsDisplay() {
	const settings = settingsStore.read();

	return (
		<div>
			<h3>Settings</h3>
			<p>Theme: {settings.themeName}</p>
			<p>Language: {settings.languageCode}</p>
			<p>Notifications: {settings.notificationsEnabled ? "Enabled" : "Disabled"}</p>
		</div>
	);
}

export default function HomePage() {
	return (
		<main style={{ padding: "2rem", fontFamily: "system-ui" }}>
			<h1>rsc-state Example</h1>
			<p>This example demonstrates type-safe state management in React Server Components.</p>

			<hr style={{ margin: "2rem 0" }} />

			<UserGreeting />

			<hr style={{ margin: "2rem 0" }} />

			<UserDetails />

			<hr style={{ margin: "2rem 0" }} />

			<SettingsDisplay />
		</main>
	);
}
