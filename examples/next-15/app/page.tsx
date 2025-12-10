import {
	login,
	logout,
	toggleTheme,
	toggleBetaFeatures,
	toggleMaintenanceMode,
	enableAllFlags,
	resetFeatureFlags,
	toggleErrorSimulation,
} from "@/lib/actions";
import { getUser, featureFlagsStore, errorDemoStore } from "@/lib/stores";

export default async function HomePage(): Promise<React.ReactNode> {
	const user = await getUser();
	const featureFlags = featureFlagsStore.read();
	const errorDemo = errorDemoStore.read();

	return (
		<div>
			<h1>RSC State Demo</h1>

			<section className="section">
				<h2>Storage Modes Comparison</h2>

				<div className="grid-comparison">
					<div className="comparison-card comparison-card-persistent">
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
						<p className="comparison-hint">Best for: Feature flags, app config</p>
					</div>

					<div className="comparison-card comparison-card-request">
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
						<p className="comparison-hint">Best for: User sessions, auth, preferences</p>
					</div>
				</div>
			</section>

			<section className="section section-persistent">
				<h2 className="section-title section-title-persistent">Feature Flags (Persistent Storage)</h2>

				<p className="section-description text-muted">No cookies needed! State persists in module memory. Shared across ALL users.</p>

				<p>
					Beta features: <strong>{featureFlags.betaFeatures ? "Enabled" : "Disabled"}</strong>
				</p>
				<p>
					Maintenance mode: <strong>{featureFlags.maintenanceMode ? "Enabled" : "Disabled"}</strong>
				</p>
				<p>
					Status: <strong>{featureFlags.statusMessage}</strong>
				</p>

				<p className="section-description text-muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
					💡 Check the server console to see lifecycle hooks in action!
				</p>

				<div className="button-group" style={{ marginTop: "1rem" }}>
					<form action={toggleBetaFeatures}>
						<button type="submit" className="btn btn-persistent">
							{featureFlags.betaFeatures ? "Disable" : "Enable"} Beta (onUpdate)
						</button>
					</form>

					<form action={toggleMaintenanceMode}>
						<button type="submit" className="btn btn-persistent">
							{featureFlags.maintenanceMode ? "Disable" : "Enable"} Maintenance (onUpdate)
						</button>
					</form>

					<form action={enableAllFlags}>
						<button type="submit" className="btn btn-persistent">
							Enable All (batch)
						</button>
					</form>

					<form action={resetFeatureFlags}>
						<button type="submit" className="btn btn-danger">
							Reset Flags (onReset)
						</button>
					</form>
				</div>

				<div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(128, 128, 128, 0.3)" }}>
					<p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
						<strong>Error Demo:</strong> Status: {errorDemo.status ?? "Error caught!"}
					</p>
					<form action={toggleErrorSimulation}>
						<button type="submit" className="btn btn-danger">
							{errorDemo.simulateError ? "Disable" : "Enable"} Error (onError)
						</button>
					</form>
				</div>
			</section>

			<section className="section section-request">
				<h2 className="section-title section-title-request">User (Request Storage)</h2>

				<p className="section-description text-muted">Hydrated from cookie each request. Isolated per user. Safe for sensitive data.</p>

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
					<form className="form-login" action={login}>
						<input type="text" name="userName" placeholder="Name" required className="input" />

						<input type="email" name="userEmail" placeholder="Email" required className="input" />

						<button type="submit" className="btn btn-request">
							Login
						</button>
					</form>
				)}
			</section>

			<section className="section section-neutral">
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
