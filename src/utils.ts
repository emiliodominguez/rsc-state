/**
 * Utility functions for rsc-state library.
 * This module provides helper functions used internally by the store implementation.
 */

/**
 * Checks if a value is a function.
 * Used to determine if initial state is a factory function or direct value.
 *
 * @param value - The value to check
 * @returns True if the value is a function, false otherwise
 */
export function isFunction(value: unknown): value is (...arguments_: unknown[]) => unknown {
	return typeof value === "function";
}

/**
 * Creates a shallow copy of an object with type safety.
 * Used internally for state updates to ensure immutability.
 *
 * @param source - The object to copy
 * @returns A shallow copy of the source object
 */
export function shallowCopy<T extends Record<string, unknown>>(source: T): T {
	return { ...source };
}

/**
 * Merges two objects together, with properties from the second object
 * overriding properties from the first.
 *
 * @param base - The base object
 * @param override - The object with overriding properties
 * @returns A new object with merged properties
 */
export function mergeObjects<T extends Record<string, unknown>, U extends Record<string, unknown>>(base: T, override: U): T & U {
	return { ...base, ...override };
}
