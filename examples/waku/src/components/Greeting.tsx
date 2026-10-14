import { visitorStore } from "../lib/stores";

/**
 * Nested Server Component that reads request-scoped state without receiving props.
 *
 * @returns Greeting for the current request's visitor
 */
export function Greeting(): React.JSX.Element {
	const { greeting, isIdentified } = visitorStore.read();

	return (
		<section>
			<h2 data-testid="greeting">{greeting}</h2>

			<p>{isIdentified ? "Visitor identified from the route." : "Open /users/your-name to identify yourself."}</p>
		</section>
	);
}
