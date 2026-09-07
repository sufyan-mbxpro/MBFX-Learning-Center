— **written, blocked on E2E auth hydration; see DEVLOG 2026-09-07** |— **written, blocked on E2E auth hydration; see DEVLOG 2026-09-07** |— **written, blocked on E2E auth hydration; see DEVLOG 2026-09-07** |# changes-07 — Article editor v2 (WordPress-style edit screen) — plan

**Status:** PRs 0–6 and 8 SHIPPED 2026-09-07. PR 7 (custom CSS) deliberately
not built — see §2.4 #36 and §10.4 #4. Verified against the working tree on
2026-09-07.
**Source brief:** two reference screenshots supplied in-chat by the owner — (a)
the article-list row-actions dropdown, (b) the full "Edit Post" screen of the
existing MBFX WordPress-style blog admin. Same class of brief as
`changes-05`/`changes-06`: _follow the reference's design and data
presentation, add the data we are missing, remove nothing we already have._
**Governing rules:** `claude.md`, `.claude/rules/{architecture,security,code-style,testing}.md`,
`docs/plan.md` Part D/F, ADR-009, ADR-012, ADR-015, ADR-017, ADR-024, ADR-035,
ADR-037, ADR-038, ADR-040, ADR-042, ADR-043.
**Module:** 15 (News & Analysis) — `.claude/skills/articles/SKILL.md`.

---

## 0. Scope contract

**In scope**

- `apps/web/app/(admin)/admin/articles/[id]/**` — the edit screen, rebuilt to
  the reference's information architecture.
- `apps/web/app/(admin)/admin/articles/articles-table.tsx` — the row-actions
  menu, restructured to the reference's grouped menu.
- `packages/db` — new columns/models for the fields the reference has and we
  do not.
- `packages/contracts` — Zod schemas for those fields.
- `packages/core/src/articles.ts` + `public-articles.ts` — the services behind
  them, plus a new relation service.
- `packages/utils` — pure content-analysis helpers (word/char count, keyword
  density, SEO checks).
- `apps/web/app/(public)/[locale]/news/**` — rendering the new data, so no
  field is write-only.
- `packages/i18n/messages/en.json` — every new label. The editor is admin
  surface, so `en` only (ADR-043).

**Out of scope (explicit)**

- Anything in the paused trees: Website Builder (`admin/website/**`, ADR-037),
  navigation reorder, homepage section composer, Settings → Layout, Theme's
  Layout & Display tab (ADR-038). Nothing in this plan touches them.
- Changing the article visibility rule (`publicArticleWhere`, SKILL.md
  "frozen"), the transition map, or the kind→permission mapping.
