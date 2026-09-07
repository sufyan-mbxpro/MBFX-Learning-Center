# ADR-037: Pause Module 16 (Website Builder / CMS) — hide admin UI, keep code, data and public rendering intact

**Status:** Superseded by ADR-042
**Date:** 2026-09-06
**Module:** 16 (Website Builder / CMS)
**Supersedes:** — (does not change ADR-020…036; it changes _exposure_, not
architecture)
**Superseded by:** ADR-042 (2026-09-07 — the pause became a cancellation; this ADR's code mechanisms are retained unchanged)

## Context

The owner has asked to pause the Website Builder / "Dynamic Project Design"
feature for now: stop further development of it, and remove/hide every
admin-facing entry point (sidebar, settings) so the admin portal reads as a
normal CMS again — while keeping the basic design surfaces the platform
already relies on (branding, theme/color, media upload, media library reuse
across modules like News & Analysis) fully working. Nothing may be deleted:
not the `@repo/blocks`/`@repo/contracts`/`@repo/core` CMS code, not the
`Page`/`PageVersion`/`CardTemplate`/`StylePreset`/`LayoutTemplate`/
`Redirect`/`ContentReference` tables or their data, and not the public
rendering path — the homepage (`/`) and `/news` are already served from
published `PageVersion` rows (plan v2.2 PR 2.7, PR 4.4; seed.ts) and must
keep rendering exactly as they do today.

This is a deviation from the plan's build order (Part E lists Module 16 as
an active phase; claude.md's module table said Phase 4 was "in progress" and
that the owner had asked to proceed through all remaining phases) — Part F
#10 requires an ADR before the code that changes it.

## Decision

**Hide, don't remove.** One code-level change gates the entire feature's
admin visibility:

1. `apps/web/app/(admin)/admin/_components/admin-shell.tsx` — the single
   `ADMIN_NAV_GROUPS` entry for `/admin/website` (which is the only nav
   entry point into Templates/Styles/Cards/Media/Redirects/Pages — all its
   sub-screens hang off this one link, consumed identically by
   `AdminSidebarNav`, `AdminMobileNav` and `AdminSearch`'s command palette)
   gets a module-level `WEBSITE_BUILDER_ADMIN_UI_ENABLED = false` switch.
   Flipping it back to `true` is the entire re-enable step.
2. **No new Settings/feature-flag toggle is added.** The DB-backed
   `FeatureFlag` mechanism (`packages/settings`) is for
   learner-visibility-tiered _public_ features (`PUBLIC`/`AUTHENTICATED`/
   `PREMIUM`/`ADMIN` per subject), not an admin-nav gate, and today no admin
   nav entry is flag-gated. Wiring the pause through it would put a visible
   "Website Builder" row in `/admin/features` — the opposite of "hidden
   from Settings." A plain code constant is the correct mechanism here: it
   requires a code change (matching "stop development," not "let an admin
   toggle it back on") and adds nothing to any admin screen.
3. **Nothing else changes.** `/admin/website/*` routes, all six
   `_actions/*.ts` files, `packages/core/src/cms/*`,
   `packages/contracts/src/cms/*`, `packages/blocks`, every CMS Prisma
   model and its seeded/authored rows, and the public
   `(public)/[locale]/[...slug]` renderer are untouched. Each action's own
   `requirePermission`/`requireAnyPermission` call remains the real
   boundary (security.md #1) — the hidden nav entry is UX only, exactly as
   `admin-shell.tsx`'s existing header comment already states. Staff who
   still hold `cms.*`/`redirects.manage` permissions and know a direct URL
   can still reach the composer; that is unchanged from before this ADR and
   is intentionally out of scope — the ask is to hide the feature from
   normal admin navigation, not to revoke permissions or lock the routes.
4. **Media is unaffected in substance, hidden in one place.**
   `media-library.tsx` (the admin's media browsing/reuse screen) lives at
   `/admin/website/media`, physically inside the website-builder route
   tree, so it goes dark along with the rest of the section when the nav
   entry is hidden. That is acceptable because no other module reaches
   media through this screen or this nav entry: article cover images,
   brand assets and theme logos all call `storeImage()`/`@repo/core`'s
   media service directly from their own admin screens, independent of
   `/admin/website`. Upload and reuse keep working everywhere they are
   used today; only the dedicated browse-all-media screen is temporarily
   unreachable from the sidebar. A standalone `/admin/media` entry point
   independent of the builder is a reasonable follow-up if that screen is
   needed, but it is new work, not part of this pause.
5. **Development stops.** No further Phase 4+ work (dynamic collections,
   card templates UI, content-type registry, Phase 5/6/9 items) proceeds
   until the owner asks to resume. `claude.md`'s module table, `docs/
plan.md` Part D's Module 16 status paragraph, and `.claude/skills/
website-builder/SKILL.md` are updated with a paused note so a future
   session's governance-loop reading (claude.md → rules → skill → ADRs →
   DEVLOG) surfaces the pause before anyone resumes work from the skill.

## Consequences

- Reversible in one line (`WEBSITE_BUILDER_ADMIN_UI_ENABLED = true`) plus
  reverting the three doc notes — no migration, no data change.
- Admins lose the composer/media-library UI entry point immediately; the
  home page and `/news` keep rendering from their already-published
  versions untouched, since rendering never depended on the admin nav.
- No new attack surface and no reduced one: permission checks on every
  mutation are unchanged, so this is a UX-only change, consistent with
  security.md's "a hidden button is not security" framing — deliberately
  not used here as a security control.
- Anyone who still needs emergency access to a CMS page (e.g., to fix the
  live homepage) can navigate directly to `/admin/website/pages` if they
  hold the permission; this ADR does not remove that safety valve.

## Alternatives considered

- **Revoke `cms.*`/`redirects.manage` from all roles.** Rejected: breaks
  the already-published home/news pages' _editability_ (not their
  rendering) for no benefit the owner asked for, and reintroducing the
  permissions later to resume is a second seed change; a nav-level pause is
  strictly simpler to undo.
- **A DB-backed `FeatureFlag` gate.** Rejected (see Decision #2) — it adds
  a visible toggle to `/admin/features`, which is itself one of the
  Settings surfaces the owner asked to hide the feature from.
- **Delete the `/admin/website/*` route tree.** Rejected outright — the
  owner was explicit that no code/functionality may be deleted.
- **A separate standalone `/admin/media` route** so the media library
  isn't hidden along with the rest of the section. Deferred as a follow-up
  (Decision #4) rather than bundled into this pause, since it is new work,
  not a hide.

## Compliance

- `pnpm governance:check` — this ADR exists before the code change lands.
- Manual check: `/admin/website` link is absent from the sidebar, mobile
  nav and ⌘K search for every role after the change; `/admin/website/pages`
  is still reachable by direct URL for a subject holding `cms.pages.view`
  (unchanged behavior, not a new gate); the public `/` and `/news` render
  identically before/after.
- DEVLOG entry recording the change and its verification, per testing.md
  #6.
