# MBX Pro — News & Analysis Module: Implementation Plan

**Module code:** `articles`
**Apps touched:** `apps/admin`, `apps/web`
**New packages:** `packages/storage`, `packages/embeds`, `packages/article-renderer`
**Related decisions:** ADR-003 (content sourcing: admin-authored primary, widgets for data, API ingestion deferred)

---

## 1. Scope

A complete content system for News, Analysis, and Trade Ideas:

- Separate **News & Analysis** section in the admin sidebar with its own sub-navigation and settings.
- Full article lifecycle: draft → (scheduled) → published → archived, plus per-item activate/deactivate.
- Tiptap rich-text editor with images, video embeds (YouTube/Vimeo/others via paste), tables, and links.
- Per-article SEO controls + module-level SEO defaults.
- Categories and tags with their own active flags and archive pages.
- Public site: listing pages, article pages, tag/category archives, RSS feed, sitemap entries — all ISR with on-demand revalidation.
- Module-level toggle: the whole section can be deactivated from admin (hidden from public nav + routes return 404).

Out of scope (deferred): API/RSS ingestion worker, comments, premium paywall enforcement (schema field only), multi-language articles (schema is i18n-ready via existing next-intl setup, English-only at launch).

---

## 2. Database Schema (Prisma / MariaDB)

```prisma
enum ArticleType {
  NEWS
  ANALYSIS
  TRADE_IDEA
}

enum ArticleStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
  ARCHIVED
}

model Article {
  id            String        @id @default(cuid())
  slug          String        @unique
  type          ArticleType
  title         String
  excerpt       String        @db.VarChar(500)
  content       Json          // Tiptap JSON document
  status        ArticleStatus @default(DRAFT)
  isActive      Boolean       @default(true)   // deactivate without changing status
  publishedAt   DateTime?
  scheduledAt   DateTime?
  isPremium     Boolean       @default(false)  // schema-ready, unenforced at launch

  // Media
  coverImageId  String?
  coverImage    Media?        @relation("ArticleCover", fields: [coverImageId], references: [id])
  videoUrl      String?       // featured video (validated against embeds whitelist)

  // SEO (all optional — fall back to title/excerpt/module defaults)
  seoTitle      String?       @db.VarChar(70)
  seoDescription String?      @db.VarChar(160)
  ogImageId     String?
  ogImage       Media?        @relation("ArticleOg", fields: [ogImageId], references: [id])
  canonicalUrl  String?
  noIndex       Boolean       @default(false)

  authorId      String
  author        AdminUser     @relation(fields: [authorId], references: [id])
  categoryId    String
  category      Category      @relation(fields: [categoryId], references: [id])
  tags          ArticleTag[]

  // Ingestion-ready (null for manual articles)
  source        String?
  sourceUrl     String?

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([status, isActive, publishedAt])
  @@index([type, status, publishedAt])
  @@index([categoryId])
}

model Category {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  description String?   @db.VarChar(500)
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  seoTitle    String?
  seoDescription String?
  articles    Article[]
}

model Tag {
  id       String       @id @default(cuid())
  slug     String       @unique
  name     String       // e.g. "EUR/USD", "Crude Oil", "Fed"
  isActive Boolean      @default(true)
  articles ArticleTag[]
}

model ArticleTag {
  articleId String
  tagId     String
  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([articleId, tagId])
}

model Media {
  id          String   @id @default(cuid())
  key         String   @unique     // storage key, NEVER a full URL
  contentType String
  sizeBytes   Int
  width       Int?
  height      Int?
  altText     String?
  createdAt   DateTime @default(now())
  articleCovers Article[] @relation("ArticleCover")
  articleOgs    Article[] @relation("ArticleOg")
}
```

**Module settings** live in the existing admin `Setting` key-value store (same mechanism as branding/menus), under the `articles.*` namespace — see §4.4.

**Rules:**

