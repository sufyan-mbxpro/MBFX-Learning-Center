# ADR-083: Permission cards are page-shaped, and their order is code

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 03 (rbac), 10 (users, roles, employees), 01 (db)
**Supersedes:** the nine ad-hoc `groupName` values assigned inline in
`prisma/seed.ts`'s `PERMISSIONS` registry (Module 01, unchanged since scaffold).
Extends ADR-044 #5 to the role editor's group headings.
**Superseded by:** —

## Context

The owner asked that permissions be listed the way the admin's own pages are
grouped — courses and lessons in a card of their own, the way News & Analysis
has one.

They did not, and could not. `Permission.groupName` held nine values, and one of
them, `content`, held 26 of the 75 keys: every course, lesson, glossary, media,
article and comment capability in a single scrolling column. Nothing in the
admin looks like that. Learning, Glossary, Media and News & Analysis are four
separate sidebar destinations, authored by different people, and a role editor
that files them together is asking whoever grants a role to hold the mapping in
their head.

Two smaller faults travelled with it:

- **The order was the alphabet.** `cms` drew first and `users` ninth, so the
  screen opened on the capabilities of a module that was cancelled (ADR-042) and
  buried the ones every role actually uses.
- **The heading was a raw identifier under a `capitalize` class** — the exact
  bug ADR-044 #5 exists to stop, and `capitalize` only ever fixes the first
  letter, so `seo` rendered as "Seo".

## Decision

**1. Groups are page-shaped, and there are thirteen of them.** `content` is
gone, split into `learning` (courses, lessons — and so quizzes and videos, which
are gated on the lesson keys by ADR-058 #8 and ADR-068 §3), `glossary`, `media`
and `articles` (which takes `comments.moderate`, since a comment hangs off an
article and is moderated nowhere else). `cms` is renamed `website` to match the
screen it governs.

**2. Their order is a code registry, not the alphabet.**
`packages/db/src/permission-groups.ts` exports `PERMISSION_GROUPS` as an ordered
array mirroring the admin sidebar — People → Learning → Content → data and reach
→ System. `loadRoleMatrix()` sorts by its index. It lives in `@repo/db` for the
reason `role-exclusions.ts` and `email-template-defaults.ts` do: the seed reads
it, `@repo/core` reads it, and `@repo/db` is the only package below both.

**3. An unregistered group sorts last; it never disappears.**
`permissionGroupOrder()` returns the array length for a name it does not know. A
database seeded before a rename still holds the old value, and a card that
vanishes hides granted permissions — the failure that actually matters.

**4. Display strings are catalog keys, resolved at the screen.** The registry
holds names and order and no prose, because packages carry no catalogs
(code-style.md #2). `admin.permissionGroups.<name>` and
`admin.permissionGroupDesc.<name>`, resolved through `t.has` with a
`humanizeKey()` fallback — the same two-step `settings-shared.ts` already uses
for settings groups. The `capitalize` class is removed: a catalog string is
never re-cased.

**5. Each card carries a description naming the screens it governs.** ADR-044 #8
one level down — "Courses, lessons, quizzes and videos under Learning" is the
sentence that answers the question the grouping raised.

**6. Within a card, keys read in registry order, not alphabetically.** The seed
writes `sortOrder` from the registry index and `loadRoleMatrix()` orders by it,
so a card reads view → create → update → delete → publish. Alphabetically
`create` precedes `view`, which put the key that grants access at all in fourth
place on every card.

**7. `content_manager`'s grant set does not move.** It was seeded by filtering
the registry for the `content` group. It now filters for
`CONTENT_LIFECYCLE_GROUPS` — the four groups that group was cut into, named as
their own constant. A group added to the registry later is deliberately not in
it: whether a content manager gets a new capability is a privilege decision, not
a display one, and `permission-groups.test.ts` pins the resulting key set.

**8. The per-user override dropdown takes the same order and the same labels.**
It had been rendering 75 raw dotted identifiers in one alphabetical list, which
is ADR-044 #5 again. Options are now `"<group> · <permission label>"` in card
order, which is also what makes the combobox's search input useful: typing
"courses" narrows to all ten course and lesson keys.

## Consequences

- **No migration, no reset.** `groupName` is a value, not a column, and the
  seed's permission upsert already updates it. `pnpm db:seed` re-groups an
  existing database; `sortOrder` lands in the same pass.
- **No key was added, removed or renamed.** Every `requirePermission()` string
  in the repo is untouched, and `check:permission-keys` sees the same registry
  it always did — the tuple shape its regex reads is unchanged.
- **Adding a permission now means naming a group that exists.**
  `permission-groups.test.ts` fails in both directions: a seed group missing
  from the registry, and a registry group with no keys.
- **Reordering the screen is reordering one array.** Which is why the test spells
  the expected order out rather than deriving it — a reorder should be a
  deliberate edit in two places, not a silent one.
