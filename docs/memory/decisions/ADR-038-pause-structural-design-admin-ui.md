# ADR-038: Pause admin-configurable structural/layout design — Navigation manager, Homepage section composer, Layout settings group, Theme's structural tab; site design is module-by-module/static, content data stays dynamic

**Status:** Superseded by ADR-042
**Date:** 2026-09-06
**Module:** 08 (Navigation & header/footer runtime), 09 (Admin shell, settings screens, theme editor), 12 (Public site — homepage)
**Supersedes:** — (extends ADR-037's reasoning to a different set of screens; does not change Module 08/09/12 architecture or data model)
**Superseded by:** ADR-042 (2026-09-07 — the pause became a cancellation; this ADR's code mechanisms are retained unchanged)

## Context

Following ADR-037 (pausing Module 16's admin UI), the owner clarified the
broader intent: **the site's design is to be built module-by-module in
code, or statically, not through admin-configurable dynamic composition.**
Only _content data_ — the owner's example is news articles — stays
dynamic and admin-managed. Concretely, the owner asked to hide:

- `/admin/settings/layout` (header/footer/homepage structural settings:
  container width, breadcrumbs, page loader, sticky header, footer
  newsletter/app-links/payment badges)
- `/admin/navigation` (Module 08's menu/menu-item reorder screen)
- `/admin/homepage` (Module 12's `home.sections` order/enable/variant
  editor)
- `/admin/theme` — but investigation before touching this page found it
  bundles five tabs in one route: Colors & Branding, **Layout & Display**
  (border radius, container max-width, base font size, curated
  sans/mono font pickers), Theme Modes, Presets, Logos & Favicon. Hiding
  the whole route would also remove brand-color/logo editing, which the
  owner explicitly asked to _keep_ when pausing Module 16
  ("Logo and branding settings", "Theme/color settings" as retained basic
  features). Asked directly: keep `/admin/theme` reachable, hide only its
  Layout & Display tab.

This is a deviation from the plan's shipped scope for Modules 08/09/12
(all "core complete" per claude.md) — Part F #10 requires an ADR before
the code.

## Decision

**Hide, don't remove — same posture as ADR-037.** No migration, no data
change, no permission change.

1. `apps/web/app/(admin)/admin/settings/_components/settings-shared.ts` —
   `PAUSED_SETTINGS_GROUPS` (introduced by ADR-037 for `"cms"`) gains
   `"layout"`. Since the Settings hub and every settings page's sub-nav
   both derive their category list from this one filtered `groups` array
   (`loadSettingsIndex`), and `[group]/page.tsx` already 404s on any group
   not in that array, this one line hides the hub card, every page's
   sub-nav entry, and `/admin/settings/layout` itself — for free, no route
   change (same mechanism ADR-037 established for `cms.dataBudget`).
2. The same file's `navEntries` array gets a new
   `STRUCTURAL_DESIGN_ADMIN_UI_ENABLED = false` switch gating the
   `navigation.manage` → `/admin/navigation` and `settings.update` →
   `/admin/homepage` entries. These aren't settings-registry groups (they
   are hand-added destinations in the same array, per the existing
   `["cms"], ["cms.templates.manage"]`-style permission checks already
   there for social/features/theme), so they need their own boolean
   rather than reusing `PAUSED_SETTINGS_GROUPS`.
3. `apps/web/app/(admin)/admin/theme/theme-editor.tsx` — a
   `THEME_LAYOUT_TAB_ENABLED = false` constant wraps only the `layout`
   `TabsTrigger` and its `TabsContent` (radius/container-width/font-size
   inputs + the sans/mono `Select`s) in a conditional render. `brand`,
   `modes`, `presets`, `logos` tabs are untouched — full color/logo/preset
   editing keeps working exactly as before, live-verified. The `layout`
   state itself, its `dirty` comparison, and `saveThemeAction`'s
   `layoutTokens` field are all unchanged: with no UI to edit them, the
   current stored values simply keep round-tripping unmodified on every
   save, so nothing downstream that reads them at render time is affected.
4. **The routes themselves stay reachable by direct URL** for a subject
   holding the underlying permission (`navigation.manage`,
   `settings.update`, `settings.view` for `/admin/settings/layout`) —
   unchanged from ADR-037's posture: a hidden nav entry is UX
   (security.md #1's "a hidden button is not security"), not a new
   authorization boundary. `/admin/settings/layout` is the one exception
   worth naming: because its reachability is driven by the same
   `groups.includes(group)` allowlist that also builds the nav, hiding it
   from the list does make direct navigation to that specific URL 404 —
   a side effect of how the generic settings-group page already worked
   (`[group]/page.tsx`'s own comment: "Unknown group → 404, not an empty
   page"), not a new access-control mechanism introduced by this ADR.
5. **Nothing about rendering changes.** The public header/footer
   (`buildNavigation`), the homepage's section renderer, and
   `@repo/theme`'s CSS-variable emission all keep reading the exact same
   `Menu`/`MenuItem`/`home.sections`/theme rows they did before — this ADR
   only removes admin _editing_ surfaces, verified live: `/` renders
   identically after the change.

## Consequences

- Four one-line/one-constant reverts (three booleans/set-entries plus the
  theme JSX wrap) fully restore prior behavior — no data or migration
  step either direction.
- Admins lose the ability to reorder menus, reorder/toggle homepage
  sections, edit structural layout settings, or edit theme layout tokens
  and fonts through the admin UI. Any such change now requires a code
  change (editing the seeded `Menu`/`MenuItem` rows, `home.sections`
  default, `layout.*` settings, or `LayoutTokens` values directly, or —
  more in the spirit of "module by module in code" — hardcoding the
  relevant component).
- Consistent with ADR-037: no new attack surface, no reduced one — every
  mutation's own `requirePermission` is unchanged.

## Alternatives considered

- **Hide all of `/admin/theme`.** Rejected per the owner's explicit
  answer — it would remove brand-color and logo editing, which was
  named as a feature to _keep_ when Module 16 was paused (ADR-037).
- **Revoke `navigation.manage`/relevant permissions.** Rejected for the
  same reason as ADR-037's equivalent alternative: breaks the ability to
  fix something live in an emergency, and is a second permission-seed
  change to undo on resume. A nav-level pause is strictly simpler.
- **A DB-backed `FeatureFlag`.** Rejected for the same reason as ADR-037
  Decision #2 — it would add a visible toggle to `/admin/features`, one of
  the very surfaces being hidden from.

## Compliance

- `pnpm governance:check` — this ADR exists before the code change lands.
- Manual check: Settings hub lists neither "Layout" nor "Navigation" nor
  "Homepage" cards; no settings page's category sub-nav lists them either;
  `/admin/theme` shows four tabs (no "Layout & Display") with Colors &
  Branding fully functional; `/` and `/news` render identically
  before/after.
- DEVLOG entry recording the change and its verification, per testing.md
  #6.
