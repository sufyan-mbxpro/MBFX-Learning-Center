# SKILL — Module 15: News & Analysis (articles)

`docs/news-analysis-module-plan.md` as reconciled by **ADR-015** (read it
first — it maps every deviation the imported plan had from this repo's
architecture). One `Article` model + `kind` (NEWS / ANALYSIS / TRADE_IDEA),
translation tables for articles, categories and tags, bodies as sanitized
HTML (ADR-009).

## The visibility rule (frozen)

An article is publicly visible iff ALL of:

1. `deletedAt IS NULL`
2. `isActive = true` (the instant hide/show toggle — status untouched)
3. its category `isActive = true`
4. `status = PUBLISHED`, **or** `status = SCHEDULED AND scheduledFor <= now()`
5. the page-level feature flag passes (`news` for NEWS, `analysis` otherwise)

1–4 live in ONE place: `publicArticleWhere(now)` in
`packages/core/src/public-articles.ts` — every public query composes it;
never re-derive it inline. #4 is the scheduler (ADR-015 #6): no cron —
with `cacheLife({revalidate: 300})` a scheduled article goes live within
5 minutes of its time. `publishDueArticles()` exists for a future cron and
stamps `publishedAt = scheduledFor`; until swept, `effectivePublishedAt()`
is the display time.

## Lifecycle & permissions

- `ARTICLE_TRANSITIONS` (articles.ts) — NOT the shared `CONTENT_TRANSITIONS`:
  DRAFT ⇄ SCHEDULED/PUBLISHED, PUBLISHED → DRAFT (unpublish) | ARCHIVED,
  ARCHIVED → DRAFT. Review states are unreachable for articles.
- Kind gates (ADR-015 #5): NEWS → `news.manage`; ANALYSIS/TRADE_IDEA →
  `analysis.{create,update,delete,publish}`. Actions gate on
  `requireAnyPermission`, the service does the kind-specific check
  (`articleKindPermission`). Publishing additionally needs the kind's
  publish key. No new permission keys — everything is seeded.

## Revalidation flow

Every mutation in `packages/core/src/articles.ts` ends with `recordAudit`

- `revalidateTag("content", { expire: 0 })` — the same tag the glossary
  uses; the admin never calls a revalidate endpoint (single app, ADR-006).
  Slug changes (article/category/tag translations) write a 301 `Redirect`
  row for the old public path; detail pages resolve it via `getRedirect` +
  `permanentRedirect` (page-level, never the proxy).

## Adding a video provider

One entry in `PARSERS` in `packages/utils/src/video-embeds.ts` (+ its URL
shapes in `video-embeds.test.ts`). Embed URLs/iframes are DERIVED at
render, never stored; YouTube uses `youtube-nocookie.com`; thumbnails only
from `i.ytimg.com` (allowlisted in `next.config.ts` remotePatterns —
extend it if the new provider has a thumbnail host).

## Deferred (named homes)

Tiptap editor UI + in-body embeds/images + autosave (ADR-009 textarea-first,
Module 11 editor backlog); media upload pipeline (Module 11, security.md #9
presigned S3); ingestion worker (`source`/`sourceUrl` reserved); shareable
preview tokens (preview is staff-session-gated); premium enforcement
(ADR-012); cron wiring for `publishDueArticles`; E2E on the standing
Playwright backlog.

## Required tests (shipped with the module)

`packages/core/src/articles.integration.test.ts` (Testcontainers): transition
map, per-kind gates, schedule-time visibility, sweep idempotency, XSS
sanitize-on-save, slug 301, full visibility matrix, category-in-use guard.
`packages/utils/src/video-embeds.test.ts`: every whitelisted URL shape +
rejections (no raw-iframe passthrough). Keep both green when touching any
of the above.
