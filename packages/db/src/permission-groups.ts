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

export const PERMISSION_GROUPS = [
  // People
  "users",
  "employees",
  // ADR-080 #7. It sits with People rather than with `email` because the
  // sidebar entry does: a subscriber list is an audience, and the person who
  // manages it is the person who manages users — not the one who can repoint
  // the SMTP host.
  "newsletter",
  // Learning
  "learning",
  // Content
  "glossary",
  "media",
  "articles",
  "website",
  // Data & reach
  "market",
  // ADR-086 #6 — the FOURTEENTH group, and the first use of ADR-083's
  // escape hatch. /admin/tools is its own screen, so its keys are its own.
  // Instruments deliberately got NO new keys: market.* has been seeded since
  // Module 01 and had governed nothing.
  "tools",
  "translations",
  "seo",
  // System
  "email",
  // ADR-097 — the FIFTEENTH group. changes-29 §7.2 wrote "between tools and
  // translations"; §10 puts the sidebar entry under System, above Settings,
  // and ADR-083's rule (code-style.md #11b) is that this array MIRRORS the
  // sidebar. The two halves of the plan disagreed, so the binding rule decides
  // and the group sits where its screen does.
  "ai",
  "settings",
  "system",
] as const;

export type PermissionGroupName = (typeof PERMISSION_GROUPS)[number];

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
 * The four groups the old `content` group split into — read by the seed to
 * build `content_manager`, whose grant set has to survive the split unchanged.
 * A group added to the registry later is deliberately NOT in here: whether a
 * content manager gets it is a privilege decision, not a display one.
 */
export const CONTENT_LIFECYCLE_GROUPS = [
  "learning",
  "glossary",
  "media",
  "articles",
] as const satisfies readonly PermissionGroupName[];
