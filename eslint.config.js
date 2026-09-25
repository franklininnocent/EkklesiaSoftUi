// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Transitional baseline for legacy Angular codebase.
      "@angular-eslint/prefer-inject": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-generic-constructors": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "no-case-declarations": "off",
      "no-empty": "off",
      "no-useless-assignment": "off",
      "no-useless-escape": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@angular-eslint/no-output-native": "off",
      "@angular-eslint/no-empty-lifecycle-method": "off",
      "no-restricted-globals": ["error", "confirm", "alert"],
      // Retired UI primitives; see docs/design-system/migration-guide.md.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/shared/components/button/**",
                "**/shared/components/input/**",
                "**/shared/components/card/**",
                "**/shared/components/empty-state/**",
                "**/shared/components/loading-spinner/**",
                "@shared/components/button/**",
                "@shared/components/input/**",
                "@shared/components/card/**",
                "@shared/components/empty-state/**",
                "@shared/components/loading-spinner/**",
              ],
              message:
                "Retired primitive. Use cf-btn, native inputs with cf-form-field, cf-panel, app-cf-empty-state or cf-spinner.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Property[key.name='selector'] > Literal[value=/^app-(button|input|card|empty-state|loading-spinner)$/]",
          message:
            "This selector belonged to a retired primitive. Use cf-btn, native inputs with cf-form-field, cf-panel, app-cf-empty-state or cf-spinner.",
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Keep templates linted, but do not block releases on mass-migration rules.
      "@angular-eslint/template/prefer-control-flow": "off",
      "@angular-eslint/template/click-events-have-key-events": "off",
      "@angular-eslint/template/interactive-supports-focus": "off",
      "@angular-eslint/template/label-has-associated-control": "off",
      "@angular-eslint/template/no-autofocus": "off",
      "@angular-eslint/template/eqeqeq": "off",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
]);
