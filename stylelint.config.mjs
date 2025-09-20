// stylelint.config.mjs
export default {
  extends: [
    // Base rules
    "stylelint-config-standard",
    // SCSS support
    "stylelint-config-standard-scss",
    // Tailwind-friendly (understands @tailwind/@apply etc.)
    "stylelint-config-tailwindcss",
    // Sorted properties + groups (uses plugin-order internally)
    "stylelint-config-clean-order",
  ],
  plugins: ["stylelint-order"],
  // Make SCSS files parse correctly
  overrides: [
    { files: ["**/*.scss"], customSyntax: "postcss-scss" },
    // Optional: lint CSS inside lit/styled template literals
    { files: ["**/*.{ts,tsx,js,jsx}"], customSyntax: "postcss-lit" }, // or "postcss-styled-syntax"
  ],
  rules: {
    // Allow Tailwind & common tooling at-rules
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "layer",
          "variants",
          "responsive",
          "screen",
          "use",
        ],
      },
    ],

    // Enforce variables/tokens for colors (no raw hex/rgb/hsl)
    "declaration-property-value-disallowed-list": {
      "/^(color|background(-color)?|border(-.*)?-color)$/": [
        "/^#/",
        "/^(rgb|hsl)a?\\(/i",
      ],
    },

    // Optional: guard custom property naming
    "custom-property-pattern":
      "^--(color|space|size|font|radius|z|shadow|opacity)-",

    // Stylistic niceties (mostly auto-fixable)
    "color-hex-case": "lower",
    "color-hex-length": "short",
    "alpha-value-notation": "number",
    "selector-class-pattern": null, // relax if you use BEM/TW; tighten later
  },
};
