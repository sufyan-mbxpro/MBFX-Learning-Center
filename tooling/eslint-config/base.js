// eslint-plugin-import-x, not eslint-plugin-import: the original's peer
// range stops at ESLint 9; the maintained fork supports ESLint 10.
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * A single `no-restricted-syntax` selector entry. Exported individually
 * (rather than baked into a fixed array) because ESLint flat config replaces
 * a rule's whole value when two config objects both set it — consumers that
 * need to add their own selector (see react-internal.js) must combine this
 * with theirs into one array rather than layering configs.
 */
export const noColorLiteralRule = {
  selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
  message:
    "No hex color literals outside @repo/theme's own token definitions. Use a semantic token instead — see .claude/rules/code-style.md. (@repo/theme overrides this rule locally for its default palettes.)",
};

/**
 * Shared flat-config base for every package and app. Anything workspace-wide
 * (no color literals outside theme, import hygiene) lives here so it can't
 * be silently opted out of per-app. The physical-property ban lives in
 * react-internal.js since non-UI packages have no JSX to check.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    plugins: { "import-x": importX },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "import-x/no-cycle": "error",
      "no-restricted-syntax": ["error", noColorLiteralRule],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/cache",
              importNames: ["unstable_cache"],
              message:
                "unstable_cache is the legacy caching path (ADR-004). Use \"use cache\" + cacheTag()/cacheLife(), invalidated with revalidateTag()/updateTag().",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/src/generated/**",
    ],
  },
];

export default baseConfig;
