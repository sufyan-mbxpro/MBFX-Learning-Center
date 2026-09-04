// Server-side helpers shared by the settings hub, group pages, and the
// social manager: one place decides which settings destinations exist and
// who sees them (permission-filtered; each destination page still re-checks
// its own key — visibility is never the authorization).
import { can, type Subject } from "@repo/rbac";
import { loadAllSettings, type AdminSetting } from "@repo/settings";
import type { SettingsNavEntry } from "./settings-nav.tsx";

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;
type TranslateHas = Translate & { has: (key: string) => boolean };

export function groupLabel(t: TranslateHas, group: string): string {
  return t.has(`settingsGroups.${group}`) ? t(`settingsGroups.${group}`) : group;
}

export function groupDescription(t: TranslateHas, group: string): string | null {
  return t.has(`settingsGroupDesc.${group}`) ? t(`settingsGroupDesc.${group}`) : null;
}

export interface SettingsIndex {
  settings: AdminSetting[];
  groups: string[];
  navEntries: SettingsNavEntry[];
}

export async function loadSettingsIndex(subject: Subject, t: TranslateHas): Promise<SettingsIndex> {
  const canViewSettings = can(subject, "settings.view");
  const settings = canViewSettings ? await loadAllSettings() : [];
  const groups = [...new Set(settings.map((s) => s.groupName))];

  const navEntries: SettingsNavEntry[] = [
    ...groups.map((group) => ({
      href: `/admin/settings/${group}`,
      label: groupLabel(t, group),
    })),
    ...(can(subject, "social.manage")
      ? [{ href: "/admin/settings/social", label: t("social") }]
      : []),
    ...(can(subject, "features.manage") ? [{ href: "/admin/features", label: t("features") }] : []),
    ...(can(subject, "navigation.manage")
      ? [{ href: "/admin/navigation", label: t("navigation") }]
      : []),
    ...(can(subject, "settings.update") ? [{ href: "/admin/homepage", label: t("homepage") }] : []),
    ...(can(subject, "theme.update") ? [{ href: "/admin/theme", label: t("theme") }] : []),
  ];

  return { settings, groups, navEntries };
}
