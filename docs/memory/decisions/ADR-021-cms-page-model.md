# ADR-021: CMS page model — `Page`/`PageTranslation`/`PageVersion`, four page kinds, layout as validated JSON

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** — (fills the `Page`/`PageTranslation` gap named in
`docs/plan.md` A7; replaces v1 §5.1–5.2's `CmsPage`/`CmsTemplate` shape)
**Superseded by:** ADR-030 (in part — `DATA` redefined), ADR-032 (in part — `Page`/`PageVersion` columns), ADR-027 (in part — `PageKind` gains `PART` for global
site parts; everything else in this ADR stands)

## Context

Two documents describe the same missing model in different words.
`docs/plan.md` A7 lists `Page`/`PageTranslation` as a known schema gap
"needed for a highly dynamic public site". v1 §5.1 invents `CmsPage` +
`CmsPageTranslation` + `CmsPageVersion`, and §5.2 adds `CmsTemplate` +
`CmsTemplateVersion` + `CmsSection` + `CmsBlockPreset` + `CmsEffectPreset`
on top. Building `CmsPage` beside the already-scheduled `Page` would leave
the repo with two page concepts and no reason to prefer either.

v1 also carries three overlapping taxonomies: `PageKind = STANDARD |
LISTING | SYSTEM` on pages, `TemplateKind = PAGE | CONTENT | PART` on
templates, and `contentType` as a free-form string. The critique document
(`docs/changes/review-dynamic-site-paln.md` §11–12) argues for one clean
axis — Static / Collection / Detail / Data — and it is right: a page's kind
is what determines how the renderer sources data, and that is a single
question.

The repo's conventions are fixed and non-negotiable here: PascalCase models,
`String @id @default(cuid())`, `XTranslation` tables keyed
`@@unique([xId, locale])` with `@@unique([locale, slug])`, `ContentStatus`
for publishable content, soft delete via `deletedAt`, and
`localePrefix: "as-needed"` (the default locale's path carries no prefix).

## Decision

**Four new models. No `Cms*` prefix, no template tables in MVP.**

```prisma
enum PageKind { STATIC COLLECTION DETAIL DATA }

model Page {
  id            String   @id @default(cuid())
  key           String?  @unique          // stable key: "home", "news-listing"
  kind          PageKind @default(STATIC)
  contentType   String?                   // registry key; required for COLLECTION/DETAIL
  dataProvider  String?                   // registry key; required for DATA
  status        ContentStatus @default(DRAFT)
  isActive      Boolean  @default(true)   // instant hide, status untouched (ADR-015 #4)
  visibility    FeatureVisibility @default(PUBLIC)  // reuses ADR-012 semantics
  requiresFeature String?                 // feature-flag key, as MenuItem already does
  publishedVersionId String? @unique
  draftVersionId     String? @unique
  createdById   String
  publishedAt   DateTime?
  deletedAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model PageTranslation {
  id             String  @id @default(cuid())
  pageId         String
  locale         String
  title          String
  slug           String            // localized; empty for the home page
  path           String            // resolved public path, no locale prefix stored
  status         TranslationStatus @default(MISSING)
  seoTitle       String?
  seoDescription String?
  ogImageId      String?           // MediaAsset id (ADR-017)
  canonicalUrl   String?
  robots         String? @default("index,follow")
  includeInSitemap Boolean @default(true)
  schemaType     String? @default("WebPage")
  sourceHash     String?           // OUTDATED flow, as content translations do
  @@unique([pageId, locale])
  @@unique([locale, path])
  @@index([locale, slug])
}

model PageVersion {
  id        String   @id @default(cuid())
  pageId    String
  number    Int
  layout    Json     // the block tree — Zod-validated on every read and write
  note      String?
  authorId  String
  createdAt DateTime @default(now())
  @@unique([pageId, number])
}

model CardTemplate { ... }   // see ADR-023
```

1. **`PageKind` is the only taxonomy.**
   - `STATIC` — the admin composes the whole page (`/about`, `/contact`).
   - `COLLECTION` — a listing over a content type (`/news`, `/courses`);
     the layout contains one collection block plus filter/search/pagination
     blocks bound to it (ADR-022).
   - `DETAIL` — the design for _every_ item of a content type. There is at
     most one active DETAIL page per `(contentType, locale-set)`; it has no
     slug of its own and is rendered by the content type's own route with
     the item injected as context. **This replaces v1's `CmsTemplate` with
     `kind = CONTENT`** — a detail template is a page whose data comes from
     the route, not a second entity with its own versioning table.
   - `DATA` — a page over a non-content provider (rates, calendar,
     converter), per the critique §9/§12.
2. **`path` is stored without a locale prefix**, and resolution applies
   `localePrefix: "as-needed"` at read time. Storing `/ur/about` as v1 §5.1
   does would encode a routing strategy into data and break the default
   locale's unprefixed URL.
3. **Layout is `Json`, validated by a Zod schema in `@repo/contracts` on
   every read and write.** A version that fails validation is never
   rendered: the renderer logs, drops the offending node to `FallbackBlock`
   and renders the rest — a bad node loses a section, never a page.
4. **Block-level translations live inside the layout node**
   (`node.translations[locale][prop]`), so a version is atomic and
   rollback-safe. Page-level title/slug/SEO stay relational because routing
   queries them.
5. **Draft and published are two version pointers on the same row.** Publish
   = write a new `PageVersion`, point `publishedVersionId` at it, audit,
   revalidate (ADR-025). Unpublish = null the pointer. Rollback = point at
   an older version. No copy-the-tree-into-the-page column.
6. **Reuses, does not re-invent:** `ContentStatus` (state machine),
   `TranslationStatus` + `sourceHash` (the OUTDATED flow), `deletedAt`,
   `isActive`, `FeatureVisibility` + `requiresFeature` (the exact pair
   `MenuItem` already uses), `Redirect` for slug changes, `recordAudit()`,
   `MediaAsset` for OG images.
7. **Not in MVP:** page templates as a separate entity (use "duplicate this
   page"), reusable sections, block presets, PART templates for
   header/footer (Module 08 owns those), scheduled publishing (the
   `ContentStatus.SCHEDULED` + `cacheLife` pattern from ADR-015 #6 applies
   later, unchanged).

## Consequences

- **Detail pages get no independent version history from their content.**
  Changing the news detail design changes it for every article at once —
  which is the entire point of the critique's model, and means a bad design
  publish is a site-wide event. Mitigated by draft preview and one-click
  rollback to the previous `PageVersion`.
- **One DETAIL page per content type** means no per-category layouts in
  MVP (a "Trade Idea" article cannot have a different detail design from a
  news article beyond what block-level conditionals allow). Deliberate:
  variant-per-item is the feature that turns a CMS into a maintenance
  problem, and `ArticleKind` is already available as a block-level
  condition if a real need appears.
- **`@@unique([locale, path])` collides with explicit route files.** A
  reserved-path guard is mandatory (`news`, `analysis`, `courses`,
  `glossary`, `admin`, `api`, `uploads`, `_next`, `sign-in`) and belongs in
  `@repo/contracts` so both the admin form and the service reject the same
  set.
- **Home page migration.** `home.sections` becomes the `key = "home"`
  STATIC page's layout. The setting stays readable during transition and is
  removed only when the page renders identically — the `check-home-sections`
  script and the section registry are retired in that same PR.

## Alternatives considered

- **v1's `CmsPage` + `CmsTemplate` + `CmsSection` + `CmsBlockPreset`.**
  Rejected: five models where four do, a second page concept beside
  `plan.md` A7's, and a template/page split whose only real difference is
  where the data comes from — which `PageKind` already expresses.
- **Layout in a relational block table** (one row per block). Rejected:
  atomic versioning and rollback become a transaction over N rows, and
  every render becomes a tree reassembly join. v1 §5.7's rule is right.
- **A `PageTemplate` model for reusable starting layouts.** Deferred, not
  rejected — "duplicate page" covers the MVP need, and a template entity
  can be added later without touching `Page`.

## Compliance

- Zod schema for the layout tree lives in `@repo/contracts` and is applied
  in the service on write **and** in the renderer on read; a test asserts a
  malformed node degrades to `FallbackBlock` rather than throwing.
- Reserved-path guard has a unit test enumerating every explicit route file
  in `apps/web/app/(public)/[locale]`.
- Migration + seed idempotency tests (Testcontainers), per Module 01's
  standard.
- `check-permission-keys` covers the new `cms.pages.*` permissions, seeded
  in the same PR that first calls them.
