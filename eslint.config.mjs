// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default tseslint.config(
	{
		ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/*.js", "**/*.mjs", "**/examples/**", "*.config.ts", "tests/**"],
	},
	eslint.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ["**/*.ts"],
		plugins: {
			import: importPlugin,
		},
		settings: {
			"import/resolver": {
				typescript: true,
				node: true,
			},
		},
		rules: {
			// Strict TypeScript rules
			"@typescript-eslint/explicit-function-return-type": "error",
			"@typescript-eslint/explicit-module-boundary-types": "error",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{
					prefer: "type-imports",
					fixStyle: "inline-type-imports",
				},
			],
			"@typescript-eslint/consistent-type-exports": [
				"error",
				{
					fixMixedExportsWithInlineTypeSpecifier: true,
				},
			],
			"@typescript-eslint/naming-convention": [
				"error",
				{ selector: "interface", format: ["PascalCase"] },
				{ selector: "typeAlias", format: ["PascalCase"] },
				{ selector: "typeParameter", format: ["PascalCase"] },
				{ selector: "enum", format: ["PascalCase"] },
				{ selector: "enumMember", format: ["PascalCase"] },
			],
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": "error",
			"@typescript-eslint/await-thenable": "error",
			"@typescript-eslint/prefer-nullish-coalescing": "error",
			"@typescript-eslint/prefer-optional-chain": "error",
			"@typescript-eslint/restrict-template-expressions": [
				"error",
				{
					allowNumber: true,
					allowBoolean: true,
				},
			],
			// Relaxed rules
			"@typescript-eslint/no-unnecessary-condition": "warn",
			"@typescript-eslint/strict-boolean-expressions": "off",
			"@typescript-eslint/no-confusing-void-expression": "off",
			"@typescript-eslint/use-unknown-in-catch-callback-variable": "warn",
			"@typescript-eslint/no-non-null-assertion": "warn",
			"@typescript-eslint/require-await": "warn",

			// General best practices
			eqeqeq: ["error", "always"],
			"no-var": "error",
			"prefer-const": "error",
			"no-console": "off",
			curly: ["error", "all"],
			"no-throw-literal": "error",
			"prefer-template": "error",
			"object-shorthand": "error",

			// Import organization
			"no-duplicate-imports": "off",
			"import/no-duplicates": "error",
			"import/order": [
				"error",
				{
					groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"], "unknown"],
					pathGroupsExcludedImportTypes: ["builtin", "external"],
					"newlines-between": "always",
					alphabetize: {
						order: "asc",
						caseInsensitive: true,
					},
				},
			],
			"sort-imports": [
				"error",
				{
					ignoreCase: false,
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
					memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
					allowSeparatedGroups: true,
				},
			],

			// Padding and spacing
			"padding-line-between-statements": [
				"error",
				{ blankLine: "always", prev: ["const", "let", "var"], next: "*" },
				{ blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
				{ blankLine: "always", prev: "directive", next: "*" },
				{ blankLine: "any", prev: "directive", next: "directive" },
				{ blankLine: "always", prev: "*", next: "return" },
				{ blankLine: "always", prev: "block", next: "*" },
				{ blankLine: "always", prev: "block-like", next: "*" },
			],
		},
	},
	{
		files: ["**/*.test.ts", "**/*.spec.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/no-unnecessary-condition": "off",
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-useless-constructor": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"prefer-template": "off",
			"padding-line-between-statements": "off",
		},
	},
	eslintConfigPrettier,
);
