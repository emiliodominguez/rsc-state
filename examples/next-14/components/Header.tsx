import Link from "next/link";

import { getUser, featureFlagsStore } from "@/lib/stores";

export function Header(): React.ReactNode {
	const user = getUser();
	const featureFlags = featureFlagsStore.read();

	return (
		<header className="header">
			<div className="header-content">
				<div className="header-left">
					<div className="header-brand">
						<strong>RSC State Demo</strong>
						{featureFlags.betaFeatures && <span className="badge badge-beta">BETA</span>}
					</div>

					<nav className="nav">
						<Link href="/" className="nav-link">
							Home
						</Link>
						<Link href="/about" className="nav-link">
							About
						</Link>
						<Link href="/debug" className="nav-link">
							Debug
						</Link>
					</nav>
				</div>

				<span className="header-user">{user.isAuthenticated ? `Hello, ${user.displayName}` : "Not logged in"}</span>
			</div>
		</header>
	);
}
