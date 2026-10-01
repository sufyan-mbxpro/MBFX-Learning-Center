# ADR-179 — The email shell is two brand bands, and its words come from the catalog

- **Status:** Accepted
- **Date:** 2026-10-01
- **Module:** 17 (email), with 09 (admin)
- **Extends:** ADR-078 (the email platform), ADR-171/172 (campaigns, designs).
  Amends architecture.md #8 by one edge: `email → i18n`.
- **Change set:** `docs/changes/changes-59-email-templates.md`

## Context

The owner asked for every email to carry the reference's header and footer
(changes-59, image-18/19): a dark band with the logo and a bronze rule under
it; a dark footer band with the site name and tagline, a row of links (log in,
contact support, privacy policy), the contact address and website, a hairline,
then the copyright, who the message was sent to, and the unsubscribe link.
"All the content will dynamically fill."

The shell in `@repo/email` (`layout.ts`) drew a white card with the logo at the
top and up to three muted lines at the bottom. It had no words of its own: the
one label it printed (the unsubscribe link) was passed in by `@repo/core`,
which reads the catalog. The new footer needs six more words in the reader's
language ("Log in to your account", "Contact support", "Privacy policy",
"Email", "Website", "All rights reserved"), and the transactional path
(`auth → email`) has no `@repo/core` above it to pass them down.

The owner also asked for the admin preview to show light and dark mode on
desktop and mobile (image-17).

## Decision

1. **The shell is two bands around a card.** Header and footer are
   `brand.secondary` — the colour the homepage hero already uses, and the
   reference's near-black in the seeded theme — with a 2px `brand.primary`
   rule on the inner edge of each. Every ink on a band is DERIVED against it
   (`contrastRatio` picks the light or dark surface text; links are
   `deriveTonalInk(primary, band)`; muted lines are `deriveInteractive(textMuted,
band)`), so a theme with a light `secondary` still produces legible text and
   there is still no hex literal in the package (code-style #1).
2. **Every line is data.** Site name (`site.name`), tagline (`site.tagline`),
   contact address (`site.contactEmail`), website (the site origin, the one
   owner of which is `siteOrigin()`), the privacy link (present only when
   `legal.privacyDocument` holds a file — a link to a 404 is worse than none,
   ADR-110), `email.footerText` and `email.postalAddress` (unchanged), and the
   recipient's own address. An absent value removes its line.
3. **The logo prefers the dark-ground asset.** `email.logo` still wins (it is
   the admin's explicit choice), then the theme's `logo_dark`, then
   `logo_light`. The header is a dark band now; the light-ground logo was the
   right fallback only while the header was white.
4. **`@repo/email` reads the catalog: a new edge `email → i18n`.** The shell's
   words are a new PUBLIC namespace, `emailShell.*`, read through
   `catalogMessage` once per locale per send session. The alternatives were
   worse: settings rows would put "Privacy policy" in Settings as an editable
   field nobody asked for, in every language; a resolver injected by the app
   would be a global that a cron path or a test forgets to set; and a string
   table in code is exactly what code-style #2 forbids. `@repo/i18n` depends
   on `db`, `next` and `next-intl`; `auth` already depends on `next`, so the
   session path gains `next-intl` and the catalog files, and nothing that
   spends money or reaches a vendor — the bar ADR-097 and ADR-160 set for
   that path.
5. **A preview can render the DARK palette.** The preview route accepts an
   optional `scheme` (`light` | `dark`), parsed through `@repo/contracts`. A
   real send stays light: mail clients apply their own dark treatment, and the
   preview is an approximation of it, which the dialog says.
6. **A recipient address cannot inject a variable.** The shell runs before
   `{{…}}` substitution, so an address printed in it has its braces escaped as
   character references.

## Consequences

- `emailShell.*` is public: `en` and `ar` (an `ENFORCED_LOCALE`) ship in this
  change.
- `EmailRenderContext` gains `scheme` and the fields above; the four preview
  renderers in `@repo/core` take an optional `{ scheme }`.
- `layout.test.ts` asserts the bands, the derived inks, and that an absent
  value drops its line.
