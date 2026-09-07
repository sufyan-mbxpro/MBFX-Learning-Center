# SKILL — Module 09: Admin shell, settings screens, theme editor

> **Partially paused (ADR-038, 2026-09-06).** The theme editor's Layout &
> Display tab and the Settings → Layout group are hidden pending the
> owner's move to module-by-module/static site design. Colors & Branding,
> Theme Modes, Presets and Logos & Favicon stay fully live — read ADR-038
> before touching either paused surface or resuming them.

plan.md Module 09. The admin shell IS the `(admin)` route-group root layout
(ADR-006): `force-dynamic`, server-side STAFF re-check, robots noindex.

## Screens

- **Shell:** sidebar from a permission-filtered admin menu, breadcrumbs,
  command palette optional.
- **Settings CRUD:** generated from the settings registry — type-driven
  field rendering (STRING/TEXT/NUMBER/BOOLEAN/JSON/IMAGE/COLOR/SELECT).
- **Navigation manager:** drag-reorder, nesting ≤ 2, translation side panel.
- **Social links manager**, **feature flags screen**.
- **Theme editor** (tabs mirror the engine): Colors & Branding from
  `BRAND_FIELD_REGISTRY`; Layout & Display; Theme Modes side-by-side
  light/dark with live preview iframe; Logos & Favicons via `BrandAsset`
  upload. Inline `validateTheme` results — **advisory only since
  changes-05**: every issue is a warning with a derived-value remedy and
  none of them disable save. Colors & Branding is capped at TWO columns
  (changes-08). Presets: save/switch/activate,
  instant rollback, per-scope activation using the FIXED resolution rule
  (A5.1). Hover/active shown read-only as derived previews (ADR-003) —
  never inputs.

## Display conventions (ADR-044) — binding on every admin screen

Compose these, don't re-implement them:

- `AdminPage` / `AdminPageHeading` — title + one-line description, always
  both. `SettingsScreen` for any screen with the settings sub-nav: it puts
  the heading INSIDE the content column, above the cards, not above the
  sub-nav beside them.
- Save / Submit / Update / Apply at the **inline end** of their section.
- `ConfirmDialog` in front of every delete / remove / clear — including
  ones that only stage a change. Restore is NOT confirmed (it is the undo).
- `humanizeKey()` (`@repo/utils`) for any identifier that reaches the
  screen without a catalog string or a stored name. No raw `super_admin`,
  no raw `legal.copyrightNotice`. **No `<code>` in admin chrome** — it
  drags in the mono family; use a muted `<span>`.
- `DataTable`'s `filters` prop for screen-specific filters, so they share
  the search row.

The cancelled surfaces (ADR-042) are exempt and stay as they are.

## Boundaries

Admin-only heavy deps (color pickers, TanStack, editor) must be imported
only under `app/(admin)/**` — see architecture.md #5. Every mutation:
`requirePermission` first line, audit row, tag revalidation.

## Required tests

E2E per screen: happy path + permission-denied (asserted at DB level);
theme-editor E2E: failing palette → saves WITH a warning list (not
disabled — changes-05 made contrast advisory); passing
palette → save → public surface (second, unauthenticated context) shows the
new brand without deploy; preset switch round-trip; settings write in audit
log; every screen axe-clean.
