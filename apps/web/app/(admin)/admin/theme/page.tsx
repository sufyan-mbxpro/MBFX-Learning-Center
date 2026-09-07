import { getTranslations } from "next-intl/server";
import { loadActiveThemeTokens, loadBrandAssets, loadThemePresets } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { BRAND_FIELD_REGISTRY, CURATED_FONTS, deriveInteractive } from "@repo/theme";
import { ThemeEditor } from "./theme-editor.tsx";
import { AdminSection } from "../_components/admin-page.tsx";
import { SettingsScreen } from "../settings/_components/settings-screen.tsx";
import { loadSettingsIndex } from "../settings/_components/settings-shared.ts";

export default async function ThemePage() {
  const subject = await requirePermission("theme.update");
  const t = await getTranslations("admin");
  const [tokens, presets, brandAssets, { navEntries }] = await Promise.all([
    loadActiveThemeTokens(),
    loadThemePresets(),
    loadBrandAssets(),
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
          themeKey={tokens.themeKey}
          initial={{ brand, light, dark, overrides, layout }}
          derived={derived}
          presets={presets}
          brandAssets={{
            logo_light: brandAssets.logo_light?.url ?? null,
            logo_dark: brandAssets.logo_dark?.url ?? null,
            favicon: brandAssets.favicon?.url ?? null,
          }}
          brandFields={BRAND_FIELD_REGISTRY.map((f) => f.key)}
          fonts={CURATED_FONTS}
          labels={{
            brand: t("themeBrand"),
            layout: t("themeLayout"),
            modes: t("themeModes"),
            presets: t("themePresets"),
            logos: t("themeLogos"),
            logoLight: t("logoLight"),
            logoDark: t("logoDark"),
            favicon: t("favicon"),
            upload: {
              upload: t("uploadImage"),
              replace: t("replaceImage"),
              remove: t("removeImage"),
              uploading: t("uploading"),
              hint: t("uploadHint"),
              cancel: t("cancel"),
              confirmRemoveTitle: t("confirmRemoveImageTitle"),
              confirmRemoveBody: t("confirmRemoveImageBody"),
            },
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
              fontMono: t("themeFieldFontMono"),
            },
          }}
        />
      </AdminSection>
    </SettingsScreen>
  );
}
