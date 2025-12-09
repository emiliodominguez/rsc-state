import { describe, it, expect } from "vitest";
import { createServerStore } from "../src";

describe("integration tests", () => {
	describe("authentication flow", () => {
		it("handles full authentication lifecycle", () => {
			const authStore = createServerStore({
				initial: {
					userId: null as string | null,
					userName: "",
					userRole: "guest" as "admin" | "user" | "guest",
				},
				derive: (state) => ({
					isAuthenticated: state.userId !== null,
					isAdministrator: state.userRole === "admin",
				}),
			});

			// Initial state - not authenticated
			expect(authStore.read().isAuthenticated).toBe(false);
			expect(authStore.read().isAdministrator).toBe(false);

			// Simulate login
			authStore.initialize({
				userId: "user-123",
				userName: "John Doe",
				userRole: "admin",
			});

			const authenticatedState = authStore.read();
			expect(authenticatedState.isAuthenticated).toBe(true);
			expect(authenticatedState.isAdministrator).toBe(true);
			expect(authenticatedState.userName).toBe("John Doe");

			// Update user role
			authStore.update((previous) => ({
				...previous,
				userRole: "user",
			}));

			expect(authStore.read().isAdministrator).toBe(false);
			expect(authStore.read().isAuthenticated).toBe(true);

			// Logout
			authStore.reset();
			expect(authStore.read().isAuthenticated).toBe(false);
		});
	});

	describe("shopping cart flow", () => {
		interface CartItem {
			productId: string;
			productName: string;
			quantity: number;
			pricePerUnit: number;
		}

		it("handles cart operations with derived totals", () => {
			const cartStore = createServerStore({
				initial: {
					items: [] as CartItem[],
					couponCode: null as string | null,
				},
				derive: (state) => ({
					itemCount: state.items.reduce((total, item) => total + item.quantity, 0),
					subtotal: state.items.reduce((total, item) => total + item.quantity * item.pricePerUnit, 0),
					hasCoupon: state.couponCode !== null,
				}),
			});

			// Empty cart
			expect(cartStore.read().itemCount).toBe(0);
			expect(cartStore.read().subtotal).toBe(0);

			// Add first item
			cartStore.update((previous) => ({
				...previous,
				items: [
					...previous.items,
					{
						productId: "prod-1",
						productName: "Widget",
						quantity: 2,
						pricePerUnit: 10,
					},
				],
			}));

			expect(cartStore.read().itemCount).toBe(2);
			expect(cartStore.read().subtotal).toBe(20);

			// Add second item
			cartStore.update((previous) => ({
				...previous,
				items: [
					...previous.items,
					{
						productId: "prod-2",
						productName: "Gadget",
						quantity: 1,
						pricePerUnit: 25,
					},
				],
			}));

			expect(cartStore.read().itemCount).toBe(3);
			expect(cartStore.read().subtotal).toBe(45);

			// Apply coupon
			cartStore.update((previous) => ({
				...previous,
				couponCode: "SAVE10",
			}));

			expect(cartStore.read().hasCoupon).toBe(true);

			// Clear cart
			cartStore.reset();
			expect(cartStore.read().itemCount).toBe(0);
			expect(cartStore.read().hasCoupon).toBe(false);
		});
	});

	describe("nested state management", () => {
		it("handles deeply nested state updates", () => {
			const formStore = createServerStore({
				initial: {
					formData: {
						personalInformation: {
							firstName: "",
							lastName: "",
							emailAddress: "",
						},
						shippingAddress: {
							streetLine1: "",
							streetLine2: "",
							cityName: "",
							stateCode: "",
							postalCode: "",
						},
					},
					validationErrors: {} as Record<string, string>,
				},
				derive: (state) => ({
					isPersonalInformationComplete:
						state.formData.personalInformation.firstName !== "" &&
						state.formData.personalInformation.lastName !== "" &&
						state.formData.personalInformation.emailAddress !== "",
					hasValidationErrors: Object.keys(state.validationErrors).length > 0,
				}),
			});

			// Initially incomplete
			expect(formStore.read().isPersonalInformationComplete).toBe(false);

			// Fill personal info
			formStore.update((previous) => ({
				...previous,
				formData: {
					...previous.formData,
					personalInformation: {
						firstName: "John",
						lastName: "Doe",
						emailAddress: "john@example.com",
					},
				},
			}));

			expect(formStore.read().isPersonalInformationComplete).toBe(true);

			// Add validation error
			formStore.update((previous) => ({
				...previous,
				validationErrors: {
					postalCode: "Invalid postal code format",
				},
			}));

			expect(formStore.read().hasValidationErrors).toBe(true);

			// Clear errors
			formStore.update((previous) => ({
				...previous,
				validationErrors: {},
			}));

			expect(formStore.read().hasValidationErrors).toBe(false);
		});
	});

	describe("multiple stores", () => {
		it("maintains independent state across stores", () => {
			const userStore = createServerStore({
				initial: { userName: "" },
			});

			const settingsStore = createServerStore({
				initial: { darkModeEnabled: false, languageCode: "en" },
			});

			userStore.initialize({ userName: "Alice" });
			settingsStore.initialize({ darkModeEnabled: true, languageCode: "es" });

			expect(userStore.read().userName).toBe("Alice");
			expect(settingsStore.read().darkModeEnabled).toBe(true);
			expect(settingsStore.read().languageCode).toBe("es");

			// Update one store shouldn't affect the other
			userStore.update(() => ({ userName: "Bob" }));

			expect(userStore.read().userName).toBe("Bob");
			expect(settingsStore.read().darkModeEnabled).toBe(true);
		});
	});
});
