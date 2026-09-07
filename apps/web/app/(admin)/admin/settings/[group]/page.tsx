import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { loadAdminMenus } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { AdminSection } from "../../_components/admin-page.tsx";
import { SettingsScreen } from "../_components/settings-screen.tsx";
import { groupDescription, groupLabel, loadSettingsIndex } from "../_components/settings-shared.ts";
import { SettingsGroupForm } from "../settings-group-form.tsx";

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
  const groupSettings = settings.filter((s) => s.groupName === group);
  const description = groupDescription(t, group);

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
          labels={{
            save: t("save"),
            saved: t("saved"),
            publicBadge: t("publicBadge"),
            privateBadge: t("privateBadge"),
            selectPlaceholder: t("selectPlaceholder"),
            managedElsewhere: t("settingManagedElsewhere"),
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
