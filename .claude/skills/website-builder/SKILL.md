# SKILL — Module 16: Website Builder (CMS)

> **CANCELLED (ADR-042, 2026-09-07 — supersedes the ADR-037 pause).** This
> module is withdrawn, not paused: there is no resume path and no further
> development is to be planned or performed. The admin UI stays hidden
> (`WEBSITE_BUILDER_ADMIN_UI_ENABLED = false` in `admin-shell.tsx`); the
> code, models, seeded rows, permissions and public rendering are all
> **retained and must not be deleted** — removing any of it requires its
> own ADR.
>
> **Everything below this banner is historical record, not instruction.**
> It accurately describes code that exists and decisions that were made
> (ADR-020…036, which are _not_ reversed). It is not a specification to
> build against. Read ADR-042 before acting on anything in this file.
>
> Two things in here are still live dependencies of other modules and must
> not be swept up in any future cleanup: `Redirect` (Module 15 writes 301
> rows on every article/category/tag slug change) and the media pipeline
> (now reached via the standalone `/admin/media` screen). And note ADR-042
> Finding #1: `/` and `/news` still render from published `PageVersion`
> rows today.

`docs/MBX-Dynamic-Site-Control-Plan-v2.md` (v2.2) was the plan — §12 has
the per-PR checklists, §18 the ADR → touchpoint index. ADR-020…036 were
the binding decisions; as of ADR-042 they are history and bind nothing
forward. The principle every rule below served: _CMS = presentation + composition +
publishing · Providers = content/data · Widgets = interactive features ·
Feature modules = business logic · UI library = visual primitives · Media
library = reusable assets · Templates/presets = reusable design._
`docs/MBX-Dynamic-Site-Controle-Plan.md` (v1) is superseded history: do not
implement from it. Repo facts that shaped v2 are in
`docs/cms/00-reconciliation.md`.

## The one-sentence model

An admin designs a **page** per shape (STATIC / COLLECTION / DETAIL / PART;
DATA reserved) out of registry **blocks**; content-bearing blocks store a
_query_, not content; a **provider** resolves it from services that already
exist; interactive features arrive as **widgets** from feature packages
through one generic block; every link is a **`LinkTarget`**; cards and
styles are **linked** references, templates are **start-from** copies; the
layout is versioned JSON, published by pointer swap, invalidated by tag.

## Where things live (ADR-020 — frozen)

| Concern                                                                                          | Home                                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Registry, `renderTree`, block renderers, the generic `widget` block                              | `packages/blocks` — **the only new CMS package**; `/definitions` subpath is pure                                                          |
| Feature widgets (calculators, market, forms, …)                                                  | `packages/widgets` (granular exports, pure `/definition` subpaths) or `packages/widgets-<name>` — **feature packages, not CMS** (ADR-030) |
| Page/version/template/style/card services, providers, `links.ts`, `references.ts`                | `packages/core/src/cms/*`                                                                                                                 |
| `storeMedia()`, replace, guarded delete                                                          | `packages/core/src/media.ts` (ADR-034)                                                                                                    |
| Layout + node envelope, style/responsive/`LinkTarget`/widget contracts, reserved paths           | `packages/contracts/src/cms/*`                                                                                                            |
| Registry assembly (providers + widgets + bound actions)                                          | `apps/web/app/_cms/registry.ts`                                                                                                           |
| Composer / admin screens (Overview, Pages, Templates, Styles, Cards, Media, Redirects, Settings) | `apps/web/app/(admin)/admin/website/*`                                                                                                    |
| Public rendering                                                                                 | `(public)/[locale]/[[...slug]]` + existing content routes                                                                                 |

**`@repo/blocks` and every widget package must never import `@repo/db` or
`@repo/core`.** Providers, widgets and bound actions are injected into
`renderTree`. A test renders every fixture with no database in the import
graph; if that breaks, the boundary broke.

Do **not** create `packages/cms`, `packages/media`, `packages/access`,
`packages/renderer`, `packages/page-builder` or `packages/content-adapters`.
Every one of them duplicates something shipped — the table is in ADR-020.

## Frozen behaviours

1. **Styling is token choices only** (ADR-024). No hex, no arbitrary
   classes, no inline `style` from authored data, no per-block dark values.
   A block schema that accepts `/^#[0-9a-f]{3,8}$/i` fails a test.
2. **Motion is a bounded enum** over the shipped `Reveal`/`Counter`/
   `Marquee` components (ADR-018). There is no effect-preset table.
