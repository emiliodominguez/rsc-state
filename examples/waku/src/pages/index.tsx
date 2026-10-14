import { Greeting } from "../components/Greeting";

/**
 * Home page rendered without initializing the visitor store, so the initial state is shown.
 *
 * @returns Home page
 */
export default function HomePage(): React.JSX.Element {
	return (
		<div>
			<title>rsc-state + Waku</title>

			<Greeting />
		</div>
	);
}

/**
 * Renders on every request.
 *
 * @returns Waku render configuration
 */
export async function getConfig(): Promise<{ render: "dynamic" }> {
	return { render: "dynamic" };
}