- Publicly visible = `status: PUBLISHED` AND `isActive: true` AND `publishedAt <= now()` AND category `isActive: true` AND module enabled.
- Slug: auto-generated from title (kebab-case, transliterated), editable before first publish; after publish, changing the slug creates a `SlugRedirect` row (301) — small extra table:

```prisma
model SlugRedirect {
  oldSlug   String  @id
  articleId String
  createdAt DateTime @default(now())
}
```

---

## 3. Packages

### 3.1 `packages/storage`

As already designed: `StorageProvider` interface, `LocalStorageProvider` (launch) + `S3StorageProvider` (ready, unused), factory reads `STORAGE_DRIVER` env. DB stores keys only; URLs derived at render. Upload pipeline runs `sharp`: convert to WebP, max width 1920, capture dimensions. Local files live in a shared repo-root `./storage/uploads` dir, served by `apps/web` route handler `/uploads/[...path]` with long cache headers.

### 3.2 `packages/embeds`

- `parseVideoUrl(url) → { provider, videoId, embedUrl, thumbnailUrl } | null`
- Whitelist at launch: YouTube (incl. shorts/youtu.be/live), Vimeo, Dailymotion. Adding a provider = one array entry.
- YouTube uses `youtube-nocookie.com`; thumbnails from `i.ytimg.com`.
- Used by: admin form validation (featured `videoUrl`), Tiptap paste handler, public renderer.

### 3.3 `packages/article-renderer`

- Maps Tiptap JSON node types → React components for the public site.
- Node map: paragraph, headings (h2–h4), bold/italic/underline/strike, link (external links get `rel="noopener nofollow"` for `sourceUrl` domains), bulletList/orderedList, blockquote, table, horizontalRule, image (renders via `next/image` + storage URL), `videoEmbed` (facade component: thumbnail + play button, iframe injected on click), codeBlock.
- Unknown node types render nothing (fail-safe) and log a warning in dev.

---

## 4. Admin Side (`apps/admin`)

New sidebar section **News & Analysis** with sub-items: **Articles**, **Categories**, **Tags**, **Settings**.

### 4.1 Articles list (`/articles`)

- Table: cover thumb, title, type badge, category, author, status badge, active toggle, publishedAt, updatedAt.
- Filters: type, status, category, tag, author, active/inactive; free-text search on title.
- Row actions: Edit, Preview (draft preview link), Duplicate, Activate/Deactivate (inline switch, optimistic), Archive, Delete (soft confirm; hard delete only for never-published drafts).
- Bulk actions: activate, deactivate, archive, change category.
- Pagination + column sort.

### 4.2 Article editor (`/articles/new`, `/articles/[id]`)

Two-column layout — editor left, settings panel right.

**Left — content:**

- Title (large input; slug auto-fills below, editable, uniqueness-checked live).
- Excerpt (textarea, 500 char counter).
- **Tiptap editor** with toolbar: paragraph/H2/H3/H4, bold, italic, underline, strike, link, bullet/ordered list, blockquote, table, horizontal rule, image (opens media upload → storage package), **video embed** (dialog: paste URL → validated by `packages/embeds` → inserts `videoEmbed` node with live preview node-view), code block, undo/redo.
- Paste rules: a lone video URL on an empty line auto-converts to `videoEmbed`; URL inside text stays a link. Pasted images upload through the storage pipeline automatically.
- Editor stores/loads Tiptap JSON. No raw HTML input anywhere; `videoEmbed` stores only `{provider, videoId, originalUrl}` — iframes are constructed at render time (XSS-safe by design).
- Autosave draft every 30s + on blur (server action, debounced).

**Right — settings panel (accordion sections):**

