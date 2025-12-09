import { login, logout, toggleTheme } from "@/lib/actions";
import { settingsStore, userStore } from "@/lib/stores";

export default function HomePage(): React.ReactNode {
	const user = userStore.read();
	const settings = settingsStore.read();

	return (
		<div>
			<h1>RSC State Demo</h1>

			<section style={{ marginBottom: "2rem" }}>
				<h2>Storage Modes Comparison</h2>

				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
					<div
						style={{
							padding: "1rem",
							backgroundColor: settings.isDarkMode ? "#1e3a1e" : "#e8f5e9",
							borderRadius: "8px",
							borderLeft: "4px solid #4caf50",
						}}
					>
						<strong style={{ color: "#4caf50" }}>PERSISTENT Storage</strong>

						<p style={{ margin: "0.5rem 0", fontSize: "0.875rem" }}>
							<code>storage: &quot;persistent&quot;</code>
						</p>

						<ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.875rem", lineHeight: "1.6" }}>
							<li>No initialization needed</li>
							<li>Survives across requests</li>
							<li>Shared across ALL users</li>
							<li>Lost on server restart</li>
						</ul>

						<p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: settings.isDarkMode ? "#aaa" : "#666" }}>
							Best for: Feature flags, app config, demos
						</p>
					</div>

					<div
						style={{
							padding: "1rem",
							backgroundColor: settings.isDarkMode ? "#1e3a5a" : "#e3f2fd",
							borderRadius: "8px",
							borderLeft: "4px solid #2196f3",
						}}
					>
						<strong style={{ color: "#2196f3" }}>REQUEST Storage</strong>

						<p style={{ margin: "0.5rem 0", fontSize: "0.875rem" }}>
							<code>storage: &quot;request&quot;</code> (default)
						</p>

						<ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.875rem", lineHeight: "1.6" }}>
							<li>Initialize each request</li>
							<li>Isolated per request</li>
							<li>Safe for user data</li>
							<li>Use with cookies/DB</li>
						</ul>

						<p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: settings.isDarkMode ? "#aaa" : "#666" }}>
							Best for: User sessions, auth, preferences
						</p>
					</div>
				</div>
			</section>

			<section
				style={{
					padding: "1.5rem",
					backgroundColor: settings.isDarkMode ? "#1e3a1e" : "#e8f5e9",
					borderRadius: "8px",
					marginBottom: "2rem",
					border: "1px solid #4caf50",
				}}
			>
				<h2 style={{ marginTop: 0, color: "#4caf50" }}>Theme (Persistent Storage)</h2>

				<p style={{ fontSize: "0.875rem", color: settings.isDarkMode ? "#aaa" : "#666" }}>
					No cookies! State persists in module memory. Shared across all users.
				</p>

				<p>
					Current theme: <strong>{settings.theme}</strong>
				</p>

				<form action={toggleTheme}>
					<button
						type="submit"
						style={{
							padding: "0.75rem 1.5rem",
							backgroundColor: "#4caf50",
							color: "#fff",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
						}}
					>
						Switch to {settings.isDarkMode ? "Light" : "Dark"} Mode
					</button>
				</form>
			</section>

			<section
				style={{
					padding: "1.5rem",
					backgroundColor: settings.isDarkMode ? "#1e3a5a" : "#e3f2fd",
					borderRadius: "8px",
					marginBottom: "2rem",
					border: "1px solid #2196f3",
				}}
			>
				<h2 style={{ marginTop: 0, color: "#2196f3" }}>User (Request Storage)</h2>

				<p style={{ fontSize: "0.875rem", color: settings.isDarkMode ? "#aaa" : "#666" }}>
					Hydrated from cookie each request. Isolated per user. Safe for sensitive data.
				</p>

				{user.isAuthenticated ? (
					<>
						<p>
							Logged in as: <strong>{user.displayName}</strong> ({user.userEmail})
						</p>

						<form action={logout}>
							<button
								type="submit"
								style={{
									padding: "0.75rem 1.5rem",
									backgroundColor: "#dc3545",
									color: "#fff",
									border: "none",
									borderRadius: "4px",
									cursor: "pointer",
								}}
							>
								Logout
							</button>
						</form>
					</>
				) : (
					<form action={login} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "300px" }}>
						<input
							type="text"
							name="userName"
							placeholder="Name"
							required
							style={{
								padding: "0.75rem",
								border: "1px solid #ccc",
								borderRadius: "4px",
								fontSize: "1rem",
								backgroundColor: settings.isDarkMode ? "#333" : "#fff",
								color: settings.isDarkMode ? "#fff" : "#000",
							}}
						/>

						<input
							type="email"
							name="userEmail"
							placeholder="Email"
							required
							style={{
								padding: "0.75rem",
								border: "1px solid #ccc",
								borderRadius: "4px",
								fontSize: "1rem",
								backgroundColor: settings.isDarkMode ? "#333" : "#fff",
								color: settings.isDarkMode ? "#fff" : "#000",
							}}
						/>

						<button
							type="submit"
							style={{
								padding: "0.75rem 1.5rem",
								backgroundColor: "#2196f3",
								color: "#fff",
								border: "none",
								borderRadius: "4px",
								cursor: "pointer",
							}}
						>
							Login
						</button>
					</form>
				)}
			</section>

			<section
				style={{
					padding: "1.5rem",
					backgroundColor: settings.isDarkMode ? "#2a2a2a" : "#f5f5f5",
					borderRadius: "8px",
				}}
			>
				<h2 style={{ marginTop: 0 }}>Current Store State</h2>

				<pre style={{ margin: 0, fontSize: "0.875rem", overflow: "auto" }}>
					{JSON.stringify(
						{
							settings: { ...settings, storageMode: "persistent" },
							user: { ...user, storageMode: "request" },
						},
						null,
						2,
					)}
				</pre>
			</section>
		</div>
	);
}
