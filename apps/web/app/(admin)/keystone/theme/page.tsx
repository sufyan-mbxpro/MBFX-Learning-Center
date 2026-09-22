import { getTranslations } from "next-intl/server";
import { loadActiveThemeTokens, loadThemePresets } from "@repo/core";
import { themeSurfaceSchema } from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { BRAND_FIELD_REGISTRY, CURATED_FONTS, deriveInteractive, validateTheme } from "@repo/theme";
import { ThemeEditor } from "./theme-editor.tsx";
import { AdminSection } from "../_components/admin-page.tsx";
import { SettingsScreen } from "../settings/_components/settings-screen.tsx";
import { loadSettingsIndex } from "../settings/_components/settings-shared.ts";

export default async function ThemePage({ searchParams }: PageProps<"/keystone/theme">) {
  const subject = await requirePermission("theme.update");
  const t = await getTranslations("admin");
  // Which surface's palette is open (changes-49, ADR-148). The public site by
  // default; anything unrecognised falls back to it rather than erroring.
  const requested = (await searchParams).surface;
  const surface = themeSurfaceSchema.catch("web").parse(requested);
  const [tokens, presets, { navEntries }] = await Promise.all([
    loadActiveThemeTokens(surface),
    // Asked per surface (changes-50), so the preset marked active is the one
    // THIS surface is showing.
    loadThemePresets(surface),
    loadSettingsIndex(subject, t),
  ]);
  const { brand, light, dark, overrides, layout } = tokens;

  // ADR-003: hover/active/interactive shown READ-ONLY as derived previews —
  // computed server-side from the saved palette, never editable.
  const derived = {
    interactive: deriveInteractive(brand.primary, light.background),
    interactiveDark: deriveInteractive(overrides.primary ?? brand.primary, dark.background),
  };

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={t("theme")}
      description={t("pageDesc.theme")}
    >
      <AdminSection>
        <ThemeEditor
          // Keyed by the palette itself, not the row: since ADR-148 activating
          // a preset COPIES it onto the same surface row, so the row key never
          // changed and every tab kept the previous colours in local state
          // (changes-50). A new palette is a new editor.
          key={`${tokens.themeKey}:${JSON.stringify({ brand, light, dark, overrides })}`}
          themeKey={tokens.themeKey}
          surface={surface}
          initial={{ brand, light, dark, overrides, layout }}
          derived={derived}
          // The saved palette's advisories on arrival (changes-46), not only
          // after the next Save — the same server-side check the save runs.
          initialIssues={validateTheme(brand, light, dark, overrides).issues}
          presets={presets}
          brandFields={BRAND_FIELD_REGISTRY.map((f) => f.key)}
          fonts={CURATED_FONTS}
          labels={{
            brand: t("themeBrand"),
            surfaceLabel: t("themeEditor.surfaceLabel"),
            surfaceWeb: t("themeEditor.surfaceWeb"),
            surfaceAdmin: t("themeEditor.surfaceAdmin"),
            surfaceHint: t("themeEditor.surfaceHint"),
            layout: t("themeLayout"),
            modes: t("themeModes"),
            presets: t("themePresets"),
            lightSurface: t("lightSurface"),
            darkSurface: t("darkSurface"),
            save: t("save"),
            saved: t("saved"),
            activate: t("activate"),
            activeBadge: t("activeBadge"),
            issues: t("issues"),
            blockingError: t("blockingError"),
            advisory: t("advisory"),
            derivedPreview: t("derivedPreview"),
            saveBlocked: t("saveBlocked"),
            needsRatio: t("needsRatio"),
            hexValue: t("themeHexValue"),
            // Layout fields have catalog labels; brand/surface token ids
            // are humanized client-side (the registry's labelKeys are
            // Module 02's translation-table mechanism, not yet wired to
            // next-intl).
            fieldLabels: {
              radiusBase: t("themeFieldRadiusBase"),
              containerWidth: t("themeFieldContainerWidth"),
              baseFontSize: t("themeFieldBaseFontSize"),
              fontSans: t("themeFieldFontSans"),
              fontDisplay: t("themeFieldFontDisplay"),
              fontMono: t("themeFieldFontMono"),
            },
          }}
        />
      </AdminSection>
    </SettingsScreen>
  );
}
