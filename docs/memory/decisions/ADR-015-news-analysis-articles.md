# ADR-015: News & Analysis (articles) module — reconciling the imported plan with this repo

**Status:** Accepted
**Date:** 2026-09-02
**Module:** 15 (News & Analysis / `articles`) — new module, spec'd by
`docs/news-analysis-module-plan.md`, reconciled here.
**Supersedes:** — (constrains how `docs/news-analysis-module-plan.md` is executed)
**Superseded by:** —

## Context

`docs/news-analysis-module-plan.md` specifies a full News/Analysis/Trade-Idea
content system, but it was written against an architecture this repo does not
have: two apps (`apps/admin` + `apps/web`), a `packages/validation`, an
`AdminUser` model, a secret-protected cross-app `/api/revalidate` route,
middleware slug redirects, Tiptap-JSON article bodies with a
`packages/article-renderer`, a `packages/storage` local-file upload pipeline,
node-cron in "the admin server", and it asks to record "ADR-003/ADR-004" —
numbers already taken. Executing it verbatim would violate ADR-006 (single
app), ADR-009 (sanitized-HTML storage), plan.md A7 (locked `Article`/
`ArticleTranslation` shape), the translation-table/slug convention, and
architecture rule 12 (frozen cache-tag vocabulary). This ADR records how each
piece maps onto the repo's real architecture. Everything not listed here is
executed as the plan document says.

## Decision

1. **Single app (ADR-006).** Admin screens live under `app/(admin)/admin/articles/*`,
   public routes under `app/(public)/[locale]/news|analysis/*`. No
   `/api/revalidate` webhook — `@repo/core` services call
   `revalidateTag("content", { expire: 0 })` directly, the existing pattern.
   Slug 301s are page-level (`getRedirect` + `permanentRedirect`), the repo
   convention — not middleware. The existing `Redirect` model is reused; no
   `SlugRedirect` table.
2. **Bodies are sanitized HTML (ADR-009), not Tiptap JSON.** Every save path
   goes through `sanitizeRichText()`. There is no `packages/article-renderer`;
   the public page renders already-clean HTML like the glossary does. The
   admin editor ships textarea-first per ADR-009; the Tiptap UI (and with it
   in-body image upload, paste-to-embed, autosave) stays on Module 11's
   deferred-editor backlog and changes zero server code when it lands.
3. **Schema per plan.md A7 + repo conventions.** One `Article` model with
   `kind: NEWS | ANALYSIS | TRADE_IDEA` + `ArticleTranslation` (per-locale
   title/slug/excerpt/body/SEO, `translationStatus`/`sourceHash` freshness,
   `@@unique([locale, slug])`). Categories and tags follow the same pattern:
   `ArticleCategory`/`ArticleCategoryTranslation`, `ArticleTag`/
   `ArticleTagTranslation`, join table `ArticleTagAssignment`. Slugs live on
   translation rows only. Soft delete via `deletedAt`. `isPremium` is
   schema-only and unenforced (ADR-012's conservative default is the
   reference when entitlements land). `source`/`sourceUrl` reserved for the
   deferred ingestion worker.
4. **Article-specific transition map.** `CONTENT_TRANSITIONS` (courses/
   lessons/glossary) is frozen and stays untouched, but its five-step review
   chain is wrong for time-sensitive news, and it has no quick
   unpublish/re-publish loop. Articles reuse the `ContentStatus` enum with
   their own map — `DRAFT ⇄ SCHEDULED/PUBLISHED`, `PUBLISHED → DRAFT`
   (unpublish) `| ARCHIVED`, `ARCHIVED → DRAFT`; the review states are unused
   for articles. The stronger gate is the publish permission (below). A
   separate `isActive` flag gives the plan's instant hide/show toggle without
   touching status (deliberate deviation from the other content entities,
   which have no such toggle).