- New permission keys. Every gate here reuses `news.manage` /
  `analysis.{view,create,update,delete,publish}`, all already seeded
  (testing.md #5 stays satisfiable without a registry change).
- Multi-locale changes to the reference's single-locale design: our editor is
  per-locale and stays that way (§2.3). **Reaffirmed by the owner 2026-09-07:
  the platform stays multilingual and none of it is to be simplified away.**
  The reference screens are single-locale; that is a property of the reference,
  never a target. Concretely, for this plan: the locale switcher stays, every
  new translatable field (title, slug, excerpt, body, all SEO, FAQ) lives on
  `ArticleTranslation` not `Article`, and PR 8's public rendering keeps the
  article routes' existing `alternates.languages` hreflang intact.
  **Corrected 2026-09-07 by ADR-043:** the ~55 new labels this plan adds are
  all `admin.*` — the editor screen is admin surface, which is English-only by
  design. They land in `en.json` **only**. This is scope removed from §6, not
  deferred. The article _content_ stays fully multilingual; only the chrome
  around it is English.
- The reference's WordPress-isms that have no home here: numeric post IDs, its
  own sidebar/menu chrome, its media modal.

**Hard constraints carried from the rules**

- `requirePermission`/`requireAnyPermission` is the first line of every new
  action; the service re-checks the kind gate (security.md #1–#3).
- No new route handler or action touches Prisma — all of it goes through
  `@repo/core` (architecture.md #2).
- Every new user-facing string goes through a catalog key (code-style.md #2).
  Admin keys need `en.json` only (ADR-043); public keys need every active locale.
- No colour literals; the reference's green/amber/blue/red menu items map to
  existing `StatusBadge` tones and `Button`/`DropdownMenuItem` variants
  (code-style.md #1).
- Logical properties only — the reference is LTR-only, we are not.
- Rich text and any authored CSS are sanitized **server-side on save**
  (security.md #8), regardless of what the widget does.
- Images enter only through `storeImage()` + the upload widget; no URL-fetch
  fields are added (security.md #9). The reference's "Add Image URL" button is
  therefore adapted, not copied (§2.3 row 32).
- Mutations end with `revalidateTag("content", { expire: 0 })`; no
  `revalidatePath`, no route-level `revalidate` (architecture.md #12).

---

## 1. Extracted reference spec

The full inventory of the reference screens, recorded here because the
screenshots live only in the chat. Numbering is referenced by §2.

### 1.1 Row-actions dropdown (screenshot a)

Grouped menu opened from a `⋮` trigger in the list's ACTIONS column:

| Group    | Item         | Icon          | Treatment   |
| -------- | ------------ | ------------- | ----------- |
| `EDIT`   | Quick Edit   | pencil        | default     |
| `EDIT`   | Full Editor  | external-link | default     |
| `STATUS` | Set as Draft | file-off      | amber text  |
| `STATUS` | Set Featured | star          | default     |
| —        | View Post    | eye           | blue text   |
| —        | Delete       | trash         | destructive |

Surrounding list context: a `DATE` column, an `ACTIONS` column, `Page 1 of 3`
pagination, green status pills on rows.

### 1.2 Edit screen (screenshot b)

**Header (sticky):** title "Edit Post", subtitle "Update your blog post content
and settings"; end-aligned `Cancel` / `View Live` (outline, external icon) /
`Update & Publish` (primary). **One save button commits the whole screen.**

**Left column**

1. **Post Content** card
   - Title (input)
   - Slug (input)
   - **Post URL** — read-only, full absolute URL, muted
   - Content — editor with a mode switch: `Content Editor | Visual | HTML`,
     plus a two-row toolbar (block format, font family, font size, B/I/U/S,
     alignment, lists, indent, link, image, table, undo/redo, fullscreen)
   - **Content stats strip** — four tiles: Words `1014`, Characters `6005`,
     Reading Time `6 min`, Keywords `10`
   - **Keyword Density** panel — one chip per focus keyword with its measured
     percentage, plus the hint "Optimal keyword density: 2–3%"
   - Excerpt (textarea)
2. **SEO** card, tabbed: `Basic SEO | Social Media | Advanced | SEO Analysis`
   - _Basic SEO_: Meta Title (`56/60 characters`, hint "Leave empty to use post
     title. Optimal length: 50–60 characters"), Meta Description
     (`144/160 characters`, hint), Focus Keywords (comma-separated, hint
     "Separate multiple keywords with commas. These should appear naturally in
     your content."), Canonical URL (hint "Leave empty to use default URL. Use
     for duplicate content management"), checkbox "Allow search engines to
     index this post", checkbox "Allow search engines to follow links"
   - _Social Media_: Open Graph / Twitter overrides
   - _Advanced_: robots and misc
   - _SEO Analysis_: rule-based score/checklist
3. **FAQ Block Editor** card — `Schema` toggle + `+ Add FAQ`; empty state: `?`
   medium, "No FAQs yet", "Create your first FAQ to get started",
   `+ Add First FAQ`
4. **Related Posts** card — heading `Related Posts (0)`, hint "Related posts
   help improve user engagement and SEO by suggesting relevant content.",
   `+ Add Related Posts`; empty state: link medium, "No related posts yet",
   "Add related posts to improve engagement and SEO"
5. **Related Posts Settings** card — "Show Related Posts" (switch), "Number of
   Related Posts" (select, default `3 posts`)
6. **Custom CSS** card — `Show Preview` / `Expand`; Quick Templates
   (`Custom Background | Custom Typography | Custom Button Style | Responsive Layout`);
   a code area pre-seeded with a **post-scoped selector** (`.post-<slug> { }`);
   a "CSS Tips" info box

**Right column**

7. **Publishing Schedule** card — subtitle "Manage when this post will be
   published"; a green `Published` state banner; `Save as Draft` /
   `Schedule Post`; "Schedule Date & Time" datetime field; quick presets
   `+1 Hour`, `Tomorrow 9AM`, `Next Week`, `Clear`
8. **Categories** card (collapsible) — checkbox list **with article counts**
   (`Forex MBFX (2)`, `Marketing news (0)` …), a "No Category" option,
   `+ Add New Category`
9. **Tags** card (collapsible) — checkbox list with counts, `+ Add New Tag`
10. **Post Settings** card — **Featured Media** with `Image | Video` tabs,
    preview, `Upload New Image` / `Media Library`, `+ Add Image URL`; **Page
    Header Image** with hint "Optional header image displayed at the top of
    this specific post page", preview with an X remove affordance,
    `Change Header Image`; checkbox **Featured Post**
11. **Post Information** card — `Created 7/8/2026`, `Updated 7/8/2026`,
    `ID #24`

---

## 2. Gap analysis

Classification: **A** = already have it, keep as-is · **B** = missing, add ·
**C** = have it but must be re-presented/adapted · **D** = reject or gate, with
reason.

### 2.1 Already present (A) — nothing to do but re-place it in the new layout

| #   | Reference element                                                             | Where it lives today                                                                                                                                               |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Title, Slug, Excerpt, Content                                                 | `article-editor.tsx` `TranslationForm`                                                                                                                             |
| 2   | Rich text toolbar (B/I/U/S, H2/H3, lists, quote, code, link, image, HR, undo) | `admin/_components/rich-text-editor.tsx` (Tiptap, ADR-009)                                                                                                         |
| 3   | Meta Title / Meta Description with character counters                         | `TranslationForm` + `CharCount` (70/180 caps, from the DB columns)                                                                                                 |
| 4   | Canonical URL, "index this post"                                              | `canonicalUrl`, `noIndex`                                                                                                                                          |
| 5   | Publish / Draft / Schedule + datetime                                         | `PublishPanel`, `ARTICLE_TRANSITIONS`                                                                                                                              |
| 6   | Categories (single-select), Tags (multi-check)                                | `MetaPanel`                                                                                                                                                        |
| 7   | Featured image, featured video                                                | `coverImageUrl`/`coverImageAssetId`, `videoUrl` (+ `parseVideoUrl`)                                                                                                |
| 8   | Updated timestamp                                                             | `PublishPanel`                                                                                                                                                     |
| 9   | Delete (soft) + Restore                                                       | `setArticleDeletedAction`                                                                                                                                          |
| 10  | **Category/tag article counts**                                               | `ArticleCategoryAdminRow.articleCount` / `ArticleTagAdminRow.articleCount` — _already computed by the loaders and thrown away by `[id]/page.tsx` today._ Free win. |

Additionally we have things the reference does **not**: locale switcher +
per-locale translation status, article `kind`, `isActive` quick toggle,
`isPremium`, `source`/`sourceUrl`, `Duplicate`, `Preview draft`. **None are
removed** — §5 gives each one a home in the new layout.

### 2.2 Missing — to add (B)

| #   | Reference element                                           | Home                                                                                                       |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 11  | Post URL read-only preview                                  | derived: `NEXT_PUBLIC_SITE_URL` + `articlePath(locale, defaultLocale, slug)` (both exist)                  |
| 12  | Words / Characters / Reading time / Keyword count strip     | `@repo/utils` `analyzeContent()` (new) — `readingTimeMinutes()` already exists and is reused               |
| 13  | Focus keywords                                              | `ArticleTranslation.focusKeywords`                                                                         |
| 14  | Keyword density chips + optimal-range hint                  | `@repo/utils` `keywordDensity()` (new)                                                                     |
| 15  | "Allow search engines to follow links"                      | `ArticleTranslation.noFollow`                                                                              |
| 16  | Social Media tab (OG + Twitter overrides)                   | `ArticleTranslation.ogTitle`, `ogDescription`, `twitterCard`, `twitterImageUrl`, `twitterImageAssetId`     |
| 17  | SEO Analysis tab                                            | `@repo/utils` `seoChecks()` (new) — pure, no storage                                                       |
| 18  | FAQ blocks (+ FAQPage schema)                               | new `ArticleFaqItem` model, per translation                                                                |
| 19  | Related posts                                               | **reuse `ContentRelation`** (`sourceType:"article"`, `relationType:"related"`, `sortOrder`) — no new model |
| 20  | Show Related Posts / Number of Related Posts                | `Article.showRelated`, `Article.relatedCount`                                                              |
| 21  | Page Header Image                                           | `Article.headerImageUrl`, `Article.headerImageAssetId` (ADR-035 pairing)                                   |
| 22  | Featured Post                                               | `Article.isFeatured` (+ index)                                                                             |
| 23  | Created date                                                | `ArticleAdminDetail.createdAt` — column exists, is not selected                                            |
| 24  | Schedule quick presets (+1h / tomorrow 9am / next week)     | client-only helper in the publish panel                                                                    |
| 25  | Inline "Add New Category" / "Add New Tag"                   | reuse `createArticleCategoryAction` / `createArticleTagAction` from a small dialog                         |
| 26  | HTML source mode on the editor                              | `RichTextEditor` `mode` state; server sanitization unchanged                                               |
| 27  | Row menu: Quick Edit, Set as Draft, Set Featured, View Post | `articles-table.tsx` + a new quick-edit dialog + `setArticleFeaturedAction`                                |
| 28  | Sticky header with one `Update & Publish`                   | `saveArticle()` — one transactional core service (§4.2)                                                    |

### 2.3 Have it, but adapt (C)

| #   | Reference                                        | Adaptation and why                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 29  | Single-locale screen                             | We are multi-locale. The locale switcher stays and moves into the Post Content card header; **per-translation fields** (title/slug/excerpt/body/all SEO/FAQ) switch with it, **per-article fields** (media, category, tags, flags, related, schedule) do not. The header save commits both halves in one transaction. |
| 30  | Two save buttons today (translation + meta)      | Replaced in the UI by one header save. `saveArticleTranslation` and `updateArticleMeta` **stay exported** (tests and other callers depend on them); `saveArticle` composes them in a transaction. Nothing is deleted.                                                                                                 |
| 31  | `ID #24`                                         | Our ids are cuids. Render the cuid with a copy-to-clipboard button, labelled "ID".                                                                                                                                                                                                                                    |
| 32  | "+ Add Image URL"                                | **Not copied.** security.md #9 is explicit: image "URL" text fields are _replaced_ by the upload widget, not supplemented. The Media Library picker covers the real need.                                                                                                                                             |
| 33  | Font-family / font-size / table toolbar controls | Out — ADR-024 keeps authored styling inside the design system, and per-post font pickers are the class of control ADR-038 just paused elsewhere. Block format + the existing marks stay.                                                                                                                              |
| 34  | Green/amber/blue status colours                  | Map to `StatusBadge` tones + `DropdownMenuItem variant="destructive"`. No literals.                                                                                                                                                                                                                                   |
| 35  | Collapsible sidebar cards                        | `Accordion` from `@repo/ui` (no `Collapsible` component exists; do not add one for this).                                                                                                                                                                                                                             |

### 2.4 Reject or gate (D)

| #   | Reference                                                     | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 36  | **Custom CSS per post** (with Quick Templates + live preview) | **Needs an ADR and the owner's explicit sign-off before PR 7 starts.** It runs against ADR-024 (authored styling stays inside the design system), against the ADR-037/ADR-038 philosophy (design lives in code; only content _data_ is admin-managed), and against code-style.md #1's intent. It is also a security surface: arbitrary CSS exfiltrates via `url()`, and our CSP is nonce-based (security.md #14), so an injected `<style>` needs the nonce. §6 PR 7 specifies the constrained version if approved. |
| 37  | "Schema" toggle on the FAQ card                               | Dropped as a toggle — if an article has FAQ items we always emit `FAQPage` JSON-LD. A switch whose only "off" state is "have structured data but hide it" is a footgun.                                                                                                                                                                                                                                                                                                                                            |
| 38  | Numeric post ID                                               | See #31.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## 3. Data model

All changes are additive columns plus one new model. **Pre-launch DB policy:
reset and reseed (`pnpm db:reset`), no backfill migration.**

`packages/db/prisma/schema.prisma`:

```prisma
model Article {
  // ... existing fields unchanged ...
  isFeatured          Boolean  @default(false)
  headerImageUrl      String?  @db.VarChar(500)
  headerImageAssetId  String?              // ADR-035 pairing, same as coverImageAssetId
  showRelated         Boolean  @default(true)
  relatedCount        Int      @default(3)
  customCss           String?  @db.Text    // PR 7 only — omit if #36 is rejected

  @@index([isFeatured, status, publishedAt])   // new: featured strips
}

model ArticleTranslation {
  // ... existing fields unchanged ...
  focusKeywords       String?  @db.VarChar(300)   // comma-separated, parsed in utils
  noFollow            Boolean  @default(false)
  ogTitle             String?  @db.VarChar(120)
  ogDescription       String?  @db.VarChar(300)
  twitterCard         String?  @db.VarChar(20)    // "summary" | "summary_large_image"
  twitterImageUrl     String?  @db.VarChar(500)
  twitterImageAssetId String?

  faqItems            ArticleFaqItem[]
}

model ArticleFaqItem {
  id            String   @id @default(cuid())
  translationId String
  sortOrder     Int      @default(0)
  question      String   @db.VarChar(300)
  answer        String   @db.Text          // sanitized HTML (ADR-009 pipeline)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  translation   ArticleTranslation @relation(fields: [translationId], references: [id], onDelete: Cascade)

  @@index([translationId, sortOrder])
  @@map("article_faq_items")
}
```

**FAQ is keyed to the translation, not the article**, so a question/answer pair
is naturally per-locale and cascades with its translation — no second
translation table, no orphan-locale case to reason about.

**Related posts reuse `ContentRelation`** exactly as it stands (already in the
schema, currently unused by any service): `sourceType:"article"`,
`sourceId:articleId`, `targetType:"article"`, `targetId`,
`relationType:"related"`, `sortOrder`. The `uniq_relation` unique index gives
idempotent upserts for free. No schema change for #19.

`docs/erd.md` gets the new model + columns in the same PR.

---

## 4. Contracts and services

### 4.1 `packages/contracts/src/content.ts`

```ts
export const articleFaqItemSchema = z.object({
  id: z.string().optional(), // absent = create
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(5000), // sanitized server-side
});

export const saveArticleTranslationSchema = /* extended */ z.object({
  // ... existing keys ...
  focusKeywords: z.string().max(300).nullable().optional(),
  noFollow: z.boolean().optional(),
  ogTitle: z.string().max(120).nullable().optional(),
  ogDescription: z.string().max(300).nullable().optional(),
  twitterCard: z.enum(["summary", "summary_large_image"]).nullable().optional(),
  twitterImageUrl: z.string().max(500).nullable().optional(),
  twitterImageAssetId: z.string().nullable().optional(),
  faqItems: z.array(articleFaqItemSchema).max(20).optional(),
});

export const updateArticleMetaSchema = /* extended */ z.object({
  // ... existing keys ...
  isFeatured: z.boolean().optional(),
  headerImageUrl: z.string().max(500).nullable().optional(),
  headerImageAssetId: z.string().nullable().optional(),
  showRelated: z.boolean().optional(),
  relatedCount: z.number().int().min(1).max(12).optional(),
  relatedArticleIds: z.array(z.string()).max(12).optional(),
});

/** The header save: one payload, one transaction. */
export const saveArticleSchema = z.object({
  articleId: z.string().min(1),
  meta: updateArticleMetaSchema,
  translation: saveArticleTranslationSchema,
});
```

Every new field is `.optional()` so existing callers — and the existing
integration tests — compile and behave unchanged. Additive only.

### 4.2 `packages/core/src/articles.ts`

```ts
export async function saveArticle(actor: Subject, input: SaveArticleInput): Promise<void>;
// one db.$transaction: updateArticleMeta's body + saveArticleTranslation's body
// + replaceArticleFaqItems + replaceRelatedArticles, ONE recordAudit,
// ONE revalidateTag("content", { expire: 0 }).

export async function setArticleFeatured(
  actor: Subject,
  articleId: string,
  isFeatured: boolean,
): Promise<void>;
// mirrors setArticleActive exactly: kind gate via articleKindPermission(kind, "update").

export async function quickUpdateArticle(
  actor: Subject,
  articleId: string,
  input: QuickEditInput,
): Promise<void>;
// title/slug (default locale) + status + categoryId — the row menu's Quick Edit.
// Slug change still writes the 301 Redirect row, same as saveArticleTranslation.
```

`ArticleAdminDetail` gains: `createdAt`, `isFeatured`, `headerImageUrl`,
`headerImageAssetId`, `showRelated`, `relatedCount`, `relatedArticles: {id,
title}[]`, and per-translation `focusKeywords`, `noFollow`, `ogTitle`,
`ogDescription`, `twitterCard`, `twitterImageUrl`, `twitterImageAssetId`,
`faqItems`.

`ArticleAdminRow` gains `isFeatured` (so the list's Set Featured item can show
state).

**FAQ answers go through `sanitizeRichText()` on save** — same pipeline as
bodies, pinned by the same vocabulary as `sanitize-tiptap.test.ts` (ADR-009,
security.md #8).

### 4.3 `packages/core/src/content-relations.ts` (new, ~60 lines)

```ts
export async function replaceRelations(
  tx,
  sourceType: string,
  sourceId: string,
  targetType: string,
  relationType: string,
  targetIds: string[],
): Promise<void>;

export async function loadRelatedArticles(
  articleId: string,
  locale: string,
  limit: number,
): Promise<PublicArticleCard[]>;
```

`loadRelatedArticles` composes `publicArticleWhere(now)` — the visibility rule
is never re-derived (SKILL.md, frozen).

### 4.4 `packages/utils/src/content-analysis.ts` (new, pure)

```ts
export interface ContentStats {
  words: number;
  characters: number;
  readingMinutes: number;
}
export function analyzeContent(html: string): ContentStats;
export function parseKeywords(raw: string | null): string[];
export function keywordDensity(
  html: string,
  keywords: string[],
): { keyword: string; count: number; density: number }[];

export type SeoCheckId =
  | "titleLength"
  | "descriptionLength"
  | "focusKeywordInTitle"
  | "focusKeywordInDescription"
  | "focusKeywordInFirstParagraph"
  | "contentLength"
  | "hasSubheadings"
  | "hasImages"
  | "hasInternalLink";
export interface SeoCheck {
  id: SeoCheckId;
  passed: boolean;
}
export function seoChecks(input: {
  title: string;
  description: string;
  body: string;
  keywords: string[];
}): SeoCheck[];
export function seoScore(checks: SeoCheck[]): number; // 0–100
```

Pure, locale-agnostic, no DOM. `@repo/utils` carries a **90% coverage floor**
(testing.md #1), so these ship with exhaustive unit tests. `SeoCheck` returns
an **id, not a sentence** — the wording lives in the catalogs (code-style.md
#2). `readingTimeMinutes()` is reused, not reimplemented.

---

## 5. UI composition

`apps/web/app/(admin)/admin/articles/[id]/` — `article-editor.tsx` (621 lines
today) splits into a directory of focused client components. Every panel below
is a `Panel`/`AdminSection` card, matching the existing admin rhythm.

```
[id]/
├── page.tsx                    # RSC: loaders, gates, all labels (unchanged shape)
├── article-editor.tsx          # shell: form state, locale switch, header actions
├── _panels/
│   ├── content-panel.tsx       # title, slug, Post URL, editor, stats strip, excerpt
│   ├── content-stats.tsx       # 4 tiles + keyword-density chips
│   ├── seo-panel.tsx           # Tabs: Basic | Social | Advanced | Analysis
│   ├── seo-analysis.tsx        # seoChecks() → checklist + score
│   ├── faq-panel.tsx           # list + add/remove/reorder, Empty state
│   ├── related-posts-panel.tsx # picker (Command) + list + settings
│   ├── publish-panel.tsx       # status, transitions, schedule + presets
│   ├── taxonomy-panel.tsx      # categories + tags, counts, inline create
│   ├── post-settings-panel.tsx # featured media Image|Video tabs, header image, flags
│   └── post-info-panel.tsx     # created / updated / id / kind / source
└── quick-edit-dialog.tsx       # used by articles-table.tsx
```

**Where the things the reference lacks go** (nothing is dropped):

| Ours                                       | New home                             |
| ------------------------------------------ | ------------------------------------ |
| Locale switcher + translation status badge | Post Content card header             |
| `kind` (NEWS/ANALYSIS/TRADE_IDEA)          | Post Information panel (select)      |
| `isActive`                                 | Post Settings panel, beside Featured |
| `isPremium` + hint                         | Post Settings panel                  |
| `source` / `sourceUrl`                     | Post Information panel               |
| Preview draft                              | header, next to `View Live`          |
| Soft delete / restore                      | header overflow `⋮`, destructive     |
| Duplicate                                  | header overflow `⋮`                  |

Header: `AdminPage` gains a `sticky` prop (`sticky top-0 z-10 bg-background`)
rather than a new page-header component — one place, per that file's own
comment. `actions` carries Cancel / Preview / View Live / **Update & Publish** /
overflow.

`admin/_components/rich-text-editor.tsx` gains `mode: "visual" | "html"` with a
segmented control; HTML mode is a plain textarea over the same value. Server
sanitization is unchanged and remains the boundary.

`articles-table.tsx` `RowActions` is restructured to the reference's grouped
menu using the already-exported `DropdownMenuLabel` / `DropdownMenuGroup` (both
present in `packages/ui/src/components/dropdown-menu.tsx`), keeping `Duplicate`
under `EDIT`.

---

## 6. PR breakdown

Each PR ends green on **lint → typecheck → test → build** and gets its own
DEVLOG entry (testing.md #6). PRs 1–3 are prerequisites; 4–6 are independent of
each other; 8 needs 1–3.

| PR    | Title                                                     | Files                                                                                                                                                                                                                                                                                 |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Content-analysis helpers                                  | `packages/utils/src/content-analysis.ts`, `content-analysis.test.ts`, `index.ts`                                                                                                                                                                                                      |
| **2** | Schema + contracts                                        | `packages/db/prisma/schema.prisma`, new migration, seed (a featured + FAQ'd sample article), `docs/erd.md`, `packages/contracts/src/content.ts` (+ `content.test.ts`)                                                                                                                 |
| **3** | Core services                                             | `packages/core/src/articles.ts` (`saveArticle`, `setArticleFeatured`, `quickUpdateArticle`, widened detail/row types, FAQ + relation writes), `packages/core/src/content-relations.ts` (new), `packages/core/src/articles.integration.test.ts` (+cases), `packages/core/src/index.ts` |
| **4** | Editor shell + Post Content + Post Info                   | `[id]/article-editor.tsx` split, `_panels/{content-panel,content-stats,post-info-panel}.tsx`, `[id]/page.tsx`, `_actions/article-actions.ts` (`saveArticleAction`), `admin/_components/{admin-page,rich-text-editor}.tsx`, `en` catalog                                               |
| **5** | SEO panel (4 tabs)                                        | `_panels/{seo-panel,seo-analysis}.tsx`, `en` catalog                                                                                                                                                                                                                                  |
| **6** | FAQ + Related + Post Settings + Publish + Taxonomy panels | `_panels/{faq-panel,related-posts-panel,publish-panel,taxonomy-panel,post-settings-panel}.tsx`, `en` catalog                                                                                                                                                                          |
| **7** | _(gated — ADR first)_ Custom CSS                          | `Article.customCss`, `packages/core/src/sanitize-css.ts` (scope-prefix every selector to `.post-<id>`; strip `@import`, non-relative `url(`, `behavior`, `expression`), feature flag, nonce'd `<style>` on the public page, `sanitize-css.test.ts`                                    |
| **8** | List row menu + Quick Edit + public rendering             | `articles-table.tsx`, `[id]/quick-edit-dialog.tsx`, `_actions/article-actions.ts` (`setArticleFeaturedAction`, `quickUpdateArticleAction`), `app/(public)/[locale]/news/[slug]/page.tsx` (header image, FAQ JSON-LD, related strip, `noFollow` in `robots`, OG/Twitter), `en` catalog |

**Action signatures added** (each with its gate as the first line):

```ts
// _actions/article-actions.ts
export async function saveArticleAction(input: SaveArticleInput): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await saveArticle(subject, saveArticleSchema.parse(input));
}
export async function setArticleFeaturedAction(
  articleId: string,
  isFeatured: boolean,
): Promise<void>;
export async function quickUpdateArticleAction(
  articleId: string,
  input: QuickEditInput,
): Promise<void>;
```

**Catalog keys** (all four of `en/es/ar/ur`): ~55 new keys — `postUrlLabel`,
`wordsLabel`, `charactersLabel`, `readingTimeLabel`, `keywordsLabel`,
`keywordDensityLabel`, `keywordDensityHint`, `focusKeywordsLabel`,
`focusKeywordsHint`, `noFollowLabel`, `seoTabBasic|Social|Advanced|Analysis`,
`ogTitleLabel`, `ogDescriptionLabel`, `twitterCardLabel`, `seoCheck.<id>` ×9,
`seoScoreLabel`, `faqSection`, `faqEmptyTitle`, `faqEmptyBody`, `addFaq`,
`addFirstFaq`, `questionLabel`, `answerLabel`, `relatedPostsSection`,
`relatedEmptyTitle`, `relatedEmptyBody`, `addRelatedPosts`, `showRelatedLabel`,
`relatedCountLabel`, `schedulePlusHour`, `scheduleTomorrow9`,
`scheduleNextWeek`, `scheduleClear`, `featuredMediaLabel`, `mediaTabImage`,
`mediaTabVideo`, `headerImageLabel`, `headerImageHint`, `changeHeaderImage`,
`featuredPostLabel`, `postInfoSection`, `createdLabel`, `idLabel`, `copyId`,
`addNewCategory`, `addNewTag`, `quickEdit`, `fullEditor`, `setAsDraft`,
`setFeatured`, `viewPost`, `viewLive`, `updateAndPublish`, `editGroupLabel`,
`statusGroupLabel`, `editorModeVisual`, `editorModeHtml`.
All ~55 are `admin.*`, so `en.json` only (ADR-043) —
`check:catalog-completeness` is silent on admin namespaces by design.

---

## 7. Criterion → test

| #   | Criterion                                                                                            | Test                                                                              |
| --- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Word/char/reading-time math is right, including entities and empty bodies                            | `packages/utils/src/content-analysis.test.ts`                                     |
| 2   | Keyword density counts phrases case-insensitively, ignores markup, never divides by zero             | same                                                                              |
| 3   | Each of the 9 SEO checks flips on its own boundary; score is monotone                                | same                                                                              |
| 4   | New contract fields reject over-length / wrong-enum input; omitting them keeps old payloads valid    | `packages/contracts/src/content.test.ts`                                          |
| 5   | `saveArticle` writes meta + translation + FAQ + relations **atomically** (throw ⇒ nothing persisted) | `articles.integration.test.ts` (Testcontainers)                                   |
| 6   | `saveArticle` emits exactly one audit row                                                            | same                                                                              |
| 7   | FAQ answers are sanitized on save (`<script>` in an answer never persists)                           | same — extends the existing XSS case                                              |
| 8   | Replacing relations is idempotent and drops removed targets                                          | same                                                                              |
| 9   | `loadRelatedArticles` never returns a draft/inactive/deleted/hidden-category article                 | same, against the full visibility matrix                                          |
| 10  | `setArticleFeatured` denies a subject holding only the other kind's permission                       | same (mirrors the existing per-kind gate cases)                                   |
| 11  | `quickUpdateArticle` slug change still writes the 301 `Redirect` row                                 | same                                                                              |
| 12  | Editor renders every field it had before the split — nothing lost                                    | RTL component test on `article-editor.tsx`                                        |
| 13  | HTML mode round-trips the body without mutating it                                                   | RTL test on `rich-text-editor.tsx`                                                |
| 14  | Happy path: edit → Update & Publish → DB reflects every panel                                        | Playwright admin suite — **WRITTEN, BLOCKED** (auth hydration; DEVLOG 2026-09-07) |
| 15  | Permission-denied: `analysis.view`-only subject gets no save, **asserted at the DB level**           | Playwright + direct DB assert — **WRITTEN, BLOCKED** (same)                       |
| 16  | Row menu: Set Featured / Set as Draft / Quick Edit each change the row and the DB                    | Playwright — **WRITTEN, BLOCKED** (same)                                          |
| 17  | axe: no serious/critical violations on the rebuilt editor                                            | `@axe-core/playwright` — **NOT WRITTEN**                                          |
| 18  | RTL: `ar` renders the two-column editor with `dir=rtl` and no horizontal overflow                    | RTL smoke suite — **NOT WRITTEN**                                                 |
| 19  | Public: FAQ items emit valid `FAQPage` JSON-LD; `noFollow` reaches `robots`                          | public suite — **PASSING** (`e2e/public/article-page.spec.ts`)                    |
| 20  | _(PR 7 only)_ Every authored selector is scope-prefixed; `@import`/remote `url()` never survives     | `sanitize-css.test.ts`                                                            |

---

## 8. Governance

- **ADR required before PR 7 only.** Per-post authored CSS deviates from
  ADR-024 and from the ADR-037/038 design philosophy; plan.md Part F #10 puts
  the ADR _before_ the code. Proposed: `ADR-044 — per-article authored CSS`,
  superseding nothing, recording the scope-prefix + sanitizer + feature flag as
  the conditions of acceptance.
- **No ADR needed for PRs 1–6 and 8.** They add fields and screens inside
  Module 15's existing shape: no new permission key, no new cache tag (all of
  it invalidates under `content`), no change to the frozen visibility rule or
  transition map, no architectural boundary crossed.
- `.claude/skills/articles/SKILL.md` gets: the new fields, `saveArticle` as the
  editor's write path, `ContentRelation` as the related-posts home, and FAQ's
  place in the ADR-009 sanitize pipeline.
- `claude.md`'s module table: Module 15's note updated once PR 8 lands.
- DEVLOG entry per PR, append-only.

---

## 9. Risks

1. **`saveArticle` is a bigger transaction than anything in Module 15 today.**
   Meta + translation + FAQ replace + relation replace in one `$transaction` is
   correct but must not silently swallow a partial failure — criterion 5 exists
   for exactly that. Keep the two existing single-purpose services exported so
   the transaction is a _composition_, not a rewrite.
2. **The editor split is a 621-line refactor touching every field at once.**
   PR 4 ships the split with the panels it introduces and criterion 12 as the
   net — a field going missing fails in CI, not in review.
3. **Per-locale FAQ vs. the reference's single-locale model.** A translator
   adding a locale gets an empty FAQ list, not a copy. That is the correct
   behaviour (FAQ text is translatable prose) but is a real difference from the
   reference, worth stating up front rather than discovering.
4. **Custom CSS.** See #36 — the security surface and the philosophy conflict
   are both real. Recommendation: ship without it and revisit deliberately.
5. **Keyword density is advisory.** The reference presents its percentages as
   authoritative SEO guidance. They are a hint, not a gate — nothing in the save
   path may block on them.
6. **Featured articles have no public consumer yet.** `isFeatured` is
   admin-settable from PR 2, but the public strip that reads it is a
   homepage/listing decision under the ADR-038 philosophy (built in code, when
   that module wants it). PR 8 surfaces it in the list and the editor; it does
   not invent a public section.

---

## 10. Standing inventory after ADR-042 (dynamic site-control cancelled)

Added 2026-09-07. The owner cancelled the dynamic site-control programme
(ADR-042, superseding the ADR-037/038 pauses). This section records what the
platform actually has now, so this plan can be executed without reading a
cancelled plan — and so nothing reusable gets rebuilt from scratch.

### 10.1 What is live and admin-managed (content data — the dynamic half)

| Area                                        | Admin surface                                           | Service                                    |
| ------------------------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| News & Analysis articles                    | `/admin/articles` + `[id]` + categories + tags          | `core/src/articles.ts`                     |
| Glossary                                    | `/admin/glossary`                                       | `core/src/content.ts`                      |
| Media (upload, browse, reuse)               | `/admin/media` (standalone since 2026-09-06)            | `core/src/media.ts`, `storeImage()`        |
| Users / roles / employees                   | `/admin/users`, `/admin/roles`, `/admin/employees`      | `core/src/{users,roles,employees}.ts`      |
| Settings + feature flags                    | `/admin/settings/*` (minus `layout`), `/admin/features` | `@repo/settings`                           |
| Branding, colours, modes, presets, logos    | `/admin/theme` (4 tabs — no Layout & Display)           | `@repo/theme`                              |
| Social links, notifications, profile, audit | `/admin/social`, `/admin/profile`, …                    | `core/src/{social-links,notifications}.ts` |
| Market data                                 | Module 13 surfaces                                      | `core/src/market.ts`                       |

### 10.2 What is retained but unreachable (cancelled, not deleted)

Nothing here may be deleted without a further ADR (ADR-042 Decision #2).

| Thing                       | Size / location                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Block library               | 34 blocks — `packages/blocks/src/*`                                                                           |
| CMS services                | ~30 files — `packages/core/src/cms/*`                                                                         |
| CMS contracts               | `packages/contracts/src/cms/*`                                                                                |
| CMS models                  | `Page`, `PageTranslation`, `PageVersion`, `StylePreset`, `CardTemplate`, `LayoutTemplate`, `ContentReference` |
| Admin routes                | `/admin/website/{pages,templates,styles,cards,media,redirects}` — hidden by one constant                      |
| Permissions                 | 9 × `cms.*` + `redirects.manage` — seeded, not revoked                                                        |
| Structural-design admin UIs | `/admin/navigation`, `/admin/homepage`, `/admin/settings/layout`, theme Layout & Display tab                  |

**Two things in that neighbourhood are NOT cancelled and must never be swept
up in a future cleanup:**

- **`Redirect`** — Module 15 writes 301 rows on every article/category/tag
  slug change, and the public article routes read them. This plan's PR 3
  (`quickUpdateArticle`) depends on it; criterion 11 pins it.
- **`Menu`/`MenuItem` + `buildNavigation`** — the public header/footer still
  render from these rows. Only the admin _reorder screen_ is cancelled; the
  runtime is Module 08 and is live.

### 10.3 Harvestable from the cancelled tree

Reuse rather than rebuild. Each of these is working, tested code this plan's
PRs can borrow from without reviving anything:

| Need in this plan              | Existing code                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FAQ UI + shape (PR 6)          | `packages/blocks/src/faq/` — an `Accordion`-based renderer and a `{question, answer}[]` Zod schema already capped at 20 items, matching §4.1's `articleFaqItemSchema` almost exactly. Borrow the shape; the article version is DB-backed rather than authored JSON. |
| FAQ JSON-LD (PR 8)             | `packages/core/src/cms/seo.ts` — a working JSON-LD builder with its own `seo.test.ts`.                                                                                                                                                                              |
| SEO checks (PR 1/5)            | the same file's SEO-suggestion work (plan v2.2 PR 3.6) — the rule set §4.4 specifies overlaps with it.                                                                                                                                                              |
| Related-posts card UI (PR 6/8) | `packages/blocks/src/{card,featured-content,collection}/` — card layouts already built against `@repo/ui`.                                                                                                                                                          |
| Media picker (PR 6)            | `admin/_components/media-library.tsx` — already relocated out of the cancelled tree on 2026-09-06.                                                                                                                                                                  |

Two claims worth restating from §2.2, because they are _not_ revivals:

- **`ContentRelation` (related posts, #19)** was in the schema and wired by
  **zero** services — the CMS never used it. Claiming it here is reuse of dead
  schema, not a resurrection of cancelled work.
- **Category/tag `articleCount` (#10)** is already computed by the Module 15
  loaders and discarded by the editor page. Free.

### 10.4 Open decisions carried by ADR-042

These are the owner's, not this plan's. Listed here because two of them change
what PR 8 renders.

1. ~~**Do `/` and `/news` flip back to code rendering?**~~ **DECIDED and SHIPPED
   2026-09-07 as PR 0** (owner: "execute"). `renderCmsHome()` and
   `renderCmsNews()` are removed from `(public)/[locale]/page.tsx` and
   `news/page.tsx`; both routes render from `_sections/registry.ts` and the
   coded listing again. `page.tsx`'s own comment had recorded that the
   published CMS home carried _fewer_ sections than the coded fallback
   (`latest_analysis`/`glossary_spotlight` were slated for a Phase 4 that never
   landed), so the flip restored sections rather than losing them.
   **Deviation from what this section originally proposed:** `seed.ts` is
   **not** changed. The plan said "stop seeding the published pages", but
   ADR-042 Decision #2 retains seeded rows, and with the resolvers gone the
   rows are inert either way — so the app-side removal alone achieves the
   outcome without a data change to a cancelled feature.
2. **`[...slug]` has no code fallback** — it is a pure CMS route, and PR 0 left
   it alone deliberately: unlike `/` and `/news` it was never competing with a
   coded path, so removing it is deletion of retained code (ADR-042 Decision
   #2), not a flip. It resolves whatever CMS pages exist and 404s otherwise.
   Whether it is eventually removed rides on open decision 3.
3. **Is the retained CMS code ever physically removed?** ADR-042 says no for
   now. If that changes it is a 10-model migration + a permission-seed change +
   deleting `@repo/blocks` — its own ADR, and it must exclude `Redirect`.
4. **Custom CSS (§2.4 #36)** — still needs `ADR-044` and a sign-off. ADR-042
   makes it _harder_ to justify, not easier: per-post authored CSS is
   admin-configurable design, precisely what the cancellation settled against.
   The recommendation is now firmly to drop PR 7.

### 10.5 Effect on this plan

None of PRs 1–6 or 8 depends on anything cancelled. The article editor is
content-data work — the half of the platform ADR-042 explicitly keeps dynamic
— so this plan survives the cancellation intact, except that:

- PR 7 (Custom CSS) is now recommended **out**, not merely gated (§10.4 #4).
- PR 8's public rendering targets the **coded** news routes. PR 0 (§10.4 #1)
  shipped 2026-09-07 and is the prerequisite that makes this unambiguous —
  `app/(public)/[locale]/news/[slug]/page.tsx` and the `/news` listing are now
  the only rendering path, so PR 8 has one place to add the header image, FAQ
  JSON-LD, related strip and `noFollow`/OG metadata rather than two.
- §5's panels should borrow from §10.3 rather than starting from blank files.

### 10.6 PR 0 — shipped 2026-09-07

| File                                       | Change                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/(public)/[locale]/page.tsx`           | `renderCmsHome()` and its call removed; `generateMetadata` removed (its only job was CMS-page SEO, else `{}` — the layout supplies title/description/favicon); `searchParams` prop dropped; 6 now-unused imports removed |
| `app/(public)/[locale]/news/page.tsx`      | `renderCmsNews()` and its call removed; 6 now-unused imports removed (`draftMode`, `layoutTreeSchema`, `resolveCollectionPage`, `renderTree`, `buildRenderContext`, `flattenSearchParams`)                               |
| `app/(public)/[locale]/[...slug]/page.tsx` | untouched — still the sole consumer of `_cms/render-context.ts`, which is why that helper stays                                                                                                                          |
| `packages/db/prisma/seed.ts`               | untouched — see §10.4 #1's deviation note                                                                                                                                                                                |

Verification: `tsc --noEmit` (web) clean · `eslint` on both files clean ·
`prettier --check` clean · `vitest run` (web) 32/32 · `next build` clean.
No test asserted CMS-first rendering, so none needed changing — confirmed by
grepping `renderCmsHome|renderCmsNews|resolveCollectionPage` across all
`.ts`/`.tsx`, which returned only these two files and the service definition.
