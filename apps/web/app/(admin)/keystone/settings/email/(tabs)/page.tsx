import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { AdminSection } from "../../../_components/admin-page.tsx";
import { SettingsGroupForm } from "../../settings-group-form.tsx";
import { loadEmailSettingsForm } from "./_lib/email-settings.ts";

// Email → Sender: the from-name, from-address and reply-to every email carries. Saved under
// `settings.update` like any registry field; the layout draws the heading.
export default async function EmailSenderPage() {
  const subject = await requirePermission("settings.view");
  const t = await getTranslations("admin");
  const form = await loadEmailSettingsForm(subject, "sender");

  return (
    <AdminSection title={t("email.senderSection")}>
      <SettingsGroupForm
        settings={form.settings}
        locales={form.locales}
        menus={form.menus}
        labels={form.labels}
      />
    </AdminSection>
  );
}
