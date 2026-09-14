# ADR-090: The site knows its own address, and a switch that does nothing is worse than no switch

**Status:** Accepted
**Date:** 2026-09-14
**Module:** 12 (public site), 05 (settings), 14 (hardening)
**Supersedes:** —
**Superseded by:** —

## Context

A walk through the SEO path — 39 `generateMetadata` exports, `sitemap.ts`,
`robots.ts`, the RSS route and `@repo/utils`' `seoChecks` — found the design
sound and three wirings missing. The design is not in question here: SEO fields
on the **translation** rows, hreflang emitted only for locales that really have
a translation, unpublished content ABSENT from the sitemap rather than listed
and noindexed, and a 301 `Redirect` row written on every slug or track change.
All of that stays exactly as it is.

What was missing is smaller and worse, because each failure is silent.

**1. `metadataBase` was never set.** Two JSON-LD components carried a comment
saying "Next resolves it against `metadataBase`", and no layout exported one.
Next then falls back to its own default origin — localhost in development, and
in production whatever the host happens to supply. It does not throw and it
does not warn at runtime. The `/og-default.png` in the seeded
`seo.defaultOgImage`, every uploaded `ogImageUrl` stored as `/uploads/…`, and
every JSON-LD `url` we pass as a path rather than an absolute URL all resolved
against it. The failure appears only where we cannot see it: in the unfurled
share card on someone else's timeline.

**2. Two SEO settings were stored, typed, seeded and read by nothing.**
`seo.robotsIndex` ("Allow search indexing") and `seo.googleSiteVerification`
("Google verification token") have schemas in `@repo/contracts`, rows in the
seed, and an editor at `/admin/settings/seo`. No code read either. An admin
could turn indexing off, see the form save, and change not one byte of what a
crawler received. That is worse than the setting not existing: a missing
control sends you to a developer, a dead control sends you away satisfied.

**3. The sitemap was the one public surface reading uncached.** Seven
`load*SitemapEntries` calls ran per request while every other public read on
the site is `"use cache"` + `cacheTag("content")`. The cost is the smaller
half; the real defect is that the sitemap's freshness was unrelated to the
publish that changed it.

And one discovery while fixing #2, which is why #2 is two changes rather than
one. Next 16.3.3's `mergeMetadata` iterates the child's keys with `for…in` —
**presence**, not definedness — and `resolveRobots(undefined)` returns `null`.
So a route returning `robots: cond ? {…} : undefined` does not inherit the
parent's directive; it **erases** it. Two routes were written that way. A
site-wide `robots` on the layout would have been silently dropped on exactly
the article pages the switch most needs to reach.

## Decision

**1. One origin, one owner.** `apps/web/app/_lib/site-url.ts` exports
`siteUrl()`, the sole spelling of `process.env.BETTER_AUTH_URL ??
"http://localhost:3000"`, trailing slash stripped because every caller
composes `${siteUrl()}${path}`. The sitemap, the robots rules, the RSS feed
and the public root layout all read it. Four copies of a default is four
places to miss, and the newest reader is the one that fails without a sound.

**2. The public root layout exports `metadataBase: new URL(siteUrl())`.** It
is the one place that covers every public route, because metadata inherits.

**3. `seo.robotsIndex` is a two-part switch, and both parts are required.**
`robots.ts` returns `Disallow: /` with no sitemap pointer when it is `false`;
the public root layout adds `robots: { index: false, follow: false }` to the
same condition. Neither alone is the feature: a `Disallow` stops the crawl but
removes nothing already indexed, because the crawler never fetches the page
whose `noindex` would have told it to drop the URL. **Only an explicit `false`
closes the site** — a `null` row is an unseeded database, and a missing setting
must never take a site out of the index.

**4. A public route never returns `robots: undefined`.** Where the directive is
conditional it is a conditional SPREAD (`...(cond ? { robots: … } : {})`), so
the key is absent and the layout's value survives. This is a rule about the
framework's merge semantics, not a style preference; it is in code-style.md #25
and guarded.

**5. `seo.googleSiteVerification` renders through Next's `verification.google`,
and an empty string stays absent.** An empty
`<meta name="google-site-verification">` is a failed verification, not a
neutral one.

**6. The sitemap's seven content reads become one cached call.**
`@repo/core`'s `getSitemapEntries()` is `"use cache"` + `cacheTag("content")`,
so a publish invalidates the sitemap alongside the page it added. The cache
goes on the aggregate rather than on the seven loaders because the repo's
naming contract is load-time-honest: `load*` is the pure read an integration
test calls without Next's transform, `get*` is the cached production entry
point (the `@repo/settings` precedent).

## Consequences

- Share cards, canonical URLs and JSON-LD `url` values resolve against the real
  origin in production. `BETTER_AUTH_URL` must be set there — it already must
  be, for Better Auth.
- `/robots.txt` is now a cached async route reading `settings:seo`. Flipping
  the switch in admin invalidates it at once rather than waiting out a TTL.
- Turning indexing off is a real, dangerous control. It is `isPublic: false`
  and sits behind `settings.update` like every other setting; nothing about
  this ADR changes who may press it.
- The two settings stay. The alternative considered and rejected was deleting
  them from the admin UI — cheaper, and it would have left the site with no
  way to close itself before launch, which is the thing they were seeded for.
- **Not done, named rather than silently skipped:** the 39 `generateMetadata`
  exports are still 39 copies of one fallback chain. A shared
  `buildMetadata(translationRow)` would make them provably identical and is
  the obvious follow-up; it is a refactor across every public route and does
  not belong in a fix for three silent failures. The `robots` rule above is
  precisely the kind of drift that helper would have prevented once, instead
  of being enforced by a guard.

**Guards.** `apps/web/app/seo-metadata.test.ts`, read as source, and verified
in both directions: the `robots` scanner was first written as a regex that
forbade a comma, which meant it could never reach the `: undefined` past
`{ index: false, follow: false }` — it matched only this repo's PROSE about the
bug and passed while the bug was deliberately reintroduced. It is now a
brace-depth scan of the property's value, checked against a reinstated
offender. The origin check asserts the fallback appears nowhere but
`site-url.ts` AND that it still appears there, so a renamed constant cannot
make it vacuous.
