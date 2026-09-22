# ADR-148 — The public site and the admin each own a palette

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 02 (theme), 09 (admin shell / theme editor)
- **Plan:** `docs/changes/changes-49.md` (owner request)
- **Amends:** the single-active-row model of `activateTheme` (Module 02,
  changes-46 presets); ADR-064's single mode storage key.
- **Does not change:** ADR-008 — the MODE is still the user's, branding the
  admin's; ADR-003's derived states; the per-token contrast validation.

## Context

"admin & user dedicated light & dark mode color palette.. when admin change
the light & dark color then this should not change either side.. same color
selections & presets should be available separately for the public & admin &
separate cookies."

The `Theme` table always had a `scope` column (`web | admin | both`) and
`@repo/theme`'s loader already prefers an exact scope over `both`. But the
editor saved every row as `both` and `activateTheme` deactivated every other
row, so there was one live palette for both surfaces.

## Decision

1. **Each surface has exactly one live row**, keyed `surface-web` and
   `surface-admin` (scope `web` / `admin`, `isSystem`). Migration
   `20260922110000` copies the palette that was active into both, so neither
   surface changes on deploy, and demotes the old row to an ordinary preset.
   The seed creates both rows create-only.
2. **Presets are shared; applying one copies it into ONE surface's row.**
   `activateTheme(actor, key, surface)` upserts the preset's tokens into that
   surface's row and leaves the other surface untouched. The surface rows are
   not listed as presets. Rollback is applying the previous preset again.
3. **The theme editor has a Public site / Admin portal switch** — two links
   setting `?surface=`, read by the server, so each palette loads fresh and a
   reload keeps the one being edited. Save writes that surface's row; the
   Presets tab applies to that surface.
4. **Each surface remembers its own light/dark/system choice**: the public
   site keeps the `theme` storage key, the admin (and staff sign-in) use
   `admin-theme` (`ADMIN_THEME_STORAGE_KEY`). Same origin, so it is a second
   key in one localStorage rather than a cookie — the pre-paint script reads
   localStorage, and a cookie would add a request header to every page for
   no gain. The owner's "separate cookies" is met in effect: neither surface
   can change the other's mode.

## Consequences

- An install that applied presets by activating rows must now use the
  editor's Apply per surface; `seed-live` applies an exported theme to both.
- The admin typeface override (`withAdminTypeface`) is unchanged and still
  applies on top of the admin palette.