1. **Publish** — status display; buttons: Save Draft / Publish Now / Schedule (datetime picker, must be future); Unpublish (revert to draft); Active toggle. Shows "last published" and "last edited by".
2. **Organization** — type (News/Analysis/Trade Idea), category (select, only active), tags (multi-select combobox with create-inline).
3. **Media** — cover image (upload/pick, alt text required when set); featured video URL (validated, shows provider + thumbnail preview when valid, error state for non-whitelisted URLs).
4. **SEO** — seoTitle (70-char counter, fallback preview shows title), seoDescription (160-char counter, fallback excerpt), OG image (falls back to cover, then module default), canonical URL, noIndex toggle. Live Google-style SERP snippet preview.
5. **Advanced** — premium flag (visible, labeled "not enforced yet"), author reassign (permission-gated).

**Draft preview:** signed preview URL (`/news/preview/[id]?token=…`) rendering the draft on the public app with `noindex` and a "Draft preview" banner. Token: short-lived JWT.

### 4.3 Categories & Tags (`/articles/categories`, `/articles/tags`)

- CRUD tables with inline edit, active toggle, sort order (drag for categories), slug editing with same redirect care, per-category SEO fields.
- Guard: cannot deactivate/delete a category that has published articles without choosing a reassignment target.

### 4.4 Module Settings (`/articles/settings`)

Stored in the `Setting` KV store, namespace `articles.*`:

| Key                         | Type                     | Default         | Effect                                                                            |
| --------------------------- | ------------------------ | --------------- | --------------------------------------------------------------------------------- |
| `articles.enabled`          | bool                     | true            | Master switch: hides section from public nav; public routes 404; sitemap/RSS omit |
| `articles.showInNav`        | bool                     | true            | Nav item without disabling routes (for soft launch)                               |
| `articles.perPage`          | int                      | 12              | Listing pagination size                                                           |
| `articles.defaultOgImage`   | mediaId                  | null            | Fallback OG image                                                                 |
| `articles.seoTitleTemplate` | string                   | `%s \| MBX Pro` | Applied to article pages                                                          |
| `articles.riskDisclaimer`   | rich text (small Tiptap) | preset text     | Rendered under every article + listing footer                                     |
| `articles.showAuthor`       | bool                     | true            | Author byline on/off                                                              |
| `articles.showReadingTime`  | bool                     | true            | Computed reading time on/off                                                      |
| `articles.relatedCount`     | int                      | 3               | Related-articles block size (by shared tags; 0 = off)                             |

Settings changes trigger `revalidateTag('articles')` + nav revalidation.

### 4.5 Server actions & jobs

- Actions: `createArticle`, `updateArticle`, `publishArticle`, `scheduleArticle`, `unpublishArticle`, `setArticleActive`, `deleteArticle`, `duplicateArticle`, CRUD for categories/tags, `uploadMedia`, `updateSettings`. All validate with Zod schemas shared in `packages/validation`; all permission-checked (role: editor+ can draft, publisher+ can publish/schedule — align with existing admin roles).
- **Scheduled publisher:** every minute (node-cron in the admin server at launch; interface kept so it can move to a queue later): flip `SCHEDULED` where `scheduledAt <= now()` → `PUBLISHED`, set `publishedAt`, fire revalidation.
- Every publish/edit/setting change calls the public app's revalidation route (`/api/revalidate`, secret-protected): `revalidateTag('articles')`, `revalidatePath('/news/[slug]')`.

---

## 5. Public Side (`apps/web`)

Routes (all respect `articles.enabled`; all styling from the dynamic branding system):

| Route                   | Content                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `/news`                 | News listing (paginated, ISR + tag revalidation)                    |
| `/analysis`             | Analysis + Trade Ideas listing                                      |
| `/news/[slug]`          | Article page (generateStaticParams for recent N, fallback blocking) |
| `/news/category/[slug]` | Category archive                                                    |
| `/news/tag/[slug]`      | Tag archive                                                         |
| `/news/preview/[id]`    | Draft preview (token-gated, noindex, no cache)                      |
| `/news/rss.xml`         | RSS 2.0 feed of published articles (route handler)                  |

**Article page composition:** breadcrumb → title → meta row (author, date, reading time, category) → cover image or featured-video facade → rendered body (`packages/article-renderer`) → tags → risk disclaimer (from settings) → related articles.

