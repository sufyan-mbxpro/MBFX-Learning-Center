import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { loadAdminMenus } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { AdminPage, AdminSection } from "../../_components/admin-page.tsx";
import { SettingsNav } from "../_components/settings-nav.tsx";
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
    <AdminPage title={groupLabel(t, group)} description={description ?? undefined} width="lg">
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav heading={t("settingsCategories")} entries={navEntries} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
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
                },
                fields: {
                  addRow: t("fieldAddRow"),
                  removeRow: t("fieldRemoveRow"),
                  emptyList: t("fieldEmptyList"),
                  selectPlaceholder: t("selectPlaceholder"),
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
        </div>
      </div>
    </AdminPage>
  );
}
