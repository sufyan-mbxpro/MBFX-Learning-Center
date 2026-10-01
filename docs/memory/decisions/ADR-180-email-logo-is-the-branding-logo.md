# ADR-180 — The email logo is the Branding logo

- **Status:** Accepted
- **Date:** 2026-10-01
- **Module:** 17 (email)
- **Supersedes:** ADR-179 #3 (the logo's order of preference). The rest of
  ADR-179 stands.

## Context

Every email's header band showed `email.logo`, a separate IMAGE setting under
Settings → Email, and fell back to the theme's `logo_dark` / `logo_light` only
when it was empty. The live seed filled it with its own PNG, so emails carried
a different mark from the site. The owner asked for the email templates to use
the same light and dark logos added in Branding.

## Decision

1. **`email.logo` is deleted.** Removed from `SETTING_KEYS`, the seed, the
   live-seed defaults (and its image file) and the catalog hint; migration
   `20261001180000_email_logo_retired_adr180` deletes the row from an existing
   database unconditionally, as changes-36 did for `site.faviconUrl`: nothing
   can read the key whatever it holds (code-style.md #28).
2. **The shell picks between the two Branding logos by the band it sits on**
   (`pickEmailLogo`, `layout.ts`). The header band is `brand.secondary`, the
   site footer's ground, so it takes the logo the footer takes there:
   `logo_dark` when the band's derived text is the light surface text (the
   seeded near-black), `logo_light` when a theme's secondary is pale. The other
   logo is the fallback; with neither, the site name prints as before.
3. **The light and dark previews show the same logo.** ADR-179 #5 keeps one
   set of band inks in both schemes, so the band, and the mark on it, do not
   change between them.

## Consequences

- One upload in Branding re-brands the site and every email.
- `{{logo.url}}` in a template body resolves to the same picked logo.
