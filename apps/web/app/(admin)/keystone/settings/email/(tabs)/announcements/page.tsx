import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { AdminSection } from "../../../../_components/admin-page.tsx";
import { SettingsGroupForm } from "../../../settings-group-form.tsx";
import { loadEmailSettingsForm } from "../_lib/email-settings.ts";

// Email → Announcements (ADR-171 #12): how fast announcement emails leave and
// what "inactive" means for the Inactive users card. Pacing is a setting
// because the ceiling belongs to the provider. Saved under `settings.update`
// like any registry field; the layout draws the heading.
export default async function EmailAnnouncementsPage() {
  const subject = await requirePermission("settings.view");
  const t = await getTranslations("admin");
  const form = await loadEmailSettingsForm(subject, "announcements");

  return (
    <AdminSection title={t("email.announcementsSection")}>
      <SettingsGroupForm
        settings={form.settings}
        locales={form.locales}
        menus={form.menus}
        labels={form.labels}
      />
    </AdminSection>
  );
}
