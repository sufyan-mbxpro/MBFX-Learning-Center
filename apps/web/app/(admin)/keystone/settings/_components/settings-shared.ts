// Server-side helpers shared by the settings hub, group pages, and the
// social manager: one place decides which settings destinations exist and
// who sees them (permission-filtered; each destination page still re-checks
// its own key — visibility is never the authorization).
import { can, type Subject } from "@repo/rbac";
import { loadAllSettings, type AdminSetting } from "@repo/settings";
import { humanizeKey } from "@repo/utils";
import type { SettingsNavEntry, SettingsSectionTab } from "./settings-nav.tsx";

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

const EMAIL_ROOT = "/keystone/settings/email";
const AI_ROOT = "/keystone/settings/ai";

/**
 * Email's tabs (changes-51: "all the email should be shift in tabs under one
 * email settings"). Built from what the viewer holds, like the AI tabs, so a
 * tab the viewer cannot open is absent rather than a link to a 403. Sender,
 * Delivery and Newsletter are one registry group; Templates and the log are
 * their own keys (ADR-078 #4) — `support` holds only the log's.
 */
export function emailSectionTabs(subject: Subject, t: TranslateHas): SettingsSectionTab[] {
  const settings = can(subject, "settings.view");
  return [
    ...(settings
      ? [
          { href: EMAIL_ROOT, label: t("email.tabSender"), exact: true },
          { href: `${EMAIL_ROOT}/delivery`, label: t("email.tabDelivery") },
          { href: `${EMAIL_ROOT}/newsletter`, label: t("email.tabNewsletter") },
        ]
      : []),
    ...(can(subject, "email.templates.view")
      ? [{ href: `${EMAIL_ROOT}/templates`, label: t("email.tabTemplates") }]
      : []),
    ...(can(subject, "email.log.view")
      ? [{ href: `${EMAIL_ROOT}/log`, label: t("email.tabLog") }]
      : []),
  ];
}

/**
 * AI's tabs (changes-51: "all the ai settings should also use the tabs in one
 * section & only show in the settings page"). The area that was `/keystone/ai`
 * with its own sidebar entry is now these tabs under Settings; the
 * permission split is unchanged (ADR-098 — Providers stays super_admin-only).
 */
export function aiSectionTabs(subject: Subject, t: TranslateHas): SettingsSectionTab[] {
  const manage = can(subject, "ai.settings.manage");
  const providers = can(subject, "ai.providers.manage");
  return [
    ...(can(subject, "settings.view") || manage || providers
      ? [{ href: AI_ROOT, label: t("ai.navSetup"), exact: true }]
      : []),
    ...(can(subject, "ai.usage.view")
      ? [{ href: `${AI_ROOT}/usage`, label: t("ai.navUsage") }]
      : []),
    ...(manage
      ? [
          { href: `${AI_ROOT}/features`, label: t("ai.navFeatures") },
          { href: `${AI_ROOT}/limits`, label: t("ai.navLimits") },
        ]
      : []),
    ...(providers ? [{ href: `${AI_ROOT}/providers`, label: t("ai.navProviders") }] : []),
  ];
}

/** The keys that open any AI tab — the section's gate and its nav entry's. */
export const AI_SECTION_KEYS = [
  "settings.view",
  "ai.usage.view",
  "ai.settings.manage",
  "ai.providers.manage",
] as const;

/** The keys that open any Email tab. */
export const EMAIL_SECTION_KEYS = [
  "settings.view",
  "email.templates.view",
  "email.log.view",
] as const;

