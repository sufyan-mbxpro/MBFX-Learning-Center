// The permission registry's GROUPS — the cards the role editor draws.
//
// `Permission.groupName` used to be a loose string assigned inline in
// `prisma/seed.ts`, with the role editor ordering groups alphabetically and
// rendering the raw value under a `capitalize` class. Two things were wrong
// with that:
//
//  1. `content` was one card holding 26 keys — every course, lesson, glossary,
//     media and article capability in one scrolling column. Nothing about the
//     admin looks like that: Learning, Glossary, Media and News & Analysis are
//     four separate destinations, authored by different people.
//  2. Alphabetical order put `cms` first and `users` ninth, and `seo` rendered
//     as "Seo" — the exact identifier-on-screen bug ADR-044 #5 exists to stop.
//
// So the groups are page-shaped and this array is their order: it mirrors the
// admin sidebar (People → Learning → Content → System). Display strings are
// NOT here — packages carry no catalogs (code-style.md #2). The role editor
// resolves `admin.permissionGroups.<name>` and falls back to `humanizeKey()`,
// the same two-step `settings-shared.ts` uses for settings groups.
//
// Adding a permission means naming a group that exists here;
// `permission-groups.test.ts` fails on one that doesn't.
//
// ADR-177 re-cut the cards to ONE PER SIDEBAR ENTRY and put them back in the
// sidebar's order, which had drifted: changes-49 moved People below Content
// and changes-51 moved Tools, Market data and Media inside Content, and this
// array followed neither. `PERMISSION_GROUP_SECTIONS` below gives each card
// the sidebar section it sits under, so the role editor draws the same four
// headings the sidebar does.

export const PERMISSION_GROUPS = [
  // ── Learning ──
  // ADR-177 split the old `learning` card. Quizzes and videos have their own
  // keys now, so each screen gets its own card.
  "courses",
  "lessons",
  "quizzes",
  "videos",
  // ── Content ── (the sidebar's order: Glossary, News & Analysis, Promotions,
  // Tools, Market data, Media, Website)
  "glossary",
  "articles",
  // ADR-167: /keystone/promotions is its own screen, so its keys are its own
  // (ADR-083). It sits beside News & Analysis because the sidebar entry does.
  "promotions",
  // ADR-086 #6: /keystone/tools is its own screen, so its keys are its own.
  "tools",
  "market",
  "media",
  "website",
  // ── People ──
  "users",
  "roles",
  "employees",
  // ADR-080 #7. With People because the sidebar entry is: a subscriber list
  // is an audience, curated by whoever manages users, not by whoever can
  // repoint the SMTP host.
  "newsletter",
  // ADR-171: after Newsletter, where the sidebar entry sits.
  "announcements",
  // ── System ── (all of these are tabs of Settings, or have no screen)
  "settings",
  "email",
  // ADR-097: under System, above Settings' own keys, where its screen is.
  "ai",
  "translations",
  "seo",
  "system",
] as const;

export type PermissionGroupName = (typeof PERMISSION_GROUPS)[number];

/** The four headings of the admin sidebar, in its order. */
export const PERMISSION_SECTIONS = ["learning", "content", "people", "system"] as const;

export type PermissionSectionName = (typeof PERMISSION_SECTIONS)[number];

/**
 * Which sidebar heading each card sits under (ADR-177). The role editor draws
 * these headings above the cards. The strings are NOT here (packages carry no
 * catalogs): the screen reads the sidebar's own heading keys.
 */
export const PERMISSION_GROUP_SECTIONS: Record<PermissionGroupName, PermissionSectionName> = {
  courses: "learning",
  lessons: "learning",
  quizzes: "learning",
  videos: "learning",
  glossary: "content",
  articles: "content",
  promotions: "content",
  tools: "content",
  market: "content",
  media: "content",
  website: "content",
  users: "people",
  roles: "people",
  employees: "people",
  newsletter: "people",
  announcements: "people",
  settings: "system",
  email: "system",
  ai: "system",
  translations: "system",
  seo: "system",
  system: "system",
};

/** The section a group sits under; an unregistered group goes under System. */
export function permissionGroupSection(name: string): PermissionSectionName {
  return (PERMISSION_GROUP_SECTIONS as Record<string, PermissionSectionName>)[name] ?? "system";
}

/**
 * Keys that are seeded and can be granted, but that NO code checks yet
 * (ADR-177). They are kept, not deleted, because each names a screen or action
 * that is planned. The role editor marks them "Not used yet" so that granting
 * one is not mistaken for granting something.
 *
 * `permission-usage.test.ts` keeps this list honest in both directions: a key
 * listed here that code starts checking fails, and so does a seeded key that
 * no code checks and that is not listed here.
 */
export const UNUSED_PERMISSIONS = [
  // No screen creates or deletes a user: accounts come from sign-up, and an
  // admin deactivates (users.update) rather than deletes.
  "users.create",
  "users.delete",
  // No screen adds an employee; staff are made from existing users.
  "employees.create",
  // Departments and designations are read on the employee screen, never edited.
  "departments.manage",
  // The calendar is a vendor widget with no admin screen (ADR-050, ADR-137).
  "calendar.manage",
  // There is no comments feature. The Moderator role holds this key.
  "comments.moderate",
  // Feature flags have no admin screen.
  "features.manage",
  // There is no integrations screen.
  "integrations.manage",
  // The sitemap is generated in code and has no settings.
  "sitemaps.manage",
  // There are no maintenance tasks in the admin.
  "system.maintenance",
] as const;

/** True when the key is seeded but nothing checks it yet. */
export function isUnusedPermission(key: string): boolean {
  return (UNUSED_PERMISSIONS as readonly string[]).includes(key);
}

/**
 * Sort index for a group name. An unregistered group sorts LAST rather than
 * throwing: a stale row in a database seeded before a rename must still render
 * somewhere the admin can see it, instead of vanishing from the editor.
 */
export function permissionGroupOrder(name: string): number {
  const index = (PERMISSION_GROUPS as readonly string[]).indexOf(name);
  return index === -1 ? PERMISSION_GROUPS.length : index;
}

/**
 * The groups the old `content` group split into (ADR-083, then ADR-177 cut
 * `learning` into four). The seed reads this to build `content_manager`. A
 * group added to the registry later is deliberately NOT in here: whether a
 * content manager gets it is a privilege decision, not a display one.
 * `quizzes` and `videos` ARE here, because they hold what `lessons.*` used to
 * grant on those two screens.
 */
export const CONTENT_LIFECYCLE_GROUPS = [
  "courses",
  "lessons",
  "quizzes",
  "videos",
  "glossary",
  "media",
  "articles",
] as const satisfies readonly PermissionGroupName[];
