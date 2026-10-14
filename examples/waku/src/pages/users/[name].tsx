import { Greeting } from "../../components/Greeting";
import { visitorStore } from "../../lib/stores";

interface UserPageProps {
	name: string;
}

/**
 * Initializes the request-scoped visitor store from the route parameter.
 * `Greeting` reads it without props.
 *
 * @param props - Route parameters
 * @returns User page
 */
export default async function UserPage({ name }: UserPageProps): Promise<React.JSX.Element> {
	await visitorStore.initialize({ visitorName: name });

	return (
		<div>
			<title>{`rsc-state + Waku: ${name}`}</title>

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
