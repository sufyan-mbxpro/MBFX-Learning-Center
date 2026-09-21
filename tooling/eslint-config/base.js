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
 * The `next/cache` restriction, exported on its own for the same reason
 * `noColorLiteralRule` is: flat config REPLACES a rule's value when a later
 * config object sets it again, so any config adding its own
 * `no-restricted-imports` path must re-include this one or it silently stops
 * applying to those files. See adminComboboxRule in next.js.
 */
export const noUnstableCacheImport = {
  name: "next/cache",
  importNames: ["unstable_cache"],
  message:
    'unstable_cache is the legacy caching path (ADR-004). Use "use cache" + cacheTag()/cacheLife(), invalidated with revalidateTag()/updateTag().',
};

/**
 * changes-20 Phase 6 (tokens.md §5, task constraint 6): lucide-react is the
 * one icon library. It already was — this makes it impossible to add a
 * second by accident. Exported for the same reason as the rules above: a
 * config that sets its own `no-restricted-imports` must re-include it.
 */
export const noOtherIconLibraries = {
  group: [
    "react-icons",
    "react-icons/*",
    "@heroicons/*",
    "@radix-ui/react-icons",
    "@tabler/icons-react",
    "@phosphor-icons/*",
    "phosphor-react",
    "react-feather",
    "@fortawesome/*",
    "@mui/icons-material",
    "@mui/icons-material/*",
    "@iconify/*",
    "lucide",
  ],
  message:
    "lucide-react is the only icon library (tokens.md §5). Import the glyph from lucide-react; brand marks go through @repo/ui's SocialGlyph (ADR-045).",
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
        { paths: [noUnstableCacheImport], patterns: [noOtherIconLibraries] },
      ],
    },
  },
  {
    // `.next-e2e` is the E2E harness's own build output (playwright.config.ts
    // sets NEXT_DIST_DIR so `pnpm e2e` and `pnpm dev` can run at once). It is
    // git-ignored but was not eslint-ignored, so any machine that had run the
    // E2E suite got ten thousand errors out of `pnpm lint` in generated
    // chunks — and CI's lint → typecheck → test → build order would too, the
    // first time a build landed before a lint.
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.next-e2e/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/src/generated/**",
    ],
  },
];

export default baseConfig;
