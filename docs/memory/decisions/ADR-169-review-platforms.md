# ADR-169 — Review platforms: one "leave a review" button per platform

- **Status:** Accepted
- **Date:** 2026-09-29
- **Module:** 12 (public site: the reviews band), 05 (settings screen), 01 (schema, seed, migration), 07 (brand glyphs)
- **Plan:** `docs/changes/changes-53-review-platforms-plan.md`
- **Extends:** ADR-135 (the reviews band is a link, not a widget).
  **Supersedes only ADR-135 §3's storage**: the single `site.reviewsUrl`
  setting becomes one row per platform. Everything else ADR-135 decided
  (a plain link in a new tab, no vendor script, no CSP exception, absent when
  there is nothing to link to, shown on tool pages and `/support`) stands.

## Context

The owner wants Google and Meta (Facebook) reviews beside Trustpilot. Each
platform can be switched on or off in the admin, one or more at once, and
each carries its own link. A visitor who clicks one lands where they can
write a review. The owner decided (2026-09-29) that **no existing reviews,
ratings or counts are shown**: each platform is a button, exactly like the
Trustpilot one today.

## Decision

1. **The set of platforms is code; each platform's values are data**
   (ADR-042's split, as for email templates, tools and AI features).
   `REVIEW_PLATFORMS` in `@repo/contracts` lists `trustpilot`, `google` and
   `facebook`, each with an identifier schema and a URL builder. Adding a
   platform is a registry entry, a glyph and two catalog labels.
2. **One row per platform in a `review_platforms` table**, not settings.
   Each has a switch, an order, an identifier and an override; the
   `SocialLink` table is the precedent for per-brand rows.
3. **The admin enters an identifier and the code builds the link**
   (Trustpilot domain → `/evaluate/{domain}`; Google Place ID →
   `search.google.com/local/writereview?placeid=`; Facebook Page →
   `facebook.com/{page}/reviews`). **A custom link overrides the built one**
   for every platform, so a vendor changing its URLs never waits for a
   deploy. The custom link is `https:` only.
4. **A switched-on platform must have a usable link.** The contracts schema
   refuses an enabled row with neither an identifier nor a custom link, so
   the form, the action and the service fail identically. A row that still
   resolves to no link is never rendered.
5. **No credentials, no vendor API, no stored secret.** Every link is built
   from public identifiers. Showing ratings or reviews later would need
   vendor API keys, i.e. a new sealed secret (security.md #10), and its own
   ADR.
6. **Gated on `settings.update`**, the key every other General tab saves
   under. A review link captures nothing and delivers nothing to a user.
   The screen is Settings → General → **Reviews**, a keyless tab with its
   own form (the reCAPTCHA precedent, ADR-156).
7. **The band draws one button per active platform, in the admin's order**;
   the first is the default button, the rest outline. Zero active platforms
   ⇒ the band is absent (ADR-047 §2). No click counting: it would be a third
   anonymous mutation (ADR-080/113).
8. **Migration keeps the live site identical.** A non-empty
   `site.reviewsUrl` becomes the Trustpilot row's custom link, switched on;
   then the setting row is deleted and removed from the registry
   (code-style.md #28, the `site.faviconUrl` precedent). Seeded Google and
   Facebook rows start off.
9. **Cached under `settings:general`**, the tag the old setting lived under,
   so the band's invalidation lifecycle does not change and no new tag is
   minted (architecture.md #12).

## Consequences

- Owners paste an identifier they can find in each vendor's own tools, or
  paste the vendor's share link into the custom field.
- Facebook has no direct compose URL; its link lands on the Page's Reviews
  tab, and Reviews must be enabled on the Page. The admin hint says so.
- `google` and `trustpilot` join `SocialGlyph` as monochrome inline paths;
  no second icon library (code-style.md #22).
