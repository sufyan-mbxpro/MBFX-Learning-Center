import { baseConfig } from "@repo/eslint-config/base";

export default [
  ...baseConfig,
  {
    // Theme fixtures in the admin-mutation tests are literal palette DATA
    // being validated (validateTheme's own inputs) — the same carve-out
    // @repo/theme has package-wide, scoped here to the one test file.
    files: ["src/admin.integration.test.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
