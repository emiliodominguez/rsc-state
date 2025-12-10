import { createServerStore } from "rsc-state";

import { getUser } from "@/lib/stores";

/**
 * Debug page to verify request-scoped isolation.
 *
 * Each request should get:
 * 1. A unique request ID
 * 2. Its own isolated store instance
 * 3. No state leakage from previous requests
 */

// Create a request-scoped store for this test
const debugStore = createServerStore({
	storage: "request",
	initial: {
		requestId: null as string | null,
		timestamp: null as number | null,
		readCount: 0,
	},
});

// Simulates a component deep in the tree reading from the store
function DeepComponent(): React.ReactNode {
	const state = debugStore.read();

	// Increment read count to prove we're reading from the same instance
	debugStore.update((prev) => ({ ...prev, readCount: prev.readCount + 1 }));

	const updatedState = debugStore.read();

	return (
		<div className="debug-component">
			<h3>Deep Component</h3>

			<p className="debug-description">Reads from the same store instance</p>

			<div className="debug-data">
				<p>
					<strong>Request ID:</strong> <code>{state.requestId}</code>
				</p>

				<p>
					<strong>Read count:</strong> {updatedState.readCount}
				</p>
			</div>
		</div>
	);
}

// Another component reading from the store
function SiblingComponent(): React.ReactNode {
	const state = debugStore.read();

	debugStore.update((prev) => ({ ...prev, readCount: prev.readCount + 1 }));

	const updatedState = debugStore.read();

	return (
		<div className="debug-component">
			<h3>Sibling Component</h3>

			<p className="debug-description">Also reads from the same store instance</p>

			<div className="debug-data">
				<p>
					<strong>Request ID:</strong> <code>{state.requestId}</code>
				</p>

				<p>
					<strong>Read count:</strong> {updatedState.readCount}
				</p>
			</div>
		</div>
	);
}

// Component to read final state after all updates
function FinalStateDisplay(): React.ReactNode {
	const finalState = debugStore.read();

	return (
		<>
			<section className="section section-persistent">
				<h2 className="section-title section-title-persistent">Final State</h2>

				<p className="section-description text-muted">After all components have read and updated</p>

				<div className="debug-data">
					<p>
						<strong>Total reads:</strong> {finalState.readCount}
					</p>
				</div>

				<p className="section-hint text-muted">✓ If isolation works: each refresh shows a NEW Request ID and read count resets</p>
			</section>

			<section className="section section-neutral">
				<h2 className="section-title">Raw Store State</h2>
				<pre className="state-display">{JSON.stringify(finalState, null, 2)}</pre>
			</section>
		</>
	);
}

export default async function DebugPage(): Promise<React.ReactNode> {
	// Call getUser to ensure the store is hydrated (for theme on body)
	await getUser();

	// Generate a unique ID for this request
	const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	// Initialize the store for this request
	debugStore.initialize({
		requestId,
		timestamp: Date.now(),
		readCount: 0,
	});

	// Read from store in the parent component
	const state = debugStore.read();

	// Log to server console
	console.log(`\n[DEBUG] ========== NEW REQUEST ==========`);
	console.log(`[DEBUG] Request ID: ${requestId}`);
	console.log(`[DEBUG] Timestamp: ${new Date(state.timestamp!).toISOString()}`);
	console.log(`[DEBUG] =====================================\n`);

	return (
		<div>
			<h1>Request Isolation Debug</h1>

			<section className="section section-neutral">
				<h2 className="section-title">What This Page Tests</h2>

				<p>
					This page verifies that <code>rsc-state</code> correctly isolates state per request using React's <code>cache()</code> API.
				</p>

				<ul className="how-it-works-list">
					<li>Each request gets a unique Request ID</li>
					<li>Multiple components share the same store instance within a request</li>
					<li>State resets completely between requests (no leakage)</li>
				</ul>
			</section>

			<section className="section section-request">
				<h2 className="section-title section-title-request">Parent Component</h2>

				<p className="section-description text-muted">Initializes the store for this request</p>

				<div className="debug-data">
					<p>
						<strong>Request ID:</strong> <code>{state.requestId}</code>
					</p>

					<p>
						<strong>Timestamp:</strong> {state.timestamp ? new Date(state.timestamp).toISOString() : "N/A"}
					</p>

					<p>
						<strong>Initial read count:</strong> {state.readCount}
					</p>
				</div>
			</section>

			<div className="grid-comparison" style={{ marginBottom: "var(--spacing-lg)" }}>
				<div className="comparison-card comparison-card-request">
					<DeepComponent />
				</div>

				<div className="comparison-card comparison-card-request">
					<SiblingComponent />
				</div>
			</div>

			<FinalStateDisplay />

			<section className="section section-neutral">
				<h2 className="section-title">How to Verify</h2>
				<ol className="how-it-works-list">
					<li>
						<strong>Refresh this page</strong> — you should see a different Request ID each time
					</li>

					<li>
						<strong>Open multiple tabs</strong> — each tab should have its own unique Request ID
					</li>

					<li>
						<strong>Check server console</strong> — each request logs separately
					</li>
				</ol>

				<div className="button-group" style={{ marginTop: "1rem" }}>
					<a href="/debug" className="btn btn-request">
						Refresh Page
					</a>
					<a href="/" className="btn btn-persistent">
						Back to Home
					</a>
				</div>
			</section>
		</div>
	);
}
