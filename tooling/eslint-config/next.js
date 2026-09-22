import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { noColorLiteralRule, noOtherIconLibraries, noUnstableCacheImport } from "./base.js";
import { noPhysicalSpacingRule, reactInternalConfig } from "./react-internal.js";

/**
 * Shared Next.js app config. eslint-config-next ships native flat-config
 * arrays as of Next 16 — no FlatCompat bridge needed.
 *
 * @type {import("eslint").Linter.Config[]}
 */
/**
 * ADR-057 — admin dropdowns go through the one searchable component.
 *
 * Scoped to `app/(admin)/**` because `@repo/ui/components/select` is still
 * the right import for the public site (and for the combobox wrapper itself,
 * which renders Select below its option-count threshold). The cancelled
 * Module 16 surface (ADR-042) and the paused homepage composer (ADR-038) are
 * excluded: ADR-044's scope statement leaves cancelled and paused admin
 * screens out of the display conventions, and they are not being brought up
 * to this one either.
 *
 * @type {import("eslint").Linter.Config}
 */
export const adminComboboxRule = {
  files: ["app/(admin)/**/*.tsx"],
  ignores: ["app/(admin)/keystone/website/**", "app/(admin)/keystone/homepage/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        // noUnstableCacheImport and the icon ban are re-listed, not
        // inherited: flat config replaces this rule's value wholesale, so
        // omitting them here would quietly exempt every admin screen.
        patterns: [noOtherIconLibraries],
        paths: [
          noUnstableCacheImport,
          {
            name: "@repo/ui/components/select",
            message:
              "Admin dropdowns are searchable and full width (ADR-057) — import AdminCombobox from app/(admin)/keystone/_components/combobox.tsx instead. It renders a plain Select below 8 options on its own; pass searchable={false} if a longer list genuinely should not be filterable.",
          },
        ],
      },
    ],
  },
};

/**
 * The cancelled Website Builder (ADR-042) and the paused homepage composer
 * (ADR-038) keep their arbitrary values: they are retained, not maintained,
 * and ADR-044's scope statement leaves them out of every later convention.
 * Same two paths as adminComboboxRule. Everything else in the old rule array
 * still applies to them.
 *
 * @type {import("eslint").Linter.Config}
 */
export const retainedSurfacesRule = {
  files: ["app/(admin)/keystone/website/**/*.tsx", "app/(admin)/keystone/homepage/**/*.tsx"],
  rules: {
    "no-restricted-syntax": ["error", noColorLiteralRule, noPhysicalSpacingRule],
  },
};

export const nextConfig = defineConfig([
  ...reactInternalConfig,
  ...nextVitals,
  ...nextTs,
  adminComboboxRule,
  retainedSurfacesRule,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default nextConfig;
