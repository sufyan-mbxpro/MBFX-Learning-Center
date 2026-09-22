import { getTranslations } from "next-intl/server";
import { requireAnyPermission } from "@repo/rbac";
import { SettingsScreen } from "../../_components/settings-screen.tsx";
import {
  EMAIL_SECTION_KEYS,
  emailSectionTabs,
  groupDescription,
  groupLabel,
  loadSettingsIndex,
} from "../../_components/settings-shared.ts";

// Email settings as ONE tabbed section (changes-51): Sender · Delivery ·
// Newsletter · Templates · Delivery log. They were a settings page plus two
// more settings-nav entries; now the heading, the description and the strip
// live in this LAYOUT, so a tab click swaps only the content under them
// (ADR-106 #2).
//
// The template EDITOR is outside this route group (`../templates/[key]`): it
// is a record page with its own heading and back link, and inside the strip
// it would carry two headings.
//
// The gate is any key that opens a tab; each page re-checks its own, because
// a layout gate is a gate and not the boundary (security.md #3).
export default async function EmailSettingsLayout({ children }: { children: React.ReactNode }) {
  const subject = await requireAnyPermission([...EMAIL_SECTION_KEYS]);
  const t = await getTranslations("admin");
  const { navEntries } = await loadSettingsIndex(subject, t);

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={groupLabel(t, "email")}
      description={groupDescription(t, "email") ?? undefined}
      tabs={emailSectionTabs(subject, t)}
    >
      {children}
    </SettingsScreen>
  );
}
