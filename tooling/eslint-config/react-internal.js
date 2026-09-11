import { baseConfig, noColorLiteralRule } from "./base.js";

export const noPhysicalSpacingRule = {
  selector: "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(pl|pr|ml|mr)-\\d/]",
  message:
    "Physical spacing utilities (pl-/pr-/ml-/mr-) are banned — use logical properties (ps-/pe-/ms-/me-) so RTL layouts work without retrofitting.",
};

/**
 * changes-20 Phase 6 / ADR-072 §10 — no arbitrary Tailwind VALUES.
 *
 * A class is an arbitrary value when its bracket CLOSES it: `w-[150px]`,
 * `lg:grid-cols-[1fr_20rem]`. That is what the pattern matches — a
 * `utility-[…]` followed by whitespace or the end of the string. It
 * deliberately does NOT match:
 *   - arbitrary VARIANTS, whose bracket is followed by `:` or `/`
 *     (`data-[side=top]:`, `has-[>img:first-child]:`,
 *     `group-data-[size=sm]/card:`) — selectors, which shadcn's own recipes
 *     are built from and ADR-072 never banned;
 *   - token REFERENCES, `h-(--height-header)` — parentheses, the form
 *     ADR-072 §10 keeps;
 *   - custom-property definitions, `[--card-spacing:--spacing(6)]`, which
 *     set a token rather than inlining a value.
 * A value that has no step belongs in globals.css as a named token (the
 * "Layout tokens" block) and is read as `(--name)`.
 */
const ARBITRARY_VALUE =
  "(^|\\s)(\\S*:)?!?[a-z][a-z0-9-]*-\\[[^\\s\\]]*(\\[[^\\s\\]]*\\][^\\s\\]]*)*\\](?=\\s|$)";
const ARBITRARY_VALUE_MESSAGE =
  "No arbitrary Tailwind values (ADR-072 §10). Use the scale (`w-37.5`, `aspect-4/3`, `opacity-15`), a design-system utility (`text-3xs`, `tracking-caps`), or a named layout token read as a reference (`lg:grid-cols-(--grid-main-aside)`) — add the token to @repo/ui globals.css first if it does not exist.";

export const noArbitraryValueRule = {
  selector: `Literal[value=/${ARBITRARY_VALUE}/]`,
  message: ARBITRARY_VALUE_MESSAGE,
};

export const noArbitraryValueTemplateRule = {
  selector: `TemplateElement[value.raw=/${ARBITRARY_VALUE}/]`,
  message: ARBITRARY_VALUE_MESSAGE,
};

/**
 * Shared React config for packages/apps with JSX (primarily @repo/ui and
 * both apps). Adds the physical-property and arbitrary-value bans to the
 * color-literal ban from base.js — combined into one no-restricted-syntax
 * array because flat config replaces a rule's value wholesale rather than
 * merging it.
 *
 * Test files are exempt from the arbitrary-value ban only: a guard test has
 * to NAME the class it forbids (`not.toContain("grid-cols-[0_1fr]")`).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const reactInternalConfig = [
  ...baseConfig,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        noColorLiteralRule,
        noPhysicalSpacingRule,
        noArbitraryValueRule,
        noArbitraryValueTemplateRule,
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", noColorLiteralRule, noPhysicalSpacingRule],
    },
  },
];

export default reactInternalConfig;
