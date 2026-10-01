# ADR-177 — Permission cards follow the sidebar; quizzes and videos get their own keys

- **Status:** Accepted
- **Date:** 2026-10-01
- **Modules:** 03 (rbac), 10 (users, roles, employees), 11 (content)
- **Supersedes:** ADR-058 #8 (quizzes gated on the lesson keys) and ADR-068 §3
  (videos gated on the lesson keys).
- **Amends:** ADR-083 (permission cards are page-shaped): the cards are cut one
  per sidebar entry and grouped under the sidebar's headings.

## Context

The owner asked for an audit of roles and permissions: are the permissions
grouped the way the modules are, are any missing, and does each role work as
assigned. The audit found five problems.

1. **The card order no longer matched the sidebar.** ADR-083's rule is that
   `PERMISSION_GROUPS` mirrors the sidebar. changes-49 moved People below
   Content and changes-51 moved Tools, Market data and Media into Content.
   The array followed neither, so the role editor opened on Users while the
   sidebar opens on Learning.
2. **Quizzes and videos had no keys of their own.** Courses, Lessons, Quizzes
   and Videos are four sidebar entries, but Lessons, Quizzes and Videos shared
   `lessons.*`. Nobody could be given lessons without quizzes and videos, or
   the reverse. ADR-058 and ADR-068 named this cost and said a separate group
   was "the additive fix if that ever matters". The owner has now asked for it.
3. **Seeded roles could not reach screens they were granted.** Content Manager
   and Editor hold `translations.view`, whose only screen is Settings →
   Translation. The Settings sidebar row and the settings hub each kept their
   own list of entry keys, and neither had `translations.view`, so the
   Translation review queue could be opened only by typing its URL. The two
   lists also disagreed with each other (`theme.update` and
   `market.providers.manage` were on one and not the other).
4. **Offboarding was gated on the wrong key.** The seed labels
   `employees.delete` "Remove employees", but offboarding checked
   `employees.update`, so the delete key governed nothing and anyone who could
   edit an employee record could end that person's staff access.
5. **Ten keys are checked by no code:** `users.create`, `users.delete`,
   `employees.create`, `departments.manage`, `calendar.manage`,
   `comments.moderate`, `features.manage`, `integrations.manage`,
   `sitemaps.manage` and `system.maintenance`. The role editor drew them like
   working keys. The Moderator role is built on `comments.moderate`, and there
   is no comments feature, so that role can only view users.

## Decision

1. **One card per sidebar entry, in sidebar order, under the sidebar's
   headings.** `PERMISSION_GROUPS` is now: Learning (`courses`, `lessons`,
   `quizzes`, `videos`), Content (`glossary`, `articles`, `promotions`,
   `tools`, `market`, `media`, `website`), People (`users`, `roles`,
   `employees`, `newsletter`, `announcements`), System (`settings`, `email`,
   `ai`, `translations`, `seo`, `system`). `PERMISSION_GROUP_SECTIONS` maps
   each card to its heading, and the role editor draws a heading wherever the
   section changes, using the sidebar's own catalog keys. `roles.view` and
   `roles.manage` move to a `roles` card. `permissions.assign` stays under
   Users, because it is used on a user's record.
2. **Ten new keys:** `quizzes.{view,create,update,delete,publish}` and
   `videos.{view,create,update,delete,publish}`. Video categories use the
   video keys. Every quiz and video screen, action, publish transition, purge,
   dashboard count and AI surface now checks them.
3. **Nobody's access changes.** The seed grants the twins to every system role
   that held the lesson key (Editor, Author, SEO Manager; Content Manager,
   Admin and Read Only through their existing rules). The migration
   `20261001120000_quiz_video_permissions_adr177` does the same for custom
   roles, which the seed never rewrites, and copies every per-user override.
   A DENY on a lesson key becomes a DENY on its twins, so the split cannot hand
   anyone a permission they were refused.
4. **Settings has one list of entry keys.** `SETTINGS_ENTRY_KEYS` is read by
   both the sidebar row and the hub. `settings-entry-keys.test.ts` reads every
   settings page and fails if one admits a key the list does not.
5. **Offboarding checks `employees.delete`** (relabelled "Offboard
   employees"). The migration grants it to every role and override that held
   `employees.update`, so nobody loses the ability this change moves.
6. **Unused keys are kept, and marked.** `UNUSED_PERMISSIONS` lists the ten.
   The role editor and the user override picker show "Not used yet" beside
   them. `permission-usage.test.ts` fails both ways: a listed key that code
   starts checking, and a seeded key that nothing checks and that is not
   listed. Deleting them, and deciding what the Moderator role is for, are
   left for the owner.

## Consequences

- A role can now be given lessons without quizzes or videos, and the reverse.
- The role editor has 22 cards under four headings instead of 18 in one list.
- A new seeded key that nothing checks fails CI until it is wired or listed.
- Still open, recorded here so it is not lost: the SEO Manager role holds
  `seo.update`, but every editor's SEO fields save through the content key
  (`news.manage`, `courses.update`, …), so an SEO Manager can read content and
  cannot change any SEO field. Its `redirects.manage` opens a screen under the
  Website Builder, which ADR-042 hides. Fixing either is a design decision for
  the owner, not an audit fix.
