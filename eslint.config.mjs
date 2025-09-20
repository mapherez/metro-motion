// eslint.config.js (root)
import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import promisePlugin from "eslint-plugin-promise";
import unusedImports from "eslint-plugin-unused-imports";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  // Ignore build artifacts
  {
    ignores: [
      "dist/**",
      "build/**",
      ".turbo/**",
      "coverage/**",
      "**/*.d.ts",
      "**/*.tsbuildinfo"
    ]
  },

  // Base JS recommended
  js.configs.recommended,

  // TS/React projects
  {
    files: ["**/*.{ts,tsx,js}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      promise: promisePlugin,
      "unused-imports": unusedImports,
      "jsx-a11y": jsxA11y
    },
    settings: {
      // so import plugin resolves TS path aliases across the monorepo
      "import/resolver": {
        typescript: {
          project: [
            "tsconfig.base.json",
            "apps/*/tsconfig.json",
            "packages/*/tsconfig.json"
          ],
          alwaysTryTypes: true
        }
      }
    },
    rules: {
      // Hygiene
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "unused-imports/no-unused-imports": "warn",
      eqeqeq: ["warn", "smart"],
      curly: ["warn", "all"],

      // Import hygiene (soft for now)
      "import/order": ["warn", {
        groups: ["builtin","external","internal","parent","sibling","index","object","type"],
        "newlines-between": "always"
      }],
      "import/no-internal-modules": ["warn", { forbid: ["@*/**/dist/**", "@*/**/src/**"] }],
      "no-restricted-imports": ["warn", { patterns: ["apps/*"] }]
    }
  },

  // A11y rules apply to TSX files
  {
    files: ["**/*.tsx"],
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      // start lenient; you can tighten later
      ...jsxA11y.configs.recommended.rules
    }
  },
  // Frontend browser globals
  { files: ["apps/frontend/**/*.{ts,tsx}"], languageOptions: { globals: globals.browser } },

  { files: ["apps/backend/**/*.{ts,tsx}"], languageOptions: { globals: globals.node } },
  { files: ["**/*.config.{js,cjs,mjs,ts}", "**/vite.*.{js,ts}", "**/vitest.config.{js,ts}"], languageOptions: { globals: globals.node } }
];
