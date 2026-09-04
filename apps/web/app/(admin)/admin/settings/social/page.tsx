import { getTranslations } from "next-intl/server";
import { loadAdminSocialLinks } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { AdminPage, AdminSection } from "../../_components/admin-page.tsx";
import { SettingsNav } from "../_components/settings-nav.tsx";
import { loadSettingsIndex } from "../_components/settings-shared.ts";
import { SocialLinksManager } from "./social-links-manager.tsx";

// Social links live under the settings hub now (changes-01) — full CRUD,
// modal forms, delete confirmation. /admin/social redirects here.
export default async function SocialSettingsPage() {
  const subject = await requirePermission("social.manage");
  const t = await getTranslations("admin");
  const [links, { navEntries }] = await Promise.all([
    loadAdminSocialLinks(),
    loadSettingsIndex(subject, t),
  ]);

  return (
    <AdminPage title={t("social")} description={t("settingsGroupDesc.social")} width="lg">
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav heading={t("settingsCategories")} entries={navEntries} />
        <div className="min-w-0 flex-1">
          <AdminSection>
            <SocialLinksManager
              links={links}
              labels={{
                add: t("socialAdd"),
                edit: t("edit"),
                delete: t("delete"),
                save: t("save"),
                cancel: t("cancel"),
                title: t("socialTitle"),
                url: t("socialUrl"),
                platformKey: t("socialPlatformKey"),
                handle: t("socialHandle"),
                active: t("active"),
                openInNewTab: t("socialOpenInNewTab"),
                showInHeader: t("socialShowInHeader"),
                showInFooter: t("socialShowInFooter"),
                actionsCol: t("actionsCol"),
                deleteTitle: t("socialDeleteTitle"),
                deleteConfirm: t("socialDeleteConfirm"),
                empty: t("noResults"),
                search: t("socialSearch"),
                columns: t("columns"),
                export: t("export"),
                selectedSuffix: t("selectedCount"),
                pageWord: t("pageWord"),
                ofWord: t("ofWord"),
                previous: t("previous"),
                next: t("next"),
              }}
            />
          </AdminSection>
        </div>
      </div>
    </AdminPage>
  );
}
