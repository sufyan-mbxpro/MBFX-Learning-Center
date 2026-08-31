import { baseConfig } from "@repo/eslint-config/base";

// @repo/theme is the one package allowed to write hex literals — it defines
// the default token values everything else must reference symbolically.
// See tooling/eslint-config/base.js (noColorLiteralRule) and
// .claude/rules/code-style.md.
export default [
  ...baseConfig,
  {
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
