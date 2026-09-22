import { getTranslations } from "next-intl/server";
import { requireAnyPermission } from "@repo/rbac";
import { SettingsScreen } from "../../_components/settings-screen.tsx";
import {
  AI_SECTION_KEYS,
  aiSectionTabs,
  groupDescription,
  groupLabel,
  loadSettingsIndex,
} from "../../_components/settings-shared.ts";

// The AI section (Module 18), as ONE set of tabs under Settings (changes-51):
// Connection · Usage · Features · Budget & limits · Providers. Until then the
// connection was a settings page and the rest was `/keystone/ai`, a destination
// of its own in the sidebar with its own sub-nav. The owner asked for all of
// it in one place, with the settings sub-nav beside it.
//
// **The tabs are built from what the viewer holds, not filtered after the
// fact** — unchanged from the area it replaces: `ai.providers.manage` is
// super_admin-only (ADR-098), so an `admin` sees no Providers tab at all.
//
// The provider EDITOR (`../providers/new`, `../providers/[id]`) is outside this
// route group: it is a record page with its own heading and back link.
//
// The layout gate is any key that opens a tab; each page re-checks its own,
// because a layout gate is a gate and not the boundary (security.md #3).
export default async function AiSettingsLayout({ children }: { children: React.ReactNode }) {
  const subject = await requireAnyPermission([...AI_SECTION_KEYS]);
  const t = await getTranslations("admin");
  const { navEntries } = await loadSettingsIndex(subject, t);

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={groupLabel(t, "ai")}
      description={groupDescription(t, "ai") ?? undefined}
      tabs={aiSectionTabs(subject, t)}
    >
      {children}
    </SettingsScreen>
  );
}