**SEO output per article:** `generateMetadata` builds title (template applied), description, canonical, OG/Twitter cards (og image fallback chain: article OG → cover → module default), `article:published_time`/`modified_time`, robots (noIndex flag). Plus JSON-LD `NewsArticle`/`AnalysisNewsArticle` structured data and sitemap entries via the existing sitemap route (published + active only). Slug redirects handled in middleware from `SlugRedirect` (301).

**Video embeds:** facade pattern — thumbnail + play button, real iframe only on click; `youtube-nocookie` domain; `next/image` remotePatterns updated for `i.ytimg.com` and Vimeo thumbnails.

---

## 6. Build Order & Estimates

| #   | Task                                                                                        | Est.  |
| --- | ------------------------------------------------------------------------------------------- | ----- |
| 1   | `packages/storage` (local + S3 drivers, sharp pipeline, upload route) + tests               | 1.5 d |
| 2   | Prisma schema + migration + seed (categories, sample articles)                              | 0.5 d |
| 3   | `packages/embeds` (parser + whitelist) + tests                                              | 0.5 d |
| 4   | Admin: articles list (filters, toggles, bulk)                                               | 1 d   |
| 5   | Admin: editor — Tiptap config, image upload, video node + paste rules, autosave             | 2 d   |
| 6   | Admin: settings panel (publish/organization/media/SEO/advanced), validation, server actions | 1.5 d |
| 7   | Admin: categories, tags, module settings screens                                            | 1 d   |
| 8   | Scheduled publisher job + revalidation wiring                                               | 0.5 d |
| 9   | `packages/article-renderer` + video facade component                                        | 1 d   |
| 10  | Public routes: listings, article page, archives, preview                                    | 1.5 d |
| 11  | SEO: metadata, JSON-LD, RSS, sitemap, slug redirects                                        | 1 d   |
| 12  | Tests (below) + polish, a11y pass, docs update                                              | 1.5 d |

**Total: ~13.5 dev-days.**

---

## 7. Test Plan

**Unit (Vitest):**

- Embeds parser: every whitelisted URL shape (watch/shorts/youtu.be/live, vimeo, dailymotion), rejection of non-whitelisted and malformed URLs, no raw-iframe passthrough.
- Slug generation/transliteration/uniqueness; redirect creation on slug change.
- Visibility rule (status × isActive × publishedAt × category active × module enabled) as a pure function.
- SEO fallback chains (title/description/OG image).
- Storage providers against a temp dir (local) and mocked S3 client; key format; sharp pipeline output.

**Integration:**

- Server actions: publish/schedule/unpublish flows, permission gates, Zod rejections.
- Scheduled publisher flips due articles and fires revalidation exactly once.
- Revalidation endpoint auth (rejects bad secret).

**E2E (Playwright):**

- Admin creates article with image + pasted YouTube link → publishes → article appears on `/news`, video facade renders and plays on click.
- Schedule flow: scheduled article invisible until time passes (clock mock), then visible.
- Deactivate toggle removes article from public listing and slug returns 404; reactivate restores.
- Module disable: nav item gone, `/news` 404s.
- Draft preview link works with token, 401s without.
- SEO: article page emits correct meta/OG/JSON-LD (snapshot).

---

## 8. Governance Notes

- Record **ADR-003 — Content sourcing** (admin-authored primary; widgets for market data; API ingestion deferred with `source`/`sourceUrl` fields reserved) and **ADR-004 — Media storage** (local at launch behind `StorageProvider` interface; S3-compatible switch via env + copy migration; DB stores keys only).
- Update `docs/memory/stack.md` with pinned versions: Tiptap + extensions, sharp, node-cron, @aws-sdk/client-s3 (dev-installed, unused at runtime until switch).
- Add uploads directory to VPS backup procedure alongside MariaDB dumps (ops doc).
- Per-module skill file: `skills/articles.md` documenting the visibility rule, revalidation flow, and how to add a new video provider.
