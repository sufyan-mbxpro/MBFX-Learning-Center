// Server-side helpers shared by the settings hub, group pages, and the
// social manager: one place decides which settings destinations exist and
// who sees them (permission-filtered; each destination page still re-checks
// its own key — visibility is never the authorization).
import { can, type Subject } from "@repo/rbac";
import { loadAllSettings, type AdminSetting } from "@repo/settings";
import { humanizeKey } from "@repo/utils";
import type { SettingsNavEntry } from "./settings-nav.tsx";

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;
type TranslateHas = Translate & { has: (key: string) => boolean };

export function groupLabel(t: TranslateHas, group: string): string {
  // ADR-044 #5's order of preference: a catalog string, then `humanizeKey()`.
  // The fallback used to be the raw group key, which is how `media` had been
  // rendering as a lowercase identifier in the sub-nav — found while verifying
  // the email screens (changes-21 F5). `media` now has a label of its own; this
  // stops the NEXT group added without one from doing the same.
  return t.has(`settingsGroups.${group}`) ? t(`settingsGroups.${group}`) : humanizeKey(group);
}

export function groupDescription(t: TranslateHas, group: string): string | null {
  return t.has(`settingsGroupDesc.${group}`) ? t(`settingsGroupDesc.${group}`) : null;
}

export interface SettingsIndex {
  settings: AdminSetting[];
  groups: string[];
  navEntries: SettingsNavEntry[];
}

// Website builder (Module 16) is paused, ADR-037: its only settings group
// (`cms.dataBudget`) is hidden from the hub/sub-nav here. Admin-configurable
// structural/layout settings are paused too, ADR-038 — the owner wants
// header/footer/homepage structure handled module-by-module in code, not
// admin-edited. In both cases the setting rows and their stored values are
// untouched — anything that still reads them at render time keeps working;
// only the admin editing screen is unreachable while paused. Drop a key
// from this set to restore its screen.
const PAUSED_SETTINGS_GROUPS = new Set(["cms", "layout"]);

// Navigation reordering and homepage section composition are paused too
// (ADR-038, same reasoning as PAUSED_SETTINGS_GROUPS above) — these aren't
// settings-registry groups so they need their own switch. Flip back to
// `true` to restore both entries.
const STRUCTURAL_DESIGN_ADMIN_UI_ENABLED = false;

export async function loadSettingsIndex(subject: Subject, t: TranslateHas): Promise<SettingsIndex> {
  const canViewSettings = can(subject, "settings.view");
  const settings = canViewSettings ? await loadAllSettings() : [];
  const groups = [...new Set(settings.map((s) => s.groupName))].filter(
    (group) => !PAUSED_SETTINGS_GROUPS.has(group),
  );

  const navEntries: SettingsNavEntry[] = [
    ...groups.flatMap((group) => [
      { href: `/admin/settings/${group}`, label: groupLabel(t, group) },
      // Email (Module 17) is one registry group with three screens, because a
      // template body and a delivery log are not settings fields. They are
      // listed beside their group rather than nested: `SettingsNav` is flat,
      // and the alternative — reaching them only from inside the email screen
      // — hides the log from `support`, who holds no other email key.
      ...(group === "email"
        ? [
            ...(can(subject, "email.templates.view")
              ? [{ href: "/admin/settings/email/templates", label: t("email.templatesNav") }]
              : []),
            ...(can(subject, "email.log.view")
              ? [{ href: "/admin/settings/email/log", label: t("email.logNav") }]
              : []),
          ]
        : []),
    ]),
    // The log again, for a subject who cannot see the `email` group at all —
    // `support` has `email.log.view` and not `settings.view`, so `groups` is
    // empty for them and the branch above never runs.
    ...(!canViewSettings && can(subject, "email.log.view")
      ? [{ href: "/admin/settings/email/log", label: t("email.logNav") }]
      : []),
    ...(can(subject, "social.manage")
      ? [{ href: "/admin/settings/social", label: t("social") }]
      : []),
    ...(can(subject, "features.manage") ? [{ href: "/admin/features", label: t("features") }] : []),
    ...(STRUCTURAL_DESIGN_ADMIN_UI_ENABLED && can(subject, "navigation.manage")
      ? [{ href: "/admin/navigation", label: t("navigation") }]
      : []),
    ...(STRUCTURAL_DESIGN_ADMIN_UI_ENABLED && can(subject, "settings.update")
      ? [{ href: "/admin/homepage", label: t("homepage") }]
      : []),
    ...(can(subject, "theme.update") ? [{ href: "/admin/theme", label: t("theme") }] : []),
  ];

  return { settings, groups, navEntries };
}
