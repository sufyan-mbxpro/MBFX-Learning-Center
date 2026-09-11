import { getTranslations } from "next-intl/server";
import { loadAdminSocialLinks } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { AdminSection } from "../../_components/admin-page.tsx";
import { SettingsScreen } from "../_components/settings-screen.tsx";
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
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={t("social")}
      description={t("settingsGroupDesc.social")}
    >
      <AdminSection>
        <SocialLinksManager
          links={links}
          labels={{
            add: t("socialAdd"),
            addDescription: t("dialogDesc.addSocialLink"),
            editDescription: t("dialogDesc.editSocialLink"),
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
            iconCol: t("socialIconCol"),
            iconGlyph: t("socialIconGlyph"),
            iconUpload: t("socialIconUpload"),
            iconUploadHint: t("socialIconUploadHint"),
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
    </SettingsScreen>
  );
}