3. **Interactive colours stay derived** (ADR-003). Never author a hover
   value anywhere, including in block props.
4. **A provider composes the owning service's visibility rule.** For
   articles that means `publicArticleWhere()` (ADR-015) — never a new
   `where` clause. Premium filtering is server-side and part of the cache
   key (ADR-012, ADR-025).
5. **Filters bind by `bindingId` + URL search params** (ADR-022 §4). No
   React context between blocks, no client-side filtering of a pre-fetched
   list. Params are parsed by a schema derived from the provider's
   descriptors; unknown keys are dropped, `limit ≤ 24`, `page ≤ 200`.
6. **Card designs are references, not copies** (ADR-023). A block stores
   `cardTemplateId`. A missing reference falls back to the seeded system
   template and logs — it never throws.
7. **Cache tags** (ADR-025/029/033): `page:{id}`, `page-path:{locale}:{path}`,
   `layout:{contentType}`, `card-template:{id}`, `style-preset:{id}`,
   `part-data:{partKey}`, plus the existing `content` for provider reads
   and page-link resolution. `revalidateTag(tag, { expire: 0 })`.
   Never `revalidatePath`, never `export const revalidate`.
8. **`path` is stored without a locale prefix** (`localePrefix:
"as-needed"`); the prefix is applied at read time.
9. **No `custom-html` block.** Adding one takes its own ADR, the
   `cms.blocks.custom_html` permission and an XSS corpus test.
10. **No editor library type** in a schema, service, column or renderer
    (ADR-026). Puck is a candidate until its spike ADR says otherwise.
11. **Site parts are `PART` pages**, presets are `LayoutTemplate{PART}`
    rows applied by copy (ADR-027 as amended by ADR-033), shell behaviours
    are bounded enums. Menu hrefs resolve at render through the shared
    `LinkTarget` resolver and missing targets are pruned, never rendered
    as dead links (ADR-028, ADR-031).
12. **Blocks never fetch during render** (ADR-029). They declare a
    `BlockDataNeed`; the renderer collects, dedupes and resolves in a
    second pass — **grouped** (one cached call, one batched round trip) for
    parts, **per-need** for param-driven page collections. A global part
    must never issue an uncached query; the warm-cache render of `/about`
    counts zero provider calls from the shell, and there is a test that
    says so.
13. **Part data is tagged `part-data:{key}`, never `content`** — an article
    publish must not invalidate the site shell. The staleness window
    (`cacheLife`, default 5 min) is shown in the admin UI, and republishing
    the part refreshes immediately.
14. **No limit lives in the schema or the layout JSON.** `cms.dataBudget`
    is a setting with warn/block thresholds. If you find yourself writing a
    cap into a Zod schema or a Prisma column, that is the bug. Budgets are
    **measured guardrails** — raising one needs a Lighthouse number in the
    DEVLOG, not an opinion.
15. **The composer ships with the `MediaLibrary`** (ADR-034) — upload for
    image / video / audio / document via `storeMedia()`, folders, search,
    metadata, usage, replace, guarded delete — in Phase 3's own scope, and
    the picker _is_ that component in select mode. There is no "minimum
    picker". Embedded video is a `video`-block source, never an asset,
    never a background.
16. **A new feature never edits the CMS** (ADR-030). It ships a
    `WidgetDefinition` (pure `/definition` subpath) + `WidgetRuntime`
    (`Render`, `Skeleton`, `Empty`/`Error`), one line in
    `apps/web/app/_cms/registry.ts`, a page seed and a menu item. Inputs
    that feed a computation or submission belong to the widget; the CMS
    never owns calculation or form logic. A `variant` switch over feature
    keys inside `@repo/blocks` is the bug. `data-widget` is not built;
    `PageKind.DATA` is unused in MVP.
17. **Internal links are never free text** (ADR-031). Every link prop is a
    `LinkTarget`, resolved at render by the one resolver menus also use,
    batched per type, through the providers. `missing` / `unpublished` /
    `forbidden` → menus prune, blocks render the non-link variant. Page
    links are per-need reads tagged `content`, never inside `page:{id}`.
18. **The node envelope is ADR-032's**: `label`, `hidden`, `anchor`,
    `style {presetId, overrides}`, `motion`, `visibility`, `responsive`
    (three fixed breakpoints, declared props only, `hiddenOn`). Backgrounds
    are token / gradient (two brand tokens) / image / self-hosted video —
    **image or video + text requires an overlay** (publish gate) and video
    requires a poster. **Enum → class is a literal lookup table**; a
    template literal in `className` under `packages/blocks` fails lint.
    `/definitions` imports no `react-dom` and no `@repo/ui`.
