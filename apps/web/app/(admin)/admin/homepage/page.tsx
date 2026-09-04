import { getTranslations } from "next-intl/server";
import {
  HOME_SECTION_VARIANTS,
  isBuiltHomeSectionKey,
  isKnownHomeSectionKey,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { getSetting } from "@repo/settings";
import { AdminPage, AdminSection } from "../_components/admin-page.tsx";
import { SettingsNav } from "../settings/_components/settings-nav.tsx";
import { loadSettingsIndex } from "../settings/_components/settings-shared.ts";
import { HomepageSections, type HomeSectionRow } from "./homepage-sections.tsx";

// Homepage section manager (changes-03-plan.md §12.4). The brief asked for
// sections to be "enabled/disabled and ordered from the admin without
// duplicating frontend code" — this is that screen. It edits ONE setting
// (`home.sections`) through the existing updateSettingsAction, so there is
// no new server action and no new permission key.
export default async function HomepagePage() {
  // Editing this setting IS a settings write — the same key the generic
  // settings form would need. requirePermission re-checks server-side inside
  // updateSettingsAction too; this gate is UX (security.md #1).
  const subject = await requirePermission("settings.update");

  const t = await getTranslations("admin");
  const [saved, { navEntries }] = await Promise.all([
    getSetting("home.sections"),
    loadSettingsIndex(subject, t),
  ]);

  const rows: HomeSectionRow[] = (saved ?? [])
    .toSorted((a, b) => a.order - b.order)
    .map((section) => ({
      key: section.key,
      enabled: section.enabled,
      variant: section.variant ?? null,
      limit: section.limit ?? null,
      // Which variants this section accepts, straight from the contract that
      // validates the write — so the dropdown can never offer a value the
      // schema will reject.
      variants: isKnownHomeSectionKey(section.key) ? [...HOME_SECTION_VARIANTS[section.key]] : [],
      // §12.4's honesty requirement: a section with no component renders a
      // placeholder on the public site. The admin should learn that here,
      // not by publishing.
      isBuilt: isBuiltHomeSectionKey(section.key),
    }));

  return (
    <AdminPage title={t("homepage")} description={t("homepageSubtitle")} width="lg">
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav heading={t("settingsCategories")} entries={navEntries} />
        <div className="min-w-0 flex-1">
          <AdminSection title={t("homepageSections")}>
            <p className="text-sm text-muted-foreground">{t("homepageSectionsHelp")}</p>
            <HomepageSections
              rows={rows}
              labels={{
                save: t("save"),
                saved: t("saved"),
                moveUp: t("moveUp"),
                moveDown: t("moveDown"),
                enabled: t("enabled"),
                variant: t("homepageVariant"),
                limit: t("homepageLimit"),
                noVariants: t("homepageNoVariants"),
                notBuilt: t("homepageNotBuilt"),
                notBuiltHelp: t("homepageNotBuiltHelp"),
                empty: t("homepageEmpty"),
              }}
            />
          </AdminSection>
        </div>
      </div>
    </AdminPage>
  );
}