/** A section's sub-nav entry: it lands on the first tab the viewer can open. */
function sectionEntry(tabs: SettingsSectionTab[], root: string, label: string): SettingsNavEntry[] {
  const first = tabs[0];
  return first ? [{ href: first.href, label, prefix: root }] : [];
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
//
// `articles` is not paused but DELETED (ADR-144 §5): its four values keep
// their seeded rows and are still read, and changing them is a seed or code
// change. It sits in the same set because the effect is the same — no hub
// card, no sub-nav entry, and `/keystone/settings/articles` answers 404.
const PAUSED_SETTINGS_GROUPS = new Set(["cms", "layout", "articles"]);

// Navigation reordering and homepage section composition are paused too
// (ADR-038, same reasoning as PAUSED_SETTINGS_GROUPS above) — these aren't
// settings-registry groups so they need their own switch. Flip back to
// `true` to restore both entries.
const STRUCTURAL_DESIGN_ADMIN_UI_ENABLED = false;

export async function loadSettingsIndex(subject: Subject, t: TranslateHas): Promise<SettingsIndex> {
  const canViewSettings = can(subject, "settings.view");
  const settings = canViewSettings ? await loadAllSettings() : [];
  // changes-38: General leads (and Theme follows it, below) — the two an
  // admin opens first. The rest keep the alphabetical order the reader
  // returns; `toSorted` is stable, so only `general` moves.
  const groups = [...new Set(settings.map((s) => s.groupName))]
    .filter((group) => !PAUSED_SETTINGS_GROUPS.has(group))
    .toSorted((a, b) => Number(b === "general") - Number(a === "general"));

  const themeEntry: SettingsNavEntry[] = can(subject, "theme.update")
    ? [{ href: "/keystone/theme", label: t("theme") }]
    : [];
  const leadsWithGeneral = groups[0] === "general";

  // changes-51: Email and AI are ONE entry each, landing on the first tab the
  // viewer can open and staying lit on every tab under it. Templates and the
  // log used to be two more entries beside Email; they are tabs now. The
  // entry is built from the tabs, so `support` (the log's key alone) and an
  // `ai.usage.view`-only role still reach their one tab.
  const emailEntry = sectionEntry(emailSectionTabs(subject, t), EMAIL_ROOT, groupLabel(t, "email"));
  const aiEntry = sectionEntry(aiSectionTabs(subject, t), AI_ROOT, groupLabel(t, "ai"));

  const navEntries: SettingsNavEntry[] = [
    // changes-38: "the general & theme should be placed at the start".
    // Theme is not a registry group, so it is spliced in after General — or
    // first, for a subject who cannot see the groups at all.
    ...(leadsWithGeneral ? [] : themeEntry),
    ...groups.flatMap((group) =>
      group === "email"
        ? emailEntry
        : group === "ai"
          ? aiEntry
          : [
              { href: `/keystone/settings/${group}`, label: groupLabel(t, group) },
              ...(group === "general" ? themeEntry : []),
            ],
    ),
    // The two sections again, for a subject who cannot see the registry
    // groups at all — `support` has `email.log.view` and not `settings.view`,
    // so `groups` is empty for them and the branch above never runs.
    ...(groups.includes("email") ? [] : emailEntry),
    ...(groups.includes("ai") ? [] : aiEntry),
    // changes-37 (ADR-121 §6): the market data provider — its API key and
    // refresh — beside the AI provider, which already has a settings screen.
    // Gated on the provider's own key rather than `settings.view`, so the
    // entry appears exactly for whoever the destination admits.
    ...(can(subject, "market.providers.manage")
      ? [{ href: "/keystone/settings/market", label: t("marketData.providerTitle") }]
      : []),
    ...(can(subject, "social.manage")
      ? [{ href: "/keystone/settings/social", label: t("social") }]
      : []),
    ...(STRUCTURAL_DESIGN_ADMIN_UI_ENABLED && can(subject, "navigation.manage")
      ? [{ href: "/keystone/navigation", label: t("navigation") }]
      : []),
    ...(STRUCTURAL_DESIGN_ADMIN_UI_ENABLED && can(subject, "settings.update")
      ? [{ href: "/keystone/homepage", label: t("homepage") }]
      : []),
  ];

  return { settings, groups, navEntries };
}

/**
 * The tabs a settings group is split into (changes-50: "the general settings
 * page should be shown in tabs"). A key no tab lists falls onto the group's
 * first tab, so a setting added later is never unreachable. `branding` holds
 * no keys: it is the logos and favicon, which moved here from the theme
 * editor and save through their own actions. A tab's label is
 * `admin.settingsTabs.<id>`.
 */
export const SETTINGS_GROUP_TABS: Record<string, { id: string; keys: readonly string[] }[]> = {
  general: [
    { id: "site", keys: ["site.name", "site.tagline", "site.description"] },
    { id: "contact", keys: ["site.contactEmail", "site.supportEmail", "site.reviewsUrl"] },
    {
      id: "regional",
      keys: ["site.defaultLocale", "site.defaultTimezone", "site.defaultThemeMode"],
    },
    {
      id: "security",
      keys: ["security.adminSessionTimeout", "security.learnerSessionTimeout"],
    },
    { id: "branding", keys: [] },
  ],
};