19. **Reuse is _Linked_ or _Start from_** (ADR-033). `CardTemplate`,
    `StylePreset`, parts = linked (edit once, all placements follow);
    `LayoutTemplate{PAGE|SECTION|BLOCK|PART}` = start from (an honest
    copy). Every reuse action carries one of the two verbs; linked nodes
    show the badge. Do not add a third preset entity.
20. **Every save syncs references.** `syncReferences()` writes
    `ContentReference` rows for media, cards, styles, widgets, parts and
    `LinkTarget`s; deletion guards, usage counts, broken-link and
    missing-media reports read those rows — never a scan of layouts.
21. **The draft is mutable in place; publish snapshots.** `PageVersion.
revision` is the optimistic lock; gates run on autosave into
    `gateResult`; history is publishes, not keystrokes.
22. **Paths are derived, never typed** (plan §5.1). `path = parent's
same-locale path + "/" + slug`; a child cannot be translated into a
    locale its parent lacks; the subtree is recomputed per locale in the
    same transaction; a changed published path writes a `Redirect` and
    deactivates any redirect that now shadows a live path. STATIC paths
    never start with a reserved segment (`check:reserved-paths`);
    COLLECTION paths equal their hosting route (`CONTENT_ROUTES`); `tools`
    is a CMS page, not a reserved prefix.
23. **Pre-launch data policy** (plan §5.2): databases are reset (`pnpm
db:reset`), no backfill scripts — column defaults or one SQL statement
    inside the generated migration carry any "backfill" an ADR mentions.
    Migrations are still real `prisma migrate dev` migrations. The policy
    ends at the DEVLOG entry that records the first production deploy.

## Global site layer (ADR-027 / ADR-028)

Header, footer, announcement, top bar, mobile nav and mega-menu panels are
**`PART` pages** (`PageKind` gains `PART`) with reserved keys — `header`,
`footer`, `announcement`, `topbar`, `mobile-nav`, `menu-panel:{slug}`. They
get versioning, publish, rollback, translations and the publish gates from
`Page`; there is **no `SitePart` model and no `CmsTemplate`**.

- **Shell behaviour is bounded root props**, never CSS: `mode`
  (solid / transparent / transparent-to-solid / floating), `position`,
  `height`, `border`, `menuHover`, `dropdown`, `mobileMenu`.
  `transparent-to-solid` is **one** client leaf flipping `data-scrolled`
  from an IntersectionObserver sentinel — not a scroll listener, not a
  per-site animation, reduced-motion gated.
- **Presets are `LayoutTemplate{kind: PART}` rows (ADR-033).** "Apply
  preset" copies one into the draft, so it previews and rolls back like
  anything else — _Start from_ semantics, stated in the UI.
- **Per-page override:** `page.headerPartId ?? settings default ?? shipped
component`. All three paths are tested.
- **Panels are layouts, not menu data** — that is how the reference
  header's live News column is a `collection` block. Link nesting stays
  **≤ 2 levels**; a panel is not a third level.
- **Panels may hold several collections** (News + Courses is a legitimate
  design). What makes it safe is ADR-029's grouped resolution and
  `part-data:{key}` tagging — **not** a cap. The budget
  (`cms.dataBudget`, a setting) warns then blocks; it is policy, and a
  raise needs a measurement in the DEVLOG.
- **Menu items** carry `linkType` (ROUTE / URL / PAGE / ARTICLE /
  ARTICLE_CATEGORY / ARTICLE_TAG / COURSE / GLOSSARY_TERM / DYNAMIC / NONE),
  hrefs **resolved at render** (never stored), dynamic children capped at 8
  and filtered by the content type's own visibility rule, allow-listed
  preset icons, bounded badge keys, optional `panelPartKey`. Batch entity
  resolution one read per type.
- **Wrap, don't rewrite:** `SiteHeader`, `SiteFooter`, `AnnouncementBar`,
  `TopBar`, `MobileNav` stay as the fallback. Parts are seeded _from_ the
  current settings values so the first publish is identical by
  construction; the fallback goes only after snapshot parity at 1440/390,
  both modes, both directions.

## The admin vocabulary is not the model's vocabulary (binding UI rule)

