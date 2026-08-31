# SKILL — Module 09: Admin shell, settings screens, theme editor

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
  upload. Inline `validateTheme` results — blocking errors disable save;
  advisories show derived-value remedy text. Presets: save/switch/activate,
  instant rollback, per-scope activation using the FIXED resolution rule
  (A5.1). Hover/active shown read-only as derived previews (ADR-003) —
  never inputs.

## Boundaries

Admin-only heavy deps (color pickers, TanStack, editor) must be imported
only under `app/(admin)/**` — see architecture.md #5. Every mutation:
`requirePermission` first line, audit row, tag revalidation.

## Required tests

E2E per screen: happy path + permission-denied (asserted at DB level);
theme-editor E2E: failing palette → save disabled with issue list; passing
palette → save → public surface (second, unauthenticated context) shows the
new brand without deploy; preset switch round-trip; settings write in audit
log; every screen axe-clean.
