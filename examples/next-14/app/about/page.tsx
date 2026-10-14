import { getUser, featureFlagsStore } from "@/lib/stores";

export default async function AboutPage(): Promise<React.ReactNode> {
	const user = await getUser();
	const featureFlags = featureFlagsStore.read();

	return (
		<div>
			<h1>About Page</h1>

			<p className="about-intro">This page demonstrates that state persists across navigation.</p>

			<section className="section section-neutral">
				<h2 className="section-title">Current State (same as home page)</h2>

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

			<section className="section section-request">
				<h2 className="section-title section-title-request">How it works</h2>

				<ul className="how-it-works-list">
					<li>
						<strong>Feature flags</strong> (persistent) - Same value on every page, for every user
					</li>
					<li>
						<strong>User data</strong> (request) - Loaded from cookie on each request, isolated per user
					</li>
					<li>
						<strong>Theme</strong> - Part of user data, persists across navigation via cookie
					</li>
				</ul>

				<p className="section-footer text-muted">Navigate back to Home and toggle settings - they&apos;ll persist when you return here.</p>
			</section>
		</div>
	);
}
