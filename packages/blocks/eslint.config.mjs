import { baseConfig, noColorLiteralRule } from "@repo/eslint-config/base";
import { noPhysicalSpacingRule } from "@repo/eslint-config/react-internal";

// ADR-032 §4: Tailwind v4 only emits classes it finds statically in source.
// A block that builds a class name from a template literal (`bg-${token}`)
// silently produces a class that never ships in the built CSS — every
// enum-to-class mapping under this package must be a literal lookup table
// (src/styles/tables.ts), never a template. Local to @repo/blocks: it is
// the only package whose renderers turn authored (admin-controlled) enum
// values into class names; `@repo/ui`'s own classes are hand-written.
const noClassNameTemplateLiteralRule = {
  selector:
    "CallExpression[callee.name='cn'] TemplateLiteral, JSXAttribute[name.name='className'] TemplateLiteral",
  message:
    "No template literals for class names in @repo/blocks — every enum-to-class mapping must be a literal lookup table (ADR-032 §4); Tailwind v4 only emits classes it finds statically in source.",
};

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        noColorLiteralRule,
        noPhysicalSpacingRule,
        noClassNameTemplateLiteralRule,
      ],
    },
  },
];