5. **Permissions: only already-seeded keys.** `NEWS`-kind mutations are gated
   by `news.manage`; `ANALYSIS`/`TRADE_IDEA` by `analysis.create|update|
delete|publish` (matching the seeded `analyst` role's evident intent).
   Admin read surfaces gate on `requireAnyPermission(["analysis.view",
"news.manage"])`. Categories/tags: `requireAnyPermission(["analysis.update",
"news.manage"])`. Module settings ride the existing `settings.*` screens.
   No new permission keys.
6. **Scheduling without cron.** Public visibility is decided in the query:
   `PUBLISHED`, or `SCHEDULED` with `scheduledFor <= now()` — with
   `cacheLife({ revalidate: 300 })` a scheduled article appears within five
   minutes of its time with zero infrastructure. `publishDueArticles()` in
   `@repo/core` flips due rows (stamps `publishedAt`, audits, revalidates)
   and is exported for a future cron/queue; wiring a scheduler is deferred
   and no node-cron dependency is added.
7. **Module toggles are the existing feature flags.** `news` and `analysis`
   flags (already seeded, already wired to nav via `requiresFeature` and to
   pages via `isFeatureVisible`) replace the plan's `articles.enabled` /
   `articles.showInNav` settings. New `articles` settings group carries only
   what nothing else provides: `articles.perPage`, `articles.showAuthor`,
   `articles.showReadingTime`, `articles.relatedCount`. The plan's
   `articles.riskDisclaimer`, `articles.seoTitleTemplate`,
   `articles.defaultOgImage` are dropped in favor of the existing
   `legal.riskDisclaimer`, `seo.titleTemplate`, `seo.defaultOgImage`.
8. **No `packages/storage` / media pipeline in this module.** Cover and OG
   images are URL fields (`coverImageUrl` on `Article`, `ogImageUrl` on the
   translation) — the `Lesson.coverImageUrl`/`BrandAsset` precedent. The
   upload pipeline (`MediaAsset`, presigned S3 per security.md #9) remains
   Module 11's deferred media work; when it lands, these URL fields consume
   its output without schema change.
9. **Video embeds: pure helpers in `@repo/utils`, no `packages/embeds`.**
   `parseVideoUrl()` whitelists YouTube (watch/shorts/youtu.be/live/embed),
   Vimeo, Dailymotion and returns `{provider, videoId, embedUrl,
thumbnailUrl}`; embed URLs are constructed at render (never stored as
   iframes), YouTube via `youtube-nocookie.com`. The public article page
   renders a facade (thumbnail/placeholder + play button; iframe injected on
   click). `readingTimeMinutes()` lives beside it. In-body embeds arrive
   with the Tiptap editor (see #2); at launch the featured `videoUrl` field
   covers the need.
10. **Draft preview is session-gated, not token-gated.** `/news/preview/[id]`
    requires a signed-in staff subject with `analysis.view`/`news.manage`
    (single app — the session is already there), renders any status with
    `noindex` and a draft banner. Short-lived shareable JWT links are
    deferred until someone actually needs to share outside the admin group.
11. **Routes & feeds.** `/news` lists `NEWS`; `/analysis` lists `ANALYSIS` +
    `TRADE_IDEA`; every article detail lives at `/news/[slug]` (per-locale
    slug); archives at `/news/category/[slug]` and `/news/tag/[slug]`; RSS
    2.0 at `/news/rss.xml` (route handler outside the locale tree — the
    proxy's dotted-path exclusion bypasses locale rewriting; default-locale
    feed at launch). Articles join the existing `sitemap.ts` and emit
    `NewsArticle`/`AnalysisNewsArticle` JSON-LD. Cache tag is the existing
    `content` tag — no new tag minted (architecture #12).

## Consequences

- Zero new runtime dependencies and zero new permission keys; the module is
  schema + contracts + core services + screens.
- Scheduled publishing is eventually-consistent within the 300s cache
  window rather than to-the-minute; acceptable at launch, and
  `publishDueArticles()` is ready for a real scheduler.
- The rich editor experience (toolbar, paste-to-embed, autosave) trails the
  module, exactly as it does for the rest of the content system.
- The deferred pieces — ingestion worker, comments (flag exists, off),
  premium enforcement, media pipeline, Tiptap UI, shareable preview links —
  each have a named home above; none block launch.

## Alternatives considered

- **Execute the plan verbatim** (second app, JSON bodies, storage package).
  Rejected: violates ADR-006/ADR-009/A7 and re-litigates locked decisions.
- **Reuse `CONTENT_TRANSITIONS` for articles.** Rejected: no unpublish loop,
  and a five-step review chain per news item defeats the module's purpose;
  the enum is shared so reporting/queries stay uniform.
- **New `articles.*` permission keys.** Rejected: `analysis.*`/`news.manage`
  were seeded for exactly this feature (plan.md A7) and are already granted
  to the right roles.

## Compliance

- Every article mutation: `requirePermission`/`requireAnyPermission` first
  line in the action, per-kind publish gate inside the service, audit row,
  `content` revalidation — reviewed against security.md #1–#8.
- The XSS regression suite must cover the article body save path; the
  visibility rule (status × isActive × time × category active × flag) ships
  as a pure, unit-tested function used by every public query.
