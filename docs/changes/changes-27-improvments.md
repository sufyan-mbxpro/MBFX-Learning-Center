# changes-27 — the SEO wiring

**Status:** shipped 2026-09-14 · **ADR-090** · DEVLOG entry of the same date.

A review of the dynamic SEO flow. The verdict was "approach right, three
things not actually connected", and this is the classification and what each
became.

## What was reviewed and kept, unchanged

Named here so a later pass does not re-open it:

- **SEO fields on the translation rows, not the base rows.** Each locale gets
  its own title, description and slug, and hreflang is emitted only for
  locales that really have a translation — so we never advertise a language
  version that 404s.
- **The fallback chains.** `ogTitle → seoTitle → title`,
  `ogImageUrl → coverImageUrl → seo.defaultOgImage`. Null means _inherit_,
  never _render empty_, so a page ships complete metadata with every editor
  field blank.
- **Unpublished content is ABSENT from the sitemap, not noindexed.** A crawl
  hint pointing at a 404 is worse than no hint. Scheduled content becomes
  visible through the query (`scheduledVisibilityOr`), so a publish refreshes
  metadata through the same `content` tag with no cron in the path.
- **Slug and track changes write 301 rows**, resolved before `notFound()`.

## A — real defect, fixed

| #   | Defect                                                                                                                           | Fix                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `metadataBase` never set; relative OG images and JSON-LD urls resolved against Next's localhost fallback in production, silently | `metadataBase: new URL(siteUrl())` on the public root layout                                                  |
| 2   | `seo.robotsIndex` seeded, typed, editable — and read by nothing                                                                  | `robots.ts` returns `Disallow: /`; the root layout adds `index:false, follow:false`. Both halves, see ADR-090 |
| 3   | `seo.googleSiteVerification` likewise dead                                                                                       | Renders through `verification.google`; empty stays absent                                                     |
| 4   | `robots: cond ? {…} : undefined` in two routes ERASES an inherited directive — Next merges by key presence                       | Conditional spreads; code-style.md #26                                                                        |
| 5   | Four copies of `BETTER_AUTH_URL ?? "http://localhost:3000"`                                                                      | One `siteUrl()`; code-style.md #27                                                                            |

#4 was not in the review. It was found while implementing #2, and without it
#2 would have shipped looking correct and failing on exactly the article pages
the switch most needs to reach.

## B — accepted, deferred with a reason

**The 39 `generateMetadata` copies.** A shared
`buildMetadata(translationRow)` would make the fallback order provably
identical everywhere, and defect #4 is precisely the drift it prevents. It is
a refactor touching every public route; folding it into a fix for three silent
failures would make both harder to review. Owed as its own change, and the
guard in `seo-metadata.test.ts` holds the line until then.

## C — checked, no action needed

**"Only 36 of 39 routes read the title template."** The three are the public
root layout (it IS the fallback title — wrapping it would double the site
name), the admin root layout and the admin design-system page. Admin is
noindexed by design. Intentional.

## D — reclassified

**"The uncached sitemap loaders are just a performance issue."** Half right.
Seven uncached reads per crawler hit is the smaller cost; the defect is that
the sitemap was the one public surface whose freshness was unrelated to the
publish that changed it. Fixed as a correctness issue —
`getSitemapEntries()`, one cached aggregate tagged `content`.

## Guard

`apps/web/app/seo-metadata.test.ts`, verified in both directions. Its first
form was a regex that could not cross a comma, so it matched only the comments
describing the bug and passed with the bug reinstated on purpose. See ADR-090
and the DEVLOG entry — the failure mode is worth remembering, not just the
fix.