`PageKind`, `contentType`, `provider`, `bindingId` and `CollectionProvider`
**never appear on screen**. Admins see _Page Designs → News Detail Design_,
_Card Designs_, _Global → Header_, and a settings panel that asks
**"What should this show?"** with plain dropdowns (News · Latest · 6 ·
3 columns · Modern News Card). `bindingId` is generated and hidden; a filter
auto-binds to the only collection on a page and asks "which grid?" only when
there are two. Block categories are labelled by behaviour — _content you
type_ / _content that fills itself_ / _this item's details_ (detail designs
only) / _live data_ — because collection-vs-current-item is the distinction
non-technical admins reliably get wrong. Plan v2 §8.1 has the mapping table.

## The four golden tests (plan v2 §12, §17)

GT1 News (Phases 4–5) · **GT2 Course (Phase 5, inside MVP)** · GT3 a
DataProvider through a widget's `needs` (Phase 7) · **GT4 a Widget — the
Pip Calculator** (Phase 7; contract in Phase 2). GT2 and GT4 are the real
ones: adding courses must be **provider + descriptors + card template +
page seeds, and nothing else**; adding a calculator must be **a widget
export + one registry line + a page seed + a menu item, and nothing else**.
If either diff contains a new block, a contract change or a builder change,
the ADR-022 / ADR-030 contract is wrong — stop and fix it. The plan's §17
runs the same question over thirteen page types.

## Every block — and every widget — ships with

Zod schema · `defaults` · `version` (+ `migrate` when bumped) · server
renderer (no `"use client"` at the root) · editor field metadata · a JSON
fixture · a render test in light **and** dark · an entry in the axe fixture
page (`scripts/check-block-fixtures.mjs` fails if it is missing) ·
`labelKey` from a catalog, never a literal string. Widgets add `Skeleton`
(always) and `Empty`/`Error` (when they have `needs` or `actions`); link
props are `LinkTarget`; responsive props are declared, not implied.

## Publish gates (ADR-024 §4 + ADR-029 §5 + ADR-032 §2)

**Block:** layout schema invalid · heading level skipped · a `bindingId` no
collection block provides · a missing `cardTemplateId` or `style.presetId`
· an image/video background with text and no overlay · a `LinkTarget`
typed as a relative internal URL · data budget over its **block**
threshold (collections, items, video backgrounds; widget `needs` count).
**Warn (publishes anyway):** data budget over its **warn** threshold ·
translatable props empty in a published locale · duplicate anchors ·
nesting depth > 3.

Gates run on **autosave** too (into `PageVersion.gateResult`) so the
composer and the Overview show failures before publish. Errors name the
offending block id — an unnamed refusal is a bug report waiting to happen.
Budget thresholds come from `cms.dataBudget`, not from constants in the
gate code. The only fixed numbers are the **request-side** caps on
URL-derived params (`limit ≤ 24`, `page ≤ 200`) — input validation in the
search-param schema, not design policy.

## Mutation checklist

`requirePermission("cms.*" | "media.*" | "redirects.manage")` first line →
parse input with `@repo/contracts` → call the `@repo/core/cms` service →
`syncReferences()` for anything that holds a layout, a media id or a
`LinkTarget` → `recordAudit()` → revalidate the ADR-025/029/033 tags.
Permission keys are seeded in the same PR (`pnpm check:permission-keys`).
Part publish uses `cms.parts.publish`, not `cms.pages.publish`. The
redirects screen reuses the seeded `redirects.manage` — there is no
`cms.redirects.manage`; `media.view` / `media.update` are seeded in Phase
3 (only `media.upload` / `media.delete` exist today).

## Working with the shipped News surface

Module 15 is locked (ADR-015). **Wrap, do not rewrite.** `ArticleCards`,
`ArticleSidebar`, `ListingHeader`, `NumberedPagination` and `ShareRow`
become block renderers as-is. `/news` and `/news/[slug]` keep their route
files and gain a CMS path behind a fallback switch. Before and after
snapshots at **1440 and 390** — the widths the 2026-09-04 DEVLOG entry
verified after a container-query bug that a build-only check missed.

## Definition of done, per phase

Acceptance criteria in the plan demonstrated · `lint`, `typecheck`, `test`,
`build` green · `governance:check`, `check-permission-keys`,
`check-phantom-deps`, `check-catalog-completeness`, `check-block-fixtures`
green · coverage ≥ 90% in `@repo/blocks`, ≥ 80% in `core/cms` · a DEVLOG
entry with real test results and anything left unverified stated plainly.
