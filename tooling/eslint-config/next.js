import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { noUnstableCacheImport } from "./base.js";
import { reactInternalConfig } from "./react-internal.js";

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
  ignores: ["app/(admin)/admin/website/**", "app/(admin)/admin/homepage/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        // noUnstableCacheImport is re-listed, not inherited: flat config
        // replaces this rule's value wholesale, so omitting it here would
        // quietly exempt every admin screen from the ADR-004 ban.
        paths: [
          noUnstableCacheImport,
          {
            name: "@repo/ui/components/select",
            message:
              "Admin dropdowns are searchable and full width (ADR-057) — import AdminCombobox from app/(admin)/admin/_components/combobox.tsx instead. It renders a plain Select below 8 options on its own; pass searchable={false} if a longer list genuinely should not be filterable.",
          },
        ],
      },
    ],
  },
};

export const nextConfig = defineConfig([
  ...reactInternalConfig,
  ...nextVitals,
  ...nextTs,
  adminComboboxRule,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default nextConfig;
