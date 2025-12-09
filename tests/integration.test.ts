import { describe, it, expect } from "vitest";

import { createServerStore } from "../src";

describe("integration tests", () => {
	describe("authentication flow", () => {
		it("should handle full authentication lifecycle", () => {
			// Given
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

			// Then - initial state is not authenticated
			expect(authStore.read().isAuthenticated).toEqual(false);
			expect(authStore.read().isAdministrator).toEqual(false);

			// When - simulate login
			authStore.initialize({
				userId: "user-123",
				userName: "John Doe",
				userRole: "admin",
			});

			// Then - user is authenticated
			const authenticatedState = authStore.read();
			expect(authenticatedState.isAuthenticated).toEqual(true);
			expect(authenticatedState.isAdministrator).toEqual(true);
			expect(authenticatedState.userName).toEqual("John Doe");

			// When - update user role
			authStore.update((previous) => ({
				...previous,
				userRole: "user",
			}));

			// Then - user is no longer administrator
			expect(authStore.read().isAdministrator).toEqual(false);
			expect(authStore.read().isAuthenticated).toEqual(true);

			// When - logout
			authStore.reset();

			// Then - user is not authenticated
			expect(authStore.read().isAuthenticated).toEqual(false);
		});
	});

	describe("shopping cart flow", () => {
		interface CartItem {
			productId: string;
			productName: string;
			quantity: number;
			pricePerUnit: number;
		}

		it("should handle cart operations with derived totals", () => {
			// Given
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

			// Then - empty cart
			expect(cartStore.read().itemCount).toEqual(0);
			expect(cartStore.read().subtotal).toEqual(0);

			// When - add first item
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

			// Then - cart has first item
			expect(cartStore.read().itemCount).toEqual(2);
			expect(cartStore.read().subtotal).toEqual(20);

			// When - add second item
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

			// Then - cart has both items
			expect(cartStore.read().itemCount).toEqual(3);
			expect(cartStore.read().subtotal).toEqual(45);

			// When - apply coupon
			cartStore.update((previous) => ({
				...previous,
				couponCode: "SAVE10",
			}));

			// Then - coupon is applied
			expect(cartStore.read().hasCoupon).toEqual(true);

			// When - clear cart
			cartStore.reset();

			// Then - cart is empty
			expect(cartStore.read().itemCount).toEqual(0);
			expect(cartStore.read().hasCoupon).toEqual(false);
		});
	});

	describe("nested state management", () => {
		it("should handle deeply nested state updates", () => {
			// Given
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

			// Then - initially incomplete
			expect(formStore.read().isPersonalInformationComplete).toEqual(false);

			// When - fill personal info
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

			// Then - personal info is complete
			expect(formStore.read().isPersonalInformationComplete).toEqual(true);

			// When - add validation error
			formStore.update((previous) => ({
				...previous,
				validationErrors: {
					postalCode: "Invalid postal code format",
				},
			}));

			// Then - has validation errors
			expect(formStore.read().hasValidationErrors).toEqual(true);

			// When - clear errors
			formStore.update((previous) => ({
				...previous,
				validationErrors: {},
			}));

			// Then - no validation errors
			expect(formStore.read().hasValidationErrors).toEqual(false);
		});
	});

	describe("multiple stores", () => {
		it("should maintain independent state across stores", () => {
			// Given
			const userStore = createServerStore({
				initial: { userName: "" },
			});

			const settingsStore = createServerStore({
				initial: { darkModeEnabled: false, languageCode: "en" },
			});

			// When - initialize both stores
			userStore.initialize({ userName: "Alice" });
			settingsStore.initialize({ darkModeEnabled: true, languageCode: "es" });

			// Then - both stores have correct values
			expect(userStore.read().userName).toEqual("Alice");
			expect(settingsStore.read().darkModeEnabled).toEqual(true);
			expect(settingsStore.read().languageCode).toEqual("es");

			// When - update one store
			userStore.update(() => ({ userName: "Bob" }));

			// Then - other store is unaffected
			expect(userStore.read().userName).toEqual("Bob");
			expect(settingsStore.read().darkModeEnabled).toEqual(true);
		});
	});
});
