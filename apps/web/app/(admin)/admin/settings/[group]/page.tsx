import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@repo/rbac";
import { loadAdminMenus, loadBrandAssets } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { AdminSection } from "../../_components/admin-page.tsx";
import { SettingsScreen } from "../_components/settings-screen.tsx";
import {
  SETTINGS_GROUP_TABS,
  groupDescription,
  groupLabel,
  loadSettingsIndex,
} from "../_components/settings-shared.ts";
import { BrandAssetsForm } from "../../_components/brand-assets-form.tsx";
import { SettingsGroupForm, type SettingsTab } from "../settings-group-form.tsx";

// One settings category on its own page (changes-01, image-4): sub-sidebar
// for switching categories, type-driven fields for this group, ONE Save for
// the whole section (changes-02). Unknown group → 404, not an empty page.
export default async function SettingsGroupPage({ params }: PageProps<"/admin/settings/[group]">) {
  const subject = await requirePermission("settings.view");
  const { group } = await params;
  const t = await getTranslations("admin");
  const [{ settings, groups, navEntries }, locales, menus] = await Promise.all([
    loadSettingsIndex(subject, t),
    getActiveLocales(),
    // Resolves footer.menuColumns' menu picker (Phase 9c) — a Select of
    // real menus instead of a free-text key an admin can typo.
    loadAdminMenus(),
  ]);

  if (!groups.includes(group)) notFound();
  // A setting's label is its stored row's, unless the catalog names it
  // (ADR-044 #5's order of preference: a catalog string first). changes-46:
  // the media caps are seeded "Max image upload size (bytes)", which the MB
  // dropdown made untrue — the words move here, the seeded row is untouched.
  const groupSettings = settings
    .filter((s) => s.groupName === group)
    .map((s) =>
      t.has(`settingLabels.${s.key}`) ? { ...s, label: t(`settingLabels.${s.key}`) } : s,
    )
    // The same two-step for the line under a field (changes-49): a setting
    // whose EFFECT is not obvious from its name — which inbox the support
    // form writes to — says so from the catalog.
    .map((s) =>
      t.has(`settingDescriptions.${s.key}`)
        ? { ...s, description: t(`settingDescriptions.${s.key}`) }
        : s,
    );
  const description = groupDescription(t, group);

  const uploadLabels = {
    upload: t("uploadImage"),
    replace: t("replaceImage"),
    remove: t("removeImage"),
    uploading: t("uploading"),
    hint: t("uploadHint"),
    cancel: t("cancel"),
    confirmRemoveTitle: t("confirmRemoveImageTitle"),
    confirmRemoveBody: t("confirmRemoveImageBody"),
  };

  // changes-50: General is tabbed, and its Branding tab is the logos and
  // favicon that were the theme editor's. Their actions gate on
  // `theme.update`, so a subject without it gets no Branding tab rather than
  // uploads that would be refused.
  const tabDefs = (SETTINGS_GROUP_TABS[group] ?? []).filter(
    (tab) => tab.id !== "branding" || can(subject, "theme.update"),
  );
  const brandAssets = tabDefs.some((tab) => tab.id === "branding") ? await loadBrandAssets() : null;
  const tabs: SettingsTab[] | undefined =
    tabDefs.length > 0
      ? tabDefs.map((tab) => ({
          id: tab.id,
          label: t(`settingsTabs.${tab.id}`),
          ...(tab.id === "branding" && brandAssets
            ? {
                content: (
                  <BrandAssetsForm
                    initial={{
                      logo_light: brandAssets.logo_light?.url ?? null,
                      logo_dark: brandAssets.logo_dark?.url ?? null,
                      favicon: brandAssets.favicon?.url ?? null,
                    }}
                    labels={{
                      logoLight: t("logoLight"),
                      logoDark: t("logoDark"),
                      favicon: t("favicon"),
                      saved: t("saved"),
                      upload: uploadLabels,
                    }}
                  />
                ),
              }
            : { keys: tab.keys }),
        }))
      : undefined;

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={groupLabel(t, group)}
      description={description ?? undefined}
    >
      <AdminSection>
        <SettingsGroupForm
          settings={groupSettings}
          locales={locales.map((l) => ({
            code: l.code,
            name: l.name,
            nativeName: l.nativeName,
          }))}
          menus={menus.map((m) => ({ value: m.key, label: m.name }))}
          {...(tabs ? { tabs } : {})}
          labels={{
            save: t("save"),
            saved: t("saved"),
            publicBadge: t("publicBadge"),
            privateBadge: t("privateBadge"),
            selectPlaceholder: t("selectPlaceholder"),
            managedElsewhere: t("settingManagedElsewhere"),
            upload: uploadLabels,
            fields: {
              addRow: t("fieldAddRow"),
              removeRow: t("fieldRemoveRow"),
              emptyList: t("fieldEmptyList"),
              selectPlaceholder: t("selectPlaceholder"),
              cancel: t("cancel"),
              confirmRemoveTitle: t("confirmRemoveRowTitle"),
              confirmRemoveBody: t("confirmRemoveRowBody"),
              // Every labelKey SETTING_FIELDS references, resolved here
              // so the generic editors never touch a catalog themselves.
              field: {
                fieldEnabled: t("fieldEnabled"),
                fieldPhone: t("fieldPhone"),
                fieldPromoText: t("fieldPromoText"),
                fieldPromoUrl: t("fieldPromoUrl"),
                fieldLabel: t("fieldLabel"),
                fieldUrl: t("fieldUrl"),
                fieldText: t("fieldText"),
                fieldDismissible: t("fieldDismissible"),
                fieldPlatform: t("fieldPlatform"),
                fieldMenu: t("fieldMenu"),
              },
            },
          }}
        />
      </AdminSection>
    </SettingsScreen>
  );
}
