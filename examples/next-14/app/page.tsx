import { login, logout, toggleTheme, toggleBetaFeatures } from "@/lib/actions";
import { getUser, featureFlagsStore } from "@/lib/stores";

export default function HomePage(): React.ReactNode {
	const user = getUser();
	const featureFlags = featureFlagsStore.read();

	return (
		<div>
			<h1>RSC State Demo</h1>

			<section className="section">
				<h2>Storage Modes Comparison</h2>

				<div className="grid-comparison">
					<div className={`comparison-card comparison-card-persistent ${user.isDarkMode ? "dark" : "light"}`}>
						<strong className="comparison-title-persistent">PERSISTENT Storage</strong>{" "}
						<p className="comparison-code">
							<code>storage: &quot;persistent&quot;</code>
						</p>
						<ul className="comparison-list">
							<li>No initialization needed</li>
							<li>Survives across requests</li>
							<li>Shared across ALL users</li>
							<li>Lost on server restart</li>
						</ul>
						<p className={`comparison-hint ${user.isDarkMode ? "dark" : "light"}`}>Best for: Feature flags, app config</p>
					</div>

					<div className={`comparison-card comparison-card-request ${user.isDarkMode ? "dark" : "light"}`}>
						<strong className="comparison-title-request">REQUEST Storage</strong>{" "}
						<p className="comparison-code">
							<code>storage: &quot;request&quot;</code> (default)
						</p>
						<ul className="comparison-list">
							<li>Initialize each request</li>
							<li>Isolated per request</li>
							<li>Safe for user data</li>
							<li>Use with cookies/DB</li>
						</ul>
						<p className={`comparison-hint ${user.isDarkMode ? "dark" : "light"}`}>Best for: User sessions, auth, preferences</p>
					</div>
				</div>
			</section>

			<section className={`section section-persistent ${user.isDarkMode ? "dark" : "light"}`}>
				<h2 className="section-title section-title-persistent">Feature Flags (Persistent Storage)</h2>

				<p className={`section-description text-muted ${user.isDarkMode ? "dark" : "light"}`}>
					No cookies needed! State persists in module memory. Shared across ALL users.
				</p>

				<p>
					Beta features: <strong>{featureFlags.betaFeatures ? "Enabled" : "Disabled"}</strong>
				</p>

				<form action={toggleBetaFeatures}>
					<button type="submit" className="btn btn-persistent btn-full">
						{featureFlags.betaFeatures ? "Disable" : "Enable"} Beta Features
					</button>
				</form>
			</section>

			<section className={`section section-request ${user.isDarkMode ? "dark" : "light"}`}>
				<h2 className="section-title section-title-request">User (Request Storage)</h2>

				<p className={`section-description text-muted ${user.isDarkMode ? "dark" : "light"}`}>
					Hydrated from cookie each request. Isolated per user. Safe for sensitive data.
				</p>

				{user.isAuthenticated ? (
					<>
						<p>
							Logged in as: <strong>{user.displayName}</strong> ({user.userEmail})
						</p>

						<p>
							Theme: <strong>{user.theme}</strong>
						</p>

						<div className="button-group">
							<form action={toggleTheme}>
								<button type="submit" className="btn btn-request">
									Switch to {user.isDarkMode ? "Light" : "Dark"} Mode
								</button>
							</form>

							<form action={logout}>
								<button type="submit" className="btn btn-danger">
									Logout
								</button>
							</form>
						</div>
					</>
				) : (
					<form action={login} className="form-login">
						<input type="text" name="userName" placeholder="Name" required className={`input ${user.isDarkMode ? "dark" : "light"}`} />

						<input type="email" name="userEmail" placeholder="Email" required className={`input ${user.isDarkMode ? "dark" : "light"}`} />

						<button type="submit" className="btn btn-request">
							Login
						</button>
					</form>
				)}
			</section>

			<section className={`section section-neutral ${user.isDarkMode ? "dark" : "light"}`}>
				<h2 className="section-title">Current Store State</h2>

				<pre className="state-display">
					{JSON.stringify(
						{
							featureFlags: { ...featureFlags, storageMode: "persistent" },
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
