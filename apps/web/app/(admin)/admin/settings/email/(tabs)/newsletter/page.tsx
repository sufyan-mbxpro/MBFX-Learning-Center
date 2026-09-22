import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { AdminSection } from "../../../../_components/admin-page.tsx";
import { SettingsGroupForm } from "../../../settings-group-form.tsx";
import { loadEmailSettingsForm } from "../_lib/email-settings.ts";

// Email → Newsletter: where the signup form is drawn (ADR-080 #5). Saved under
// `settings.update` like any registry field; the layout draws the heading.
export default async function EmailNewsletterPage() {
  const subject = await requirePermission("settings.view");
  const t = await getTranslations("admin");
  const form = await loadEmailSettingsForm(subject, "newsletter");

  return (
    <AdminSection title={t("email.placementsSection")}>
      <SettingsGroupForm
        settings={form.settings}
        locales={form.locales}
        menus={form.menus}
        labels={form.labels}
      />
    </AdminSection>
  );
}
