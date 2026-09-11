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
5 minutes of its time. `publishDueArticles()` stamps
`publishedAt = scheduledFor`; until swept, `effectivePublishedAt()` is the
display time.

**ADR-071 generalised all of this to the other five content entities and moved
the shared parts out.** `ScheduleInPastError` and `effectivePublishedAt` now
live in `content.ts` (`articles.ts` re-exports both — no caller changed), the
`datetime-local` control is `_components/editor/schedule-field.tsx`, shared by
`publish-panel.tsx` and `ContentStatusPanel`, and `publishDueArticles()`
finally has a caller: `POST /api/cron/publish-due` runs it beside
`publishDueContent()` behind a `CRON_SECRET` bearer. Nothing is deployed
calling that route yet, and nothing needs to be — #4 is still the mechanism.

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
shapes in `video-embeds.test.ts`) — **plus two more since changes-10**: the
host branch in `parseVideoEmbedUrl` and the hostname in the sanitizer's
`allowedIframeHostnames`. YouTube uses `youtube-nocookie.com`; thumbnails only
from `i.ytimg.com` (allowlisted in `next.config.ts` remotePatterns —
extend it if the new provider has a thumbnail host).

For the ARTICLE-LEVEL video field, ADR-015 #9 still holds exactly as written:
the URL is stored and the frame derived at render. IN-BODY embeds cannot do
that (the body renders through `dangerouslySetInnerHTML`), so they are
re-derived on every SAVE instead — ADR-046 §2.

## Editor v2 (changes-07, 2026-09-07)

The admin editor is the reference-styled screen: one header **Update &
Publish** calling `saveArticle` — meta + translation in ONE transaction, ONE
audit row, ONE `revalidateTag`. Do not add a second save path; `updateArticleMeta`
and `saveArticleTranslation` still exist and now share the same `apply*`
bodies, so there is one implementation of each write.

- **FAQ items hang off `ArticleTranslation`, not `Article`** — per-locale by
  construction. Answers go through `sanitizeRichText` like bodies (ADR-009).
- **Related posts are `ContentRelation` rows** (`sourceType "article"`,
  `relationType "related"`), NOT a column. `getRelatedArticles` returns the
  curated list if the editor curated one, else the automatic by-shared-tags
  list — never a curated list padded with automatic picks.
- **`focusKeywords` is comma-separated text**; split it with `parseKeywords`
  from `@repo/utils`, never in SQL. All the content-analysis helpers
  (`analyzeContent`, `keywordDensity`, `seoChecks`, `seoScore`) are ADVISORY —
  nothing in a save path may gate on them.
- **`seoChecks` returns ids, not sentences.** Wording lives in the catalogs.
- **The editor is ADMIN surface: `en` only** (ADR-043). The article CONTENT it
  edits is fully multilingual — every translatable field lives on the
  translation row and the locale switcher stays.
- **Per-post custom CSS was rejected** (plan §2.4 #36). It needs ADR-044 and
  runs against ADR-024 and the ADR-042 philosophy. Do not add it casually.

## Editor v3 (changes-10, 2026-09-07) — ADR-046

The body editor is now a full article editor. Three things about it are
load-bearing and are easy to break by "just adding an extension":

- **Author styling is a CLOSED CLASS SET, never inline style.** Tone,
  highlight, font family, font size and alignment render as `ed-*` classes
  resolving to theme tokens. `sanitizeRichText` keeps `allowedStyles: {}`.
  The set lives in THREE places that must agree — `globals.css` (the CSS),
  `EDITORIAL_CLASSES` in `content.ts` (the allowlist), and the enums in
  `editor-extensions.ts` (what the editor emits). Add a value to one and not
  the others and it is silently dropped on save. `sanitize-tiptap.test.ts`
  pins the round trip.
- **Stock Tiptap style extensions are unusable here.** Color, FontFamily,
  FontSize and TextAlign all emit `style="..."`. That is why
  `editor-extensions.ts` hand-writes them. Do not "simplify" it by installing
  `@tiptap/extension-text-style`.
- **In-body `<iframe>` survives only via `parseVideoEmbedUrl`,** which
  re-derives the frame from provider + video id on every save. ADR-015 #9's
  never-store-an-iframe rule is unchanged for the article-level `videoUrl`
  field. Adding a provider now means THREE edits: `PARSERS`, the embed-host
  branch in `parseVideoEmbedUrl`, and `allowedIframeHostnames`.

Also: the HTML source view adds no attack surface (it saves through the same
sanitizer); `Button`'s intent variants mark CONSEQUENCE, not prominence; and
`RichTextLabels` is built once by `richTextLabels(t)` — never inline at a
call site, or the three mount points drift.

## Deferred (named homes)

Autosave (Module 11 editor backlog — one explicit save stays the contract);
media upload pipeline (Module 11, security.md #9
presigned S3); ingestion worker (`source`/`sourceUrl` reserved); shareable
preview tokens (preview is staff-session-gated); premium enforcement
(ADR-012); cron wiring for `publishDueArticles`; E2E on the standing
Playwright backlog.

## Required tests (shipped with the module)

`packages/core/src/articles.integration.test.ts` (Testcontainers): transition
map, per-kind gates, schedule-time visibility, sweep idempotency, XSS
sanitize-on-save, slug 301, full visibility matrix, category-in-use guard.
`packages/utils/src/video-embeds.test.ts`: every whitelisted URL shape +
rejections (no raw-iframe passthrough), and `parseVideoEmbedUrl`'s
acceptances plus its look-alike-host / traversal / wrong-scheme rejections.
`packages/core/src/sanitize-tiptap.test.ts`: the editorial-class round trip,
the frame rebuild, and the six ways a frame is dropped.
`packages/ui/src/components/button.test.tsx`: no two intents resolve to the
same classes. Keep all four green when touching any of the above.
