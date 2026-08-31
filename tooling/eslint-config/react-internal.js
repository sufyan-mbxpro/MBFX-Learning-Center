import { baseConfig, noColorLiteralRule } from "./base.js";

const noPhysicalSpacingRule = {
  selector:
    "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(pl|pr|ml|mr)-\\d/]",
  message:
    "Physical spacing utilities (pl-/pr-/ml-/mr-) are banned — use logical properties (ps-/pe-/ms-/me-) so RTL layouts work without retrofitting.",
};

/**
 * Shared React config for packages/apps with JSX (primarily @repo/ui and
 * both apps). Adds the physical-property ban to the color-literal ban from
 * base.js — combined into one no-restricted-syntax array because flat
 * config replaces a rule's value wholesale rather than merging it.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const reactInternalConfig = [
  ...baseConfig,
  {
    rules: {
      "no-restricted-syntax": ["error", noColorLiteralRule, noPhysicalSpacingRule],
    },
  },
];

export default reactInternalConfig;
