import { getTranslations } from "next-intl/server";
import { requireAnyPermission } from "@repo/rbac";
import { SettingsScreen } from "../../_components/settings-screen.tsx";
import {
  TRANSLATION_SECTION_KEYS,
  loadSettingsIndex,
  translationSectionTabs,
} from "../../_components/settings-shared.ts";

// Settings → Translation as ONE tabbed section (ADR-163 #1, ADR-150's shape):
// Overview · Languages · Review · Provider. A static route that wins over
// `settings/[group]`; there is no `translation` settings group to shadow.
//
// The tab strip lives in this LAYOUT, so it survives a soft navigation between
// tabs (ADR-106 #2). The gate is any key that opens a tab; each page re-checks
// its own, because a layout gate is a gate and not the boundary (security.md #3).
export default async function TranslationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const subject = await requireAnyPermission([...TRANSLATION_SECTION_KEYS]);
  const t = await getTranslations("admin");
  const { navEntries } = await loadSettingsIndex(subject, t);

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={t("translate.title")}
      description={t("translate.description")}
      tabs={translationSectionTabs(subject, t)}
    >
      {children}
    </SettingsScreen>
  );
}
