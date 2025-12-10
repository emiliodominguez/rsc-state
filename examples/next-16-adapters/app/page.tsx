import {
	toggleTheme,
	toggleNotifications,
	resetSettings,
	incrementCounter,
	decrementCounter,
	resetCounter,
	batchIncrement,
	changeLanguage,
	setVolume,
} from "@/lib/actions";
import { getSettings, getCounter } from "@/lib/stores";
import { LanguageSelect } from "@/components/LanguageSelect";
import { VolumeSlider } from "@/components/VolumeSlider";

export default async function HomePage(): Promise<React.ReactNode> {
	const settings = await getSettings();
	const counter = await getCounter();

	return (
		<main>
			<h1>Storage Adapters Demo</h1>

			<p className="subtitle">Demonstrating custom storage backends for persistent state.</p>

			<div className="info-box">
				<strong>How it works:</strong> The settings are persisted to a JSON file using a custom storage adapter. Try changing settings, then
				restart the server - your settings will be restored! The counter uses an in-memory adapter for comparison. Check the server console to
				see adapter operations.
			</div>

			<section className="section">
				<h2 className="section-title section-title-primary">Settings (File Adapter)</h2>

				<p className="section-description">
					Persisted to <code>.data/settings.json</code> - survives server restarts!
				</p>

				<div className="setting-row">
					<span className="setting-label">Theme</span>

					<div>
						<span className="setting-value">{settings.theme}</span>

						<form className="inline-form" action={toggleTheme}>
							<button type="submit" className="btn btn-primary">
								Toggle
							</button>
						</form>
					</div>
				</div>

				<div className="setting-row">
					<span className="setting-label">Language</span>

					<form action={changeLanguage}>
						<LanguageSelect key={settings.language} currentLanguage={settings.language} />
					</form>
				</div>

				<div className="setting-row">
					<span className="setting-label">Notifications</span>

					<div>
						<span className="setting-value">{settings.notifications ? "On" : "Off"}</span>

						<form className="inline-form" action={toggleNotifications}>
							<button type="submit" className="btn btn-outline">
								{settings.notifications ? "Disable" : "Enable"}
							</button>
						</form>
					</div>
				</div>

				<div className="setting-row">
					<span className="setting-label">Volume ({settings.volumeLabel})</span>

					<form action={setVolume} className="range-container">
						<VolumeSlider key={settings.volume} currentVolume={settings.volume} />

						<span className="range-value">{settings.volume}%</span>
					</form>
				</div>

				<div className="button-group">
					<form action={resetSettings}>
						<button type="submit" className="btn btn-danger">
							Reset Settings & Delete File
						</button>
					</form>
				</div>
			</section>

			<section className="section">
				<h2 className="section-title section-title-secondary">Counter (Memory Adapter)</h2>

				<p className="section-description">In-memory adapter - resets on server restart (for comparison).</p>

				<div className={`counter-display ${counter.isNegative ? "negative" : ""}`}>{counter.count}</div>

				<div className="counter-buttons">
					<form action={decrementCounter}>
						<button type="submit" className="btn btn-secondary">
							- Decrement
						</button>
					</form>

					<form action={incrementCounter}>
						<button type="submit" className="btn btn-secondary">
							+ Increment
						</button>
					</form>

					<form action={batchIncrement}>
						<button type="submit" className="btn btn-primary">
							+5 (Batch)
						</button>
					</form>

					<form action={resetCounter}>
						<button type="submit" className="btn btn-danger">
							Reset
						</button>
					</form>
				</div>

				<p className="counter-meta">Last updated: {counter.lastUpdated}</p>
			</section>

			<section className="section">
				<h2 className="section-title">Current State</h2>

				<pre className="state-display">
					{JSON.stringify(
						{
							settings: { ...settings, adapter: "JSON file (.data/settings.json)" },
							counter: { ...counter, adapter: "In-memory" },
						},
						null,
						2,
					)}
				</pre>
			</section>
		</main>
	);
}
