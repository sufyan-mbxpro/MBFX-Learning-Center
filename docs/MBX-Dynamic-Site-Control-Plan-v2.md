# MBX Learning Center — Website Builder (CMS)

## Execution Plan v2.2 — 5 Sep 2026 · Module 16

**Supersedes** `docs/MBX-Dynamic-Site-Controle-Plan.md` (v1.0), which was
written without access to this repository. v1 is retained as history; where
this document and v1 disagree, **this document wins**.

**Inputs reconciled:** v1.0 · the "design once, publish many" critique
(`docs/changes/review-dynamic-site-paln.md`) · the repository as it stands
at 2026-09-04 (`docs/cms/00-reconciliation.md`) · `docs/plan.md` Parts D–F ·
ADR-001 … ADR-019.

**Binding decisions:** ADR-020 (package boundaries) · ADR-021 (page model) ·
ADR-022 (provider registry) · ADR-023 (card templates) · ADR-024 (authored
styling + gates) · ADR-025 (cache tags) · ADR-026 (editor sequencing) ·
ADR-027 (global site parts) · ADR-028 (menu items) · ADR-029 (dynamic data
resolution & budgets) · **v2.1:** ADR-030 (widget registry) · ADR-031 (link
targets) · ADR-032 (node schema v1 + page-model amendments) · ADR-033
(reuse model: linked vs start-from, `ContentReference`) · ADR-034 (media v2).
Read those before this plan's detail sections; they carry the reasoning and
the rejected alternatives.

**Reviews:** v1 → v2.0: `docs/changes/dynamic-site-plan-review.md`.
v2.0 → v2.1: `docs/changes/dynamic-site-plan-v2-review.md` (the owner's
admin-UX / presets / future-tools review, accepted 2026-09-04 as the
amendment checklist; §3.1 below lists what it changed).
v2.1 → v2.2 (2026-09-05): executability pass — no architecture change.
Phase 1 became a PR-level checklist (§12), every later phase gained a PR
breakdown, path derivation is specified with locale examples (§5.1), the
pre-launch data policy is written down (§5.2 — reset, no backfill), and §18
maps every ADR to its schema / service / app / seed / test touchpoints.
§3.2 lists the corrections that fell out of writing it against the code.

**The principle every section serves:** _CMS = presentation + composition +
publishing · Providers = content/data · Widgets = interactive features ·
Feature modules = business logic · UI library = reusable visual primitives ·
Media library = reusable assets · Templates/presets = reusable design._

---

## 0. Reading guide

| §   | Purpose                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------ |
| 1   | The one-paragraph shape of the system                                                                        |
| 2   | Locked decisions (one line each)                                                                             |
| 3   | What changed from v1, and why                                                                                |
| 4   | Architecture & where every piece lives                                                                       |
| 5   | Data model — 5.1 path derivation (nested paths per locale) · 5.2 pre-launch data policy (reset, no backfill) |
| 6   | Blocks & providers                                                                                           |
| 7   | Renderer, routing, caching                                                                                   |
| 8   | Admin surface & editing — 8.1 admin vocabulary · 8.2 information architecture · 8.3 overview & reports       |
| 8b  | Global site layer — header, footer, menus, announcement                                                      |
| 9   | SEO · multilingual · media · access                                                                          |
| 10  | Publishing workflow                                                                                          |
| 11  | Security                                                                                                     |
| 12  | Phases with acceptance criteria — Phase 1 as a PR checklist, Phases 2–8 with PR breakdowns                   |
| 13  | Testing & the gates that must learn to see authored content                                                  |
| 14  | Risks                                                                                                        |
| 15  | Deferred — but scheduled                                                                                     |
| 16  | Hand-off rules                                                                                               |
| 17  | Architecture test (13 cases) and the final acceptance criteria                                               |
| 18  | ADR → implementation touchpoint index                                                                        |

---

## 1. The system in one paragraph

An admin designs a **page** once per shape — a static page, a listing, a
detail template, a data page — by composing **blocks** from a closed
registry. Blocks that show content carry a **query configuration**, not
content; they name a **content type**, and a **provider** resolves that into
items at render time using the services that already exist. Blocks that show
a single item read from the **context** the route supplies. Cards inside
collections reference a shared **card template**, so a card is designed once
and every placement follows. The layout is a validated JSON tree, versioned,
translatable per locale, published by pointer swap, and invalidated by tag.
Content authors go on using the module screens they already have; publishing
an article changes nothing about the design and requires no page edit.
Interactive features — calculators, market tools, forms, future trading
tools — reach a page through a **widget** registry: the feature owns the
inputs, the logic and the states, the CMS owns where it sits and how it is
framed, and adding one never touches the CMS (ADR-030). Every link on the
site is a **`LinkTarget`** resolved at render, so slugs can change and
targets can unpublish without a dead link anywhere (ADR-031). Reuse is
either **linked** (card designs, style presets, parts) or **start from** (a
copied template) — never a third thing (ADR-033).

## 2. Locked decisions

**Platform**

- One Next.js app, two route groups (ADR-006). No `apps/admin`.
- **One new package: `@repo/blocks`** (registry + renderer + block
  renderers). Everything else extends `@repo/core`, `@repo/ui`,
  `@repo/theme`, `@repo/contracts`, `@repo/rbac`, `@repo/settings` —
  **ADR-020**. Down from v1's eight new packages.
- CMS services live in `@repo/core/src/cms/*`; only `@repo/core` touches
  Prisma (architecture.md #8).
- Editor client code lives in `apps/web/app/(admin)/admin/website/`, the
  same place Tiptap already lives — **ADR-026**.

**Model**

- `Page` + `PageTranslation` + `PageVersion` + `CardTemplate`. Four models,
  no `Cms*` prefix. Fills the `Page` gap `plan.md` A7 already named —
  **ADR-021**.
- One taxonomy: `PageKind = STATIC | COLLECTION | DETAIL | DATA | PART`
  (`PART` added by **ADR-027** for the global site layer).
- Layout is `Json`, Zod-validated on every read and write; block-level
  translations live inside the node; page-level title/slug/SEO are
  relational because routing queries them.
- Reused, never duplicated: `AuditLog`/`recordAudit()`, `Redirect`,
  `MediaAsset`/`storeImage()`, `Theme`/`BrandAsset`, `FeatureFlag`/
  `FeatureVisibility`, `Menu`/`MenuItem`, `ContentStatus`,
  `TranslationStatus`.

**Content ↔ design**

- Two provider interfaces: `CollectionProvider` (content-shaped, listable,
  filterable) and `DataProvider` (rates, calendar, converter) — **ADR-022**.
- Collection, filter, search, sort, pagination and related-content blocks
  are **generic and provider-driven**. There is no `news-filter-bar`.
- Filter↔grid binding is a `bindingId` plus the URL; search params are the
  only state, parsed by a schema derived from the provider's descriptors.
- Card designs are `CardTemplate` rows referenced by id — edit once, every
  placement updates — **ADR-023**.

**Features & links**

- A third registry, **`Widget`**, beside the two provider interfaces. One
  generic `widget` block dispatches by `widgetKey`; definitions (schema,
  fields, needs, actions, access) and runtimes (Render, Skeleton, Empty,
  Error) live in **feature packages** (`@repo/widgets/*`), never in
  `@repo/blocks`, and are assembled once in `apps/web` — **ADR-030**.
  `data-widget` is not built; `PageKind.DATA` is reserved for
  route-param-driven data pages and unused in MVP.
- Inputs that participate in a computation or a submission belong to the
  widget, built from `@repo/ui`; the CMS never owns calculation or form
  logic and never ships a visual form builder without its own ADR.
- **Every authored link is a `LinkTarget`** (page / article / category /
  tag / course / glossary term / file / anchor / route / external URL),
  resolved at render through one batched resolver shared with menus —
  **ADR-031**. Internal paths are never free text; a missing, unpublished
  or forbidden target renders the non-link variant, never a dead link.

**Design control**

- Authored styling is **token choices only**: no hex, no arbitrary classes,
  no inline style from data. Motion is a bounded enum over the shipped
  `Reveal`/`Counter`/`Marquee` components — **ADR-024**, preserving ADR-003
  (derived interactive colours), ADR-008 (user-controlled mode), ADR-018
  (CSS-first motion) and the contrast contract test.
- The style vocabulary is complete, still token-only — **ADR-032**:
  backgrounds as token · gradient (two brand tokens + direction) · image ·
  self-hosted video, each with a **mandatory overlay** when text sits on
  imagery (a publish gate, contrast-tested); `textTone`, `padding`, `gap`,
  `radius`, `shadow`, `border`, `width`. Every node carries `label`,
  `hidden`, `anchor`, `style {presetId, overrides}`, `motion`,
  `visibility`, and **bounded responsive values** over three fixed
  breakpoints (375/768/1440) for a declared prop set plus `hiddenOn`.
  Enum → class is always a literal lookup table (Tailwind v4 scans source).
- **Reuse has two semantics and two words** — **ADR-033**: _Linked_
  (`CardTemplate`, `StylePreset`, parts; edit once, every placement
  follows) and _Start from_ (`LayoutTemplate` — page / section / block /
  part; an honest copy). No other preset entity exists; "effect presets",
  "button presets", "calculator presets" are a `StylePreset` or a
  `LayoutTemplate`. One `ContentReference` table, written on save, serves
  usage counts, deletion guards, broken-link and missing-media reports.
- **Media is one reusable system** — **ADR-034**: `storeMedia()` for image
  / video / audio / document (magic bytes, per-kind caps as settings,
  Range serving), `MediaAsset.kind/title/altText/folder/tags/poster`,
  replace-in-place, usage-guarded soft delete, and **one `MediaLibrary`
  component** that is both the admin screen and the composer's picker.
  Embedded video is an allow-listed source of the `video` block, never an
  asset and never a background.
- The quality gates are extended to render authored fixtures, and page-level
  checks (heading order, block budget) **block publish**.

**Runtime**

- Cache Components only (ADR-004). New tags `page:{id}`,
  `page-path:{locale}:{path}`, `layout:{contentType}`, `card-template:{id}`,
  `part-data:{partKey}`; page provider reads keep the coarse `content` tag —
  **ADR-025**, **ADR-029**.
- Public routes stay static shells; filtered collection reads are cached by
  normalised query **including the visibility tier**.
- **Rendering is two-pass** (ADR-029): collect every block's declared data
  need → normalise and dedupe → resolve (grouped for parts, per-need for
  param-driven collections) → render. Blocks never fetch during render.
- **A global site part never issues an uncached query** — asserted by a
  warm-cache render test that counts provider calls from the shell.
- **Limits are budgets, not architecture.** No cap lives in the schema or
  the layout JSON; `cms.dataBudget` is a setting with warn/block thresholds,
  shown as a meter in the composer, raised by measurement.

**Editor**

- Renderer first, canvas second. A form-based composer built from shipped
  primitives ships in Phase 3; Puck is evaluated in a 2-day spike and
  adopted only if it passes the gate list in **ADR-026**. No editor type
  ever appears in a schema, service or column.
- **The composer is complete on its own terms** (§8): tree/layers panel,
  block search + recently used, add/remove/reorder/duplicate, copy/paste,
  undo/redo, hide/label/anchor, responsive controls, style presets and
  "start from" templates, versions panel with restore-as-draft, a
  translations tab, gate results on autosave, a data/budget panel. Inline
  canvas editing is **not** required; a canvas, if adopted, replaces the
  editing surface only.

**Global site**

- Header, footer, announcement bar, top bar, mobile nav and mega-menu panels
  are `PART` pages — versioned, previewable, publishable, rollback-able like
  any other page — **ADR-027**. Presets are seeded part versions, not a
  model. Shell behaviours (transparent → solid on scroll, sticky, height,
  menu hover, dropdown animation, mobile menu mode) are bounded enums.
- **Global default + per-page override**: `Page.headerPartId` /
  `footerPartId` / `announcementPartId`, null → the site default. Homepage
  transparent, news solid, campaign page with its own announcement.
- Menu items get polymorphic entity targets, dynamic children and panel
  references — **ADR-028**. Hrefs resolve at render, so a slug change never
  breaks a menu and an unpublished target is pruned, not 404'd.
- The shipped `SiteHeader`/`SiteFooter` are the **fallback path**, seeded
  from today's settings so the first publish is identical by construction.

**Scope**

- **MVP = Phases 1–6.** Phase 6 (Global Website & Navigation Builder) is a
  module in its own right, not a polish pass — size it accordingly.
- Post-MVP is **scheduled, not open-ended**: Phase 7 data pages, Phase 8
  hardening, **Phase 9 reusable sections** (the first post-MVP feature),
  Phase 10 visual canvas if the spike passed (§15).
- The architecture is proven by **four golden tests** — News (GT1),
  Course (GT2, inside MVP), a DataProvider (GT3), **a Widget (GT4 — a Pip
  Calculator whose diff is a feature package + one registry line + a page
  seed + a menu item)** — not by News alone (§12), and by the 13-case
  architecture test in §17.

## 3. What changed from v1 — and why

| v1                                                                                                                                                                     | v2                                                                             | Reason                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| 8 new packages                                                                                                                                                         | 1 (`@repo/blocks`)                                                             | six duplicated shipped systems (ADR-020)            |
| `apps/admin` + `apps/web`                                                                                                                                              | one app, two route groups                                                      | ADR-006                                             |
| `CmsPage`, `CmsTemplate`, `CmsSection`, `CmsBlockPreset`, `CmsEffectPreset`, `CmsThemeSettings`, `CmsMenu(Item)`, `CmsAuditLog`, `CmsRedirect`, `Media*`, `AccessRule` | `Page`, `PageTranslation`, `PageVersion`, `CardTemplate`                       | ADR-021/023; the rest already exist                 |
| `PageKind` + `TemplateKind` + free-string `contentType`                                                                                                                | one `PageKind` of four                                                         | critique §11–12; ADR-021                            |
| Content templates as a separate entity                                                                                                                                 | a `DETAIL` page                                                                | same versioning, one concept                        |
| `content-adapters`, one card shape                                                                                                                                     | `CollectionProvider` + `DataProvider`                                          | critique §9/§13; ADR-022                            |
| News-specific filter/pagination blocks                                                                                                                                 | generic provider-bound blocks                                                  | critique §16; ADR-022                               |
| Nothing binds a filter to a grid                                                                                                                                       | `bindingId` + URL params                                                       | the gap v1 never addressed                          |
| `CmsBlockPreset` (copy)                                                                                                                                                | `CardTemplate` (reference)                                                     | critique §14; ADR-023                               |
| Custom per-block hex, `CmsEffectPreset` builder                                                                                                                        | token-only choices, bounded motion enums                                       | ADR-003/018/024, contrast contract                  |
| ISR + `revalidate = 3600` + invented tags                                                                                                                              | Cache Components + four new tags                                               | ADR-004/025                                         |
| Puck locked                                                                                                                                                            | Puck spike-gated; composer first                                               | ADR-026                                             |
| Phase 0 = blind 12-part audit                                                                                                                                          | `docs/cms/00-reconciliation.md`, done                                          | the repo is readable                                |
| Phase 6 = rewrite News UI, convert `/news`                                                                                                                             | wrap shipped components; fallback switch                                       | ADR-015 is locked; DEVLOG shows the regression risk |
| Phase 8 = build menus/header/footer + `CmsMenu`/`CmsTemplate kind=PART`                                                                                                | header/footer/panels are `PART` **pages**; menus extend the shipped `MenuItem` | ADR-027/028 — reuse Module 08, don't fork it        |
| §18 testing bullets                                                                                                                                                    | gates that block publish and CI                                                | the builder can otherwise defeat five gates         |

### 3.1 What changed from v2.0 to v2.1 — and why

Source: `docs/changes/dynamic-site-plan-v2-review.md` (accepted in full).
The architecture is unchanged; these are additions and clarifications.

| v2.0                                                                      | v2.1                                                                                        | Reason                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `data-widget` block with a `variant` enum                                 | **Widget registry** + one generic `widget` block; feature packages own runtimes             | every new tool would have edited the CMS — ADR-030                                       |
| three golden tests                                                        | **four** — GT4 Widget                                                                       | tools are the first-year feature stream                                                  |
| raw hrefs in block props; entity targets for menus only                   | **`LinkTarget`** everywhere, one resolver                                                   | slug change / unpublish broke page buttons; no broken-link report was possible — ADR-031 |
| node = `{type, version, id, props, translations, children}`               | + `label`, `hidden`, `anchor`, `style {presetId, overrides}`, responsive values, `hiddenOn` | every builder needs them; adding later means a migration — ADR-032                       |
| five token style keys                                                     | + gradient / image / video backgrounds with an overlay gate, `gap`, `shadow`, `border`      | the brief's design controls, kept token-only — ADR-032                                   |
| no responsive model                                                       | three fixed breakpoints, bounded prop set                                                   | mobile/tablet/desktop control — ADR-032                                                  |
| "duplicate page"; part presets as loose seeded versions; no style presets | **`LayoutTemplate`** (start from: page/section/block/part) + **`StylePreset`** (linked)     | the presets requirement, without a builder and without duplicate data — ADR-033          |
| no usage tracking; ADR-023 assumed a guard that did not exist             | **`ContentReference`** written on save                                                      | usage, deletion guards, broken links, missing media — ADR-033                            |
| Phase 3 "minimum picker"; images only                                     | **Media v2**: four kinds, metadata, replace, guarded delete, one library component          | reusable media is a stated acceptance criterion — ADR-034                                |
| no `video`/`table`/`tabs`/`breadcrumb`                                    | added to the MVP block set                                                                  | §11 already specified safe embeds; §6.2 had no block                                     |
| `PageVersion` with no revision                                            | `updatedAt` + `revision` + `gateResult`; draft mutable in place, publish snapshots          | the promised optimistic lock had nothing to compare                                      |
| flat page list                                                            | tabs Pages / Designs / Global; Overview; Templates, Styles, Media, Redirects screens        | §8.1 vocabulary rule applied to the IA                                                   |
| §10 still said "≤ 6 provider-backed blocks"                               | budget from settings; request-side caps named separately                                    | ADR-029 had already made the change                                                      |
| `PageKind.DATA` = "page over a non-content provider"                      | reserved for route-param data pages; tools live on STATIC pages                             | redundant with STATIC + widget — ADR-030 §5                                              |

### 3.2 What changed from v2.1 to v2.2 — and why

Written against the repository, not against the plan: every item below is
something the code made visible when the phases were broken into PRs. No
ADR is touched; each is a correction inside a decision already made.

| v2.1                                                                                                         | v2.2                                                                                                                                                                                                                                                                                                              | Reason                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Phase 1 as one paragraph                                                                                     | Phase 1 as six PRs with file paths, service signatures, tests and a criterion → test traceability table (§12)                                                                                                                                                                                                     | a paragraph is a spec; a PR list is executable                                                                      |
| Phases 2–8 as prose                                                                                          | each gains a **PR breakdown** naming the packages and files it touches (§12)                                                                                                                                                                                                                                      | same                                                                                                                |
| "nested paths derived per locale" (one clause)                                                               | **§5.1** — definitions, algorithm, seven rules, worked examples in `en`/`es`/`ar`, slug-change and reparent cases                                                                                                                                                                                                 | the clause hid four real decisions (same-locale ancestry, redirect shadowing, COLLECTION paths, deleted-page paths) |
| ADR-034 "existing rows backfill", ADR-031 "`MenuItem` rows are backfilled"                                   | **§5.2** — pre-launch data policy: dev DBs are reset, defaults + one-statement migration SQL carry the change, no scripts; policy expires at launch                                                                                                                                                               | the owner's call (2026-09-05): there is no production data to preserve yet                                          |
| new permission `cms.redirects.manage`                                                                        | reuse the seeded **`redirects.manage`** (`seo` group, already held by `seo_manager`)                                                                                                                                                                                                                              | it exists; a second key for the same screen is the ambiguity the seed file's own comment warns about                |
| ADR-034 "the seeded `media.*` keys are reused: `media.view`, `media.upload`, `media.update`, `media.delete`" | only `media.upload` and `media.delete` are seeded today; **`media.view` and `media.update` are seeded in Phase 3** with the library                                                                                                                                                                               | `check-permission-keys` would fail the PR otherwise                                                                 |
| ADR-021 `PageTranslation.status @default(MISSING)`                                                           | `@default(DRAFT)` — `TranslationStatus` has no `MISSING` value; "MISSING" in the admin means _no translation row_                                                                                                                                                                                                 | the drafted schema already does this; stated so nobody "fixes" it                                                   |
| Phase 2: `home.sections` → `home` page, retired when identical                                               | Phase 2 seeds and renders the `home` page **behind a fallback switch** and proves parity for the four static sections; the two dynamic sections (`latest_analysis`, `glossary_spotlight`) migrate in **Phase 4** with the `collection` block, and only then are `home.sections` and `check-home-sections` retired | the homepage's real sections include two collections; parity cannot be proven before collection blocks exist        |
| §7.2 reserved-path list mentions `tools` as a future claim                                                   | **`tools` is not reserved** — `/tools` is a CMS-owned STATIC parent seeded in Phase 7; `RESERVED_PREFIXES` starts with `courses` (GT2's detail route)                                                                                                                                                             | the plan's own Phase 7 contradicted the review's example                                                            |
| COLLECTION pages "resolved by `(locale, path)` in the catch-all"                                             | a COLLECTION page's path equals its content type's **hosting route** (`/news`, `/analysis`, `/glossary`, `/courses`) in every locale, and that route file renders it (as §7.2 already says for `/news`); the reserved-path guard exempts exactly that case                                                        | otherwise `/news` is both reserved and required                                                                     |
| E2E journeys named per phase                                                                                 | stated plainly: **no Playwright config exists yet** (every module's E2E is deferred). Phase acceptance is proven by Testcontainers integration tests plus a manual journey recorded in the DEVLOG until Module 14 wires Playwright; the journeys are written then                                                 | a plan that assumes a harness that is not there is not executable                                                   |
| —                                                                                                            | **§18** ADR → touchpoint index                                                                                                                                                                                                                                                                                    | one table answers "what does ADR-N make me write?"                                                                  |

## 4. Architecture

```text
apps/web
  app/(public)/[locale]/
    [...slug]/page.tsx          STATIC + COLLECTION pages (reserved-path guarded;
                                REQUIRED catch-all, not optional — see §12 PR 1.4)
    news/[slug]/page.tsx        existing route; renders the DETAIL page for "news"
    news/page.tsx               existing route; renders the COLLECTION page when one
                                exists, else today's hard-coded composition (switch)
  app/(admin)/admin/website/
    page.tsx                    Overview dashboard (§8.3)
    pages/…                     tabs: Pages · Designs (DETAIL) · Global (PART); metadata,
                                translations, versions, publish
    templates/…                 LayoutTemplate library ("Start from") — ADR-033
    styles/…                    StylePreset library ("Linked") — ADR-033
    cards/…                     CardTemplate library — ADR-023
    media/…                     MediaLibrary (same component as the picker) — ADR-034
    redirects/…                 Redirect rows (model exists; screen is new)
    settings/…                  cms.dataBudget, default parts, part cacheLife
    _builder/…                  composer UI (client, admin-only) — ADR-026
  app/_cms/registry.ts          assembles providers + widgets (with bound actions) — ADR-030
  app/api/preview/route.ts      draft mode
  app/api/<tool>/…              a feature's own endpoints (rate-limited, call @repo/core)

packages/blocks                 NEW — registry, schemas, renderTree(), block renderers,
                                the generic `widget` block; /definitions subpath is pure
packages/widgets                NEW (Phase 7) — feature widgets, granular exports per feature
                                (/calculators, /market, …), /definition subpaths are pure;
                                a heavy feature may ship packages/widgets-<name> instead
packages/core/src/cms/          page/version/template/style/card services, publish,
                                revalidation, references.ts (ContentReference sync),
                                links.ts (LinkTarget resolver), providers/ (news, analysis,
                                course, glossary, market.rates, market.calendar)
packages/core/src/media.ts      storeMedia() (+ storeImage() wrapper), replace, guarded delete
packages/contracts/src/cms/     layout tree + node envelope schema, block prop schemas,
                                style/responsive/LinkTarget/widget contracts, query schemas,
                                reserved paths, card/template/preset config schemas
```

Dependency direction: `apps/web → @repo/blocks, @repo/widgets, @repo/core,
@repo/ui, …`; `@repo/blocks → @repo/ui, @repo/contracts, @repo/i18n,
@repo/theme`; `@repo/widgets/* → @repo/ui, @repo/contracts, @repo/i18n,
@repo/utils, @repo/theme`. **Neither `@repo/blocks` nor any widget package
imports `@repo/core` or `@repo/db`** — providers, widgets and bound actions
are injected into `renderTree` (ADR-020, ADR-030), which is also what keeps
`import-x/no-cycle` satisfied and the renderer suite database-free.
Business logic stays put: pure computation in `@repo/utils`, services in
`@repo/core`, mutations behind `requirePermission()` in `apps/web`.

## 5. Data model

Full Prisma in **ADR-021** (`Page`, `PageTranslation`, `PageVersion`) and
**ADR-023** (`CardTemplate`). Shape summary:

- `Page` — `kind`, `contentType?`, `dataProvider?`, `status`, `isActive`,
  `visibility` (`FeatureVisibility`), `requiresFeature?`,
  `publishedVersionId?`, `draftVersionId?`, `deletedAt?`.
- `PageTranslation` — per locale: `title`, `slug`, `path` (stored **without**
  locale prefix), `status`, SEO fields, `ogImageId`, `sourceHash`.
  `@@unique([pageId, locale])`, `@@unique([locale, path])`.
- `PageVersion` — `number`, `layout Json`, `note`, `authorId`.
- `CardTemplate` — `key`, `contentType?`, `variant`, `config Json`,
  `isSystem`.

**v2.1 amendments (ADR-032 §6):** `Page.updatedById`, `Page.parentId?`
(breadcrumbs, nested paths derived per locale, redirects on parent slug
change), `Page.group?` (admin-only label); `PageVersion.updatedAt`,
`revision` (the optimistic lock — the **draft is mutable in place**,
publish **snapshots** it into a new row), `gateResult Json?` (last gate run,
gates run on autosave), `templateKey?`.

**v2.1 additions (ADR-033, ADR-034):**

- `StylePreset` — `key`, `name`, `scope`, `config Json` (StyleChoices +
  MotionChoices), `isSystem`. **Linked.**
- `LayoutTemplate` — `key`, `name`, `kind: PAGE | SECTION | BLOCK | PART`,
  `pageKind?`, `partKey?`, `layout Json`, `previewImageId`, `isSystem`.
  **Start from.** ADR-027's header/footer presets are `PART` rows here.
- `ContentReference` — `sourceType`, `sourceId`, `refType`, `refId`,
  `field`. Written on every save by `syncReferences()`; never scanned on
  read. Serves usage counts, deletion guards, broken links, missing media,
  orphan widgets.
- `MediaAsset` gains `kind`, `title`, `altText`, `folder`, `tags`,
  `durationMs`, `posterAssetId`, `version`, `deletedAt`.

Relational vs JSON, unchanged from v1 §5.7 and worth keeping verbatim:
**relational** = anything routed, filtered, joined or reported on;
**JSON (validated)** = the block tree, block props, block translations, card
config, provider query config, style-preset config, template layouts.

Permissions (seeded in the PR that first calls them, per
`check-permission-keys`): `cms.pages.view`, `cms.pages.create`,
`cms.pages.update`, `cms.pages.delete`, `cms.pages.publish`,
**`cms.parts.publish`** (a header publish is site-wide — separate from page
publish), `cms.cards.manage`, **`cms.templates.manage`**,
**`cms.styles.manage`**. The redirects screen reuses the **already seeded
`redirects.manage`** (`seo` group) — there is no `cms.redirects.manage`.
The media library reuses `media.upload` / `media.delete` (seeded) and
seeds **`media.view` / `media.update`** in Phase 3 (they do not exist
today). DETAIL designs stay under `cms.pages.*` — content authors never
need them.

**Schema state today (2026-09-05):** `Page`, `PageTranslation`,
`PageVersion`, `PageKind` and `ContentReference` are **drafted in
`packages/db/prisma/schema.prisma` (uncommitted), with no migration
generated yet**. Phase 1 PR 1.1 reviews that draft against ADR-021/032/033
and generates the migration; it does not start from a blank schema.

### 5.1 Path derivation — nested paths per locale (ADR-021 §2, ADR-032 §6)

The admin edits a **slug** per locale; the **path** is derived and never
typed. One pure function in `@repo/contracts/src/cms/paths.ts` is shared
by the service (authoritative, on save) and the metadata form (live
preview), so the two cannot disagree.

**Definitions**

| Term           | Where                                                                                                                                   | Shape                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slug`         | `PageTranslation.slug`, per locale                                                                                                      | `slugify()` output (lower-case, `a-z`, `0-9`, the Arabic block, hyphen-separated, ≤ 150 chars). Empty **only** on the `home` page                            |
| `path`         | `PageTranslation.path`, per locale                                                                                                      | `/` + ancestor slugs + own slug — **no locale prefix**, no trailing slash. `home` = `/`                                                                      |
| public URL     | computed at read time                                                                                                                   | `prefix(locale) + path`; `prefix` is `""` for the default locale, `/{locale}` otherwise (`localePrefix: "as-needed"`). `home` in `es` is `/es`, never `/es/` |
| default locale | `Locale.isDefault` in the DB (ADR-007), through the helper `articlePath`'s callers already use — not the static `routing.defaultLocale` |                                                                                                                                                              |

**Algorithm** — `derivePagePath(locale, slug, parentPathInLocale)`:

```text
key = "home"                     → "/"
no parent                        → "/" + slug
parent with a path in `locale`   → parentPath + "/" + slug
parent without one               → refuse  PARENT_NOT_TRANSLATED { parentId, locale }
```

**Rules**

1. **Same-locale ancestry.** A child's `es` path is built from its parent's
   `es` slug. If the parent has no `es` translation, the child's `es`
   translation cannot be saved — the error names the parent and the locale.
   There are no mixed-language paths.
2. **Recompute the subtree on every write that can move a path** —
   translation save, slug change, parent change — per locale, in the same
   transaction. For each changed path of a **published** page: upsert
   `Redirect { fromPath: publicPath(old), toPath: publicPath(new), 301 }`
   (the `createSlugRedirect` pattern `articles.ts` and `content.ts` already
   use); **deactivate any redirect whose `fromPath` equals a path that just
   became live** (the resolver checks redirects before pages, so a stale row
   would shadow the page); revalidate `page-path:{locale}:{old}`,
   `page-path:{locale}:{new}` and `page:{id}` for every affected page.
3. **Reserved first segment.** A STATIC path (served by the catch-all)
   never begins with a segment in `RESERVED_PATHS` — today's route
   directories and root files: `news`, `analysis`, `glossary`, `sign-in`,
   `admin`, `api`, `uploads`, `_next`, `sitemap.xml`, `robots.txt`,
   `favicon.ico` — or in `RESERVED_PREFIXES`, the append point for a route a
   later phase will add (`courses`, for GT2's detail route). A COLLECTION
   page is the one exception: its path is fixed to its content type's
   **hosting route** (`CONTENT_ROUTES[contentType]` — `/news`, `/analysis`,
   `/glossary`, `/courses`) in every locale, because that route file renders
   it (§7.2). DETAIL and PART pages have no path. **`tools` is not
   reserved** — `/tools` is a CMS-owned STATIC parent seeded in Phase 7.
4. **Collisions.** `@@unique([locale, path])` is the last line of defence;
   the service pre-checks and returns the colliding page by name. A
   soft-deleted page keeps its paths so that restore is exact — the error
   says so — matching how article slugs already behave.
5. **Parent constraints.** A page cannot be its own ancestor (the cycle
   guard walks `parentId`); `home` cannot be a parent; depth > 3 is a
   publish **warning** (ADR-032 §6); depth > 6 is refused as input
   validation — a request-side cap, like `limit ≤ 24`, not a design policy.
6. **Unpublishing or soft-deleting a parent leaves children resolvable** —
   paths are data, not a route tree; the `breadcrumb` block skips
   unpublished ancestors. Soft-deleting a page that still has non-deleted
   children is refused with the children named.
7. **Locales are independent.** A page may exist in `en` and `es` and not
   in `ar`; `hreflang` and the sitemap list only translations that exist
   and are published.

**Examples** — default locale `en`, `es` active, `ar` shown for the refusal

| Page                              | Parent | `en`: slug → path → URL                                                  | `es`: slug → path → URL                                                                              | `ar`                                                   |
| --------------------------------- | ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Home (`key = home`)               | —      | `""` → `/` → `/`                                                         | `""` → `/` → `/es`                                                                                   | `""` → `/` → `/ar`                                     |
| About                             | —      | `about` → `/about` → `/about`                                            | `acerca` → `/acerca` → `/es/acerca`                                                                  | `حول` → `/حول` → `/ar/حول` (percent-encoded in `href`) |
| Tools                             | —      | `tools` → `/tools` → `/tools`                                            | `herramientas` → `/herramientas` → `/es/herramientas`                                                | _(not translated)_                                     |
| Pip Calculator                    | Tools  | `pip-calculator` → `/tools/pip-calculator` → `/tools/pip-calculator`     | `calculadora-de-pips` → `/herramientas/calculadora-de-pips` → `/es/herramientas/calculadora-de-pips` | **refused** — Tools has no `ar` translation            |
| News listing (COLLECTION, `news`) | —      | `/news` in every locale (`CONTENT_ROUTES.news`); URL `/news`, `/es/news` | same                                                                                                 | same                                                   |

_Slug change:_ Tools `en` slug `tools → trading-tools` (published). Pip
Calculator's `en` path becomes `/trading-tools/pip-calculator`; redirects
`/tools → /trading-tools` and `/tools/pip-calculator →
/trading-tools/pip-calculator` are written; `es` is untouched.
_Reparent:_ Pip Calculator under About. `en` → `/about/pip-calculator`,
`es` → `/acerca/calculadora-de-pips`, one redirect per changed published
path; `ar` unaffected (no translation to move).

### 5.2 Data and migration policy for Module 16 (pre-launch)

Owner's decision (2026-09-05): **no backfill scripts; databases are
reset.**

- No production database exists yet. Every environment is rebuilt with
  `pnpm db:reset` (`prisma migrate reset`: drop → migrate from zero →
  seed) whenever a Module 16 migration lands.
- Migrations are still real `prisma migrate dev` migrations, never
  `db push`: Module 01's "migrations from zero" test and the first
  production deploy both need the history.
- Where an ADR says "existing rows backfill" (ADR-034 §2 `kind` / `folder`;
  ADR-031 §Consequences and ADR-028 §1 `MenuItem` → `ROUTE` / `URL`), the
  column **default** carries it (`kind @default(IMAGE)`, `folder
@default("/")`), and where a default cannot express it, **one SQL
  statement inside the generated migration** does (`UPDATE menu_items SET
link_type = 'URL' WHERE url IS NOT NULL`). Never a script, never a
  maintenance job — the migration must still be correct on a database
  that was not reset.
- Shipped settings-driven data migrates **through the seed**, not through
  data scripts: `home.sections` → the `home` page layout (Phases 2 and 4),
  header/footer settings → PART pages and `LayoutTemplate{PART}` rows
  (Phase 6), `header.cta` and the hero CTA → `LinkTarget`s. The seed stays
  idempotent (upsert on business keys; `create`-only for admin-editable
  values, Module 01's rule).
- **This policy expires at launch.** The first production deploy is
  recorded in the DEVLOG, and from that entry on every schema change needs
  a data-preserving migration and its Testcontainers test.

## 6. Blocks & providers

### 6.1 Block definition

```ts
export interface BlockDefinition<P> {
  type: string; // "collection"
  version: number; // bumped with a migrate entry
  labelKey: string; // i18n key — never a literal
  category: "layout" | "content" | "collection" | "detail" | "data" | "marketing";
  schema: ZodType<P>;
  defaults: P;
  translatable?: (keyof P)[];
  migrate?: Record<number, (old: unknown) => unknown>;
  supports: {
    style?: StyleKey[]; // subset of ADR-032 §2: background | textTone | padding | gap
    //   | radius | shadow | border | width — token choices only
    motion?: boolean; // bounded enum, ADR-024
    visibility?: boolean; // FeatureVisibility, ADR-012 semantics
    children?: boolean;
  };
  responsive?: (keyof P)[]; // props that accept ResponsiveValue<T> (ADR-032 §3)
  links?: (keyof P)[]; // props typed LinkTarget — collected and resolved in pass 1/2 (ADR-031)
  needs?: BlockDataNeed; // declares provider work; resolved by renderTree
}
```

Stored node (the **envelope**, ADR-032 §1): `{ type, version, id, props,
label?, hidden?, anchor?, style? {presetId?, overrides?}, motion?,
visibility?, requiresFeature?, responsive? {hiddenOn?}, translations?,
children? }`. Every envelope field has a Zod default, so older fixtures
validate. `@repo/blocks/definitions` imports only `@repo/contracts` and
catalog keys — no React DOM, no `@repo/ui` — so a native renderer can reuse
the schemas (ADR-032 §5).

### 6.2 MVP block set

Mostly **wrappers over shipped `@repo/ui` components** (reconciliation §11),
not new UI.

- **Layout** — `section`, `container`, `columns`, `grid`, `spacer`,
  `divider`.
- **Content** — `heading`, `paragraph`, `rich-text` (sanitized HTML,
  ADR-009), `image` (`MediaAsset`; alt is a translatable prop defaulting
  to the asset's), **`video`** (`MEDIA` asset or allow-listed `EMBED`,
  ADR-034 §6), `button`, `badge`, `icon-card`, `stat-card`,
  `process-step`, `faq` (accordion), **`tabs`**, **`table`** (static
  content table), **`breadcrumb`** (from `Page.parentId`), `cta-band`,
  `marquee`, `counter`, `newsletter-form`. Every link prop is a
  `LinkTarget` (ADR-031).
- **Collection** — `collection`, `collection-filter`, `collection-search`,
  `collection-sort`, `collection-pagination`, `related-content`,
  `featured-content`.
- **Detail** — `content-hero`, `content-field`, `content-body`,
  `content-meta`, `author-card`, `share-row`, `content-tags`.
- **Widgets** — **`widget`** `{ widgetKey, config }`: the one generic
  dispatch block for every interactive feature (calculators, rates table,
  converter, calendar, ticker, forms, trading tools) — ADR-030. Unknown
  key → `FallbackBlock`. Widget `needs` join pass 1 like a collection's.
  There is **no `data-widget`** block.
- **Fallback** — `FallbackBlock`: renders nothing in production, a named
  warning in preview. Unknown types never crash a page.

Not built: `custom-html`. A sanitized-raw-HTML block is a permanent
allow-list maintenance burden and the repo's sanitizer posture (ADR-009) is
built around _content bodies_, not layout. If it is ever needed it takes its
own ADR, the `cms.blocks.custom_html` permission, and an XSS corpus test —
v1 §16's design is a reasonable starting point for that ADR.

### 6.3 Providers

Interfaces, binding rules and the conformance suite are in **ADR-022**.
Providers wrap existing services and **compose** the frozen article
visibility rule (`publicArticleWhere`) rather than re-deriving it. MVP
providers: `news`, `analysis`, `trade-idea`, `glossary`, `course` (listing
only, since the learn area is deferred), `market.rates`,
`market.calendar` — the last two as `DataProvider`s.

### 6.4 Adding a content type later

Ship (1) a provider in `@repo/core/src/cms/providers/`, (2) filter/sort
descriptors, (3) a seeded system `CardTemplate`, (4) a `DETAIL` page seed if
it has detail routes. **No builder change, no new block.** This is v1 §6.3's
promise, made checkable by the ADR-022 conformance suite.

### 6.5 Widgets — adding an interactive feature later (ADR-030)

A feature ships (1) a `WidgetDefinition` — `key`, `labelKey`, `category`,
`version` + `migrate`, `configSchema`, `defaults`, `fields`, optional
`needs`, optional `actions` contracts, `visibility` floor,
`requiresFeature` — on a pure `/definition` subpath; (2) a `WidgetRuntime`
— `Render` (RSC, built from `@repo/ui`, client leaf inside), `Skeleton`
(mandatory), `Empty`/`Error` (mandatory with `needs`/`actions`); (3) its
pure logic in `@repo/utils`, its service in `@repo/core`, its mutations as
`apps/web` server actions / API routes behind `requirePermission()` and
rate limits; (4) a fixture + axe entry; (5) one line in
`apps/web/app/_cms/registry.ts`. Then a page seed and a menu item.
**Zero CMS change — GT4 asserts it.**

The line that must never move: **inputs that feed a computation or a
submission are the widget's** (fields, dropdowns, validation, calculation,
result rendering, loading/error states). Generic CMS controls are
`button`, `badge`, `tabs`, `faq`, `table` and static content. A generic
form builder is not built; a contact form is a widget with its own ADR
for `FormDefinition`/`FormSubmission`.

### 6.6 Links (ADR-031)

`LinkTarget = URL | ROUTE | PAGE(+anchor) | ARTICLE | ARTICLE_CATEGORY |
ARTICLE_TAG | COURSE | GLOSSARY_TERM | MEDIA | ANCHOR | NONE`, one resolver
in `@repo/core/src/cms/links.ts` shared with `buildNavigation`, batched
one read per type, resolved through the providers so visibility rules
apply. Page-content links are per-need reads tagged `content`; part links
resolve in the part's grouped call. `missing` / `unpublished` /
`forbidden` → menus prune, blocks render their non-link variant. Every
`LinkTarget` is recorded in `ContentReference` on save, which is the
Broken-links report.

## 7. Renderer, routing, caching

### 7.1 Pipeline

```text
load version.layout
 → Zod validate (bad node → FallbackBlock + log; never throw)
 → run block migrations to current versions
 → merge base props with translations[locale]
 → evaluate visibility per block (FeatureVisibility + ADR-012)
 → drop hidden nodes; resolve style presets (cached, style-preset:{id})
 → resolve card templates by id (cached, card-template:{id})
 ── PASS 1: COLLECT ────────────────────────────────────────────
 → walk the tree, collect every block's declared BlockDataNeed,
   every widget's needs(config), and every LinkTarget prop
 → normalise queries, dedupe by (provider, query, tier); group links by type
 ── PASS 2: RESOLVE ────────────────────────────────────────────
 → parts: ONE grouped cached call per (partKey, locale, tier),
          one batched provider round trip on miss, tag part-data:{key}
 → page collections: per-need cached by normalised query, tag content
 ── PASS 3: RENDER ─────────────────────────────────────────────
 → render each node with its resolved data as props
```

`renderTree` is pure given (layout, context, providers); **blocks never
fetch during render** (ADR-029), which is what makes the resolution
dedupable, batchable, independently cacheable — and the whole renderer
testable without a database.

### 7.2 Routing

| Route                                       | Serves                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(public)/[locale]/[...slug]/page.tsx`      | STATIC + COLLECTION pages, resolved by `(locale, path)` — a REQUIRED catch-all (§12 PR 1.4: an optional one collides with `[locale]/page.tsx`, which stays the home page's owner until Phase 2) |
| `(public)/[locale]/news/[slug]/page.tsx`    | existing route; loads the article, renders the `news` DETAIL page                                                                                                                               |
| `(public)/[locale]/news/page.tsx`           | existing route; renders the `news` COLLECTION page if published, else today's composition                                                                                                       |
| `(public)/[locale]/analysis`, `/glossary/*` | same pattern as they gain pages                                                                                                                                                                 |

Resolver order in the catch-all: reserved-path guard → `Redirect` lookup
(301, reusing `getRedirect`) → `PageTranslation` by `(locale, path)` →
draft-mode check → published version → `notFound()`.

**Reserved paths** (in `@repo/contracts/src/cms/paths.ts`, checked
against the actual route files by `scripts/check-reserved-paths.mjs`):
`RESERVED_PATHS` = today's route directories and root files — `news`,
`analysis`, `glossary`, `sign-in`, `admin`, `api`, `uploads`, `_next`,
`sitemap.xml`, `robots.txt`, `favicon.ico`; `RESERVED_PREFIXES` = segments
claimed ahead of their route file (`courses`, for GT2's detail route; a
future `search` or EA-hub area claims its prefix in its own PR). The check
fails in both directions: a route directory missing from the list, and a
list entry with no route behind it. COLLECTION pages are exempt exactly at
their hosting route (`CONTENT_ROUTES`, §5.1 rule 3). `tools` is a CMS
page, not a reserved prefix.

`localePrefix: "as-needed"` means the default locale's published path has no
prefix; `path` is stored bare and the prefix is applied at read time.

### 7.3 Caching

Per **ADR-025**: shell reads tagged `page:{id}` / `page-path:{locale}:{path}`
/ `layout:{contentType}`; card resolution tagged `card-template:{id}`;
style-preset resolution tagged `style-preset:{id}` (ADR-033); page-content
link resolution is a per-need read tagged `content`, never inside the shell
scope (ADR-031 §3);
provider reads tagged `content` with `cacheLife({ revalidate: 300 })` and
keyed by the **normalised query including the visibility tier**. No
`revalidatePath`, no route-level `revalidate` export.

## 8. Admin surface & editing

- **`/admin/website/pages`** — three tabs, because the three have different
  verbs and only one has a URL: **Pages** (STATIC/COLLECTION: status,
  path, translations, unpublished-changes badge, updated by/at), **Designs**
  (DETAIL: content type, status), **Global** (PART: key, pages overriding
  it). Create ("Start from" a `LayoutTemplate{PAGE}` or Blank), delete
  (soft), duplicate, group filter.
- **Page metadata** — title/slug per locale with live path preview
  (including the parent chain) and collision check, SEO fields with
  suggestions, visibility + feature flag, status, parent page, group, the
  three part overrides.
- **Composer** (`_builder/`) — a **tree / layers panel** (nesting,
  search-in-page, jump-to-block, _Linked_ badges) beside the preview;
  block picker grouped by the four behaviour categories (§8.1) with search,
  recently used and "Start from" templates in the same picker; add /
  remove / reorder (drag, as `/admin/navigation` already does) / duplicate
  / **copy / paste** (node JSON, ids regenerated) / **hide** / **label** /
  **anchor** / "replace with…"; **undo / redo** (in-memory history);
  a settings panel per block (General · Style · Motion · Visibility ·
  Responsive · SEO) with a device toggle on responsive props and
  "Use style…" / "Save as style" / "Save as template"; a locale switcher
  with status dots; autosave to the draft version with `revision`-based
  optimistic locking and a conflict toast; **gates run on autosave** and
  show inline; a **Data panel** listing what the page shows and from where
  (the collected needs, in admin words) with the budget meter (ADR-029 §6).
- **Versions panel** — list (number, author, note, date), preview any
  version through draft mode, **restore as draft**, note on publish;
  "unpublished changes" state and **Discard draft**.
- **Translations tab** — every translatable prop × locale in one table
  with MISSING/OUTDATED badges, edited in place (the translator's view;
  the per-block editor is the designer's).
- **Preview** — `/api/preview` enables draft mode and opens the **real
  public route** in an iframe with 375/768/1440 width toggles. Same-origin
  works because public sets `frame-ancestors 'self'`; an admin URL could not
  be framed (`'none'`). A signed, expiring **share-preview token** for
  non-admin reviewers is optional (§15).
- **`/admin/website/cards`** — card template library with live preview
  against real items and a usage count before save.
- **`/admin/website/styles`** and **`/admin/website/templates`** — the
  linked and start-from libraries (ADR-033), each with preview and usage.
- **`/admin/website/media`** — the `MediaLibrary` (ADR-034): upload (four
  kinds), grid/list, kind filter, folders, search, metadata, usage panel,
  replace, guarded delete. The composer's picker is this component in
  select mode.
- **`/admin/website/redirects`** — the existing `Redirect` rows: list, hit
  counts, add/disable (the seeded `redirects.manage`).
- Every mutation: `requirePermission()` first line → service →
  `syncReferences()` → `recordAudit` → tag revalidation.

### 8.1 The admin vocabulary is not the architecture's vocabulary

**Binding UI rule.** The engineering model (`PageKind`, `contentType`,
`provider`, `bindingId`, `CollectionProvider`) never appears on screen. The
admin sees the words they already think in:

| Admin sees                                                                    | Model underneath                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| Page Designs → **News Detail Design**                                         | `Page{ kind: DETAIL, contentType: "news" }`         |
| Page Designs → **News Listing Design**                                        | `Page{ kind: COLLECTION, contentType: "news" }`     |
| **Card Designs** → Modern News Card                                           | `CardTemplate`                                      |
| **Global** → Header / Footer / Announcement                                   | `Page{ kind: PART }`                                |
| **What should this show?** → News · Latest · 6 · 3 columns · Modern News Card | `{ provider, mode, limit, layout, cardTemplateId }` |
| **Connect filters to** → this grid _(auto)_                                   | `bindingId`                                         |

The dynamic-block settings panel reads as questions, not fields:

```text
What should this show?   [ News          ▾ ]
Show                     [ Latest        ▾ ]
How many                 [ 6             ▾ ]
Layout                   [ 3 columns     ▾ ]
Card design              [ Modern News Card ▾ ]
```

`bindingId` is generated and hidden; a filter block auto-binds to the only
collection on the page and asks "which grid?" **only** when there are two.
Block categories are labelled by what they do, since the distinction between
a collection and a current-item field is the one thing a non-technical admin
reliably gets wrong:

- **Content you type** (heading, text, image, CTA…)
- **Content that fills itself** (collections, related, featured)
- **This item's details** (title, body, author, tags — _only on detail
  designs_, and hidden everywhere else)
- **Live data** (rates, calendar, converter)

Catalog keys carry all of this — no literal strings (ADR-024 §3).

Two more binding words: **Linked** and **Start from** (ADR-033). Every
reuse action in the UI carries one of them, and a linked node shows the
badge in the tree panel, so an admin never creates globally linked content
when they meant a copy — or the reverse.

### 8.2 Information architecture

```text
Website
├── Overview        dashboard — §8.3
├── Pages           tabs: Pages · Designs (DETAIL) · Global (PART)
├── Templates       LayoutTemplate — "Start from" (page / section / block / part)
├── Styles          StylePreset — "Linked"
├── Cards           CardTemplate — "Linked"
├── Media           MediaLibrary
├── Navigation      Module 08 menus, extended (ADR-028)
├── Redirects       Redirect rows
└── Settings        cms.dataBudget · default parts · part cacheLife · media caps
```

Feature management stays **outside** the CMS: `Website → Pages →
Calculator Page` designs the page; `Tools → Pip Calculator` (a future
module's own admin area) owns the calculator's configuration and logic.
The CMS never grows a screen for a feature's business rules.

### 8.3 Overview and reports

Everything here is a read over existing rows plus `ContentReference`; none
of it needs new infrastructure.

- **Counts** — published · draft · unpublished changes · scheduled (when
  scheduling lands) · parts overridden · redirects active.
- **Attention list** — pages with MISSING/OUTDATED translations in an active
  locale · pages over the budget **warn** threshold · drafts whose last
  `gateResult` failed · **broken links** (`ContentReference` targets missing
  or unpublished) · **missing media** (references to deleted assets) ·
  dangling card / style-preset references · **widgets with no registered
  runtime** · unused templates and styles.
- **Usage** — card template → placements · style preset → placements ·
  layout template → started-from count · media → usages · widget → pages ·
  part → pages overriding it.
- **Activity** — recently modified pages; a site-wide and per-page feed
  from `AuditLog` (publish, rollback, unpublish, translation edits).
- **Not here:** web analytics. The renderer emits a stable
  `data-page-key`; `Redirect.hitCount` stays. Analytics is a separate
  requirement if it ever becomes one.

## 8b. Global site layer

Specified by **ADR-027** (parts) and **ADR-028** (menus). The shape:

```text
Website
├── Pages            STATIC / COLLECTION / DETAIL / DATA
├── Cards            CardTemplate library (ADR-023)
├── Global
│   ├── Header       PART page  · presets: classic modern transparent floating center-logo
│   ├── Footer       PART page  · presets: simple classic-4col modern large newsletter dark-premium minimal
│   ├── Announcement PART page  · icon, link, schedule (startsAt/endsAt)
│   ├── Top bar      PART page
│   ├── Mobile nav   PART page  · drawer | fullscreen | dropdown
│   └── Panels       PART pages · menu-panel:{slug} — the mega-menu layouts
└── Navigation       Module 08's menus, extended (ADR-028)
```

**Why panels are pages, not menu data.** The reference header supplied by
the owner has three titled columns of icon + label + description links, a
payment-methods strip, a "View All" row — and a **News column listing live
articles**. That column is a `collection` block bound to the news provider
with a card template. A panel modelled as menu-item children cannot express
it; a panel modelled as a block layout gets it, plus visibility rules,
caching and card templates, for free.

**Bounded behaviours, not CSS.** `mode` (solid / transparent /
transparent-to-solid / floating), `position`, `height`, `border`,
`menuHover` (none / underline / slide-underline / background / pill / fade /
glow), `dropdown` (none / fade / slide-down / scale), `mobileMenu` (drawer /
fullscreen / dropdown). `transparent-to-solid` is implemented once as a
client leaf flipping `data-scrolled` from an IntersectionObserver sentinel,
CSS-expressed and reduced-motion-gated (ADR-018) — the admin picks a mode,
nobody authors a transition.

**Menu items** (ADR-028): `linkType` of ROUTE / URL / PAGE / ARTICLE /
ARTICLE_CATEGORY / ARTICLE_TAG / COURSE / GLOSSARY_TERM / DYNAMIC / NONE;
hrefs resolved at render through providers; dynamic children
(`categories | tags | latest | featured`, `limit ≤ 8`) filtered by the
content type's own visibility rule; allow-listed preset icons or a
`MediaAsset`; bounded badge keys; optional `panelPartKey`. Depth stays ≤ 2 —
a panel is a layout, not a third level.

**Panels may hold several dynamic sources** — News _and_ Featured Courses in
one panel is a legitimate design and the composer must not refuse it
(ADR-029). What makes that safe is not a cap but the resolution
architecture: a part's needs are collected, deduped and resolved in **one
grouped cached call** per `(partKey, locale, tier)` — a single batched round
trip on a cold miss, one cache entry serving the whole site — and tagged
`part-data:{key}` rather than `content`, so **publishing an article never
invalidates the site shell**. The header's collection refreshes within its
`cacheLife` window (default 5 min, per-part, stated in the admin UI), or
immediately if the admin republishes the part.

The Phase-6 **budget** (a setting, not a schema constraint) starts at 2
collections × 6 items per part and 6 × 36 per page, warns before it blocks,
and is raised by measurement recorded in the DEVLOG. The Lighthouse run
still includes a route whose header carries collections.

**Migration.** Parts are seeded from today's settings (`header.sticky`,
`header.cta`, `header.announcementBar`, `header.topBar`,
`header.showSearch`, footer keys) so the first publish is visually
identical; the shipped `SiteHeader`/`SiteFooter`/`AnnouncementBar`/`TopBar`/
`MobileNav` stay as the fallback until snapshot parity is proven at 1440 and
390, both modes, both directions.

## 9. SEO · multilingual · media · access

**SEO.** `generateMetadata` calls a `buildPageSeo({ page|item, locale })`
helper. Suggestions come from the page's first heading/paragraph/image, or
for DETAIL pages from the item's own SEO fields first and content fields
second. Per-locale overrides live on `PageTranslation`. JSON-LD from a
server helper (`WebPage`, `NewsArticle`, `Course`); `sitemap.ts` reads
`includeInSitemap` per translation; `hreflang` from the translation set;
listing pages get `noindex` beyond page 1 and a canonical without query
params.

**Multilingual.** Page-level via `PageTranslation`; block-level via
`node.translations[locale]` for props declared `translatable`. Missing
locale → fall back to the default locale with a `MISSING` badge in admin;
the public fallback policy follows the existing per-locale rule (ADR-007 /
Module 06), including the Arabic "not yet translated" notice rather than
LTR English inside an RTL layout. Every authored string is a catalog key or
a translatable prop — ADR-024 §3.

**Media (ADR-034).** One reusable system, delivered in Phase 3 as Module
11's deferred library work: `storeMedia()` for image / video / audio /
document (magic bytes decide the kind, per-kind caps are settings,
`storeImage()` stays as a wrapper, the ADR-017 driver seam is untouched);
`/uploads/[file]` serves HTTP Range for playback; `MediaAsset` carries
`kind`, `title`, `altText` (the default — a placement's translatable alt
overrides it), `folder` (path string), `tags`, `posterAssetId`, `version`;
**replace in place** keeps the id and invalidates every referencing page;
**delete is soft and refused while referenced**, listing the sources; the
`MediaLibrary` component is both `/admin/website/media` and the composer's
picker. An asset is uploaded once and placed anywhere. Embedded video
(YouTube/Vimeo allow-list, `@repo/utils/video-embeds`) is a source of the
`video` block, never an asset and never a background.

**Access.** Page and block visibility use `FeatureVisibility` with ADR-012's
frozen `PREMIUM` = staff-only semantics, plus `requiresFeature` for flag
gating — the same pair `MenuItem` already uses. Premium filtering happens
**inside the provider**, server-side, and is part of the cache key. There is
no `AccessRule` model and no second policy engine.

## 10. Publishing workflow

Draft → Preview → Publish → Update → Unpublish, with `draftVersionId` and
`publishedVersionId` as two pointers on `Page`.

`publishPage()`:

1. `requirePermission("cms.pages.publish")` (`cms.parts.publish` for a
   PART — a header publish is site-wide)
2. validate the layout tree (Zod) — refuse with the offending node named
3. run the **publish gates** — the same set the composer already ran on
   autosave (`gateResult`). **Block:** heading order skipped · a
   `bindingId` no collection provides · a missing card template or style
   preset · an image/video background with text and no overlay
   (ADR-032 §2) · a `LinkTarget` typed as a relative internal URL · the
   **data budget's `block` threshold** (`cms.dataBudget`, ADR-029 §5 —
   collections, items, video backgrounds; widget `needs` count).
   **Warn (publishes):** the budget's `warn` threshold · translatable props
   empty in a published locale · duplicate anchors · nesting depth > 3.
   The only _fixed_ numbers anywhere are the **request-side** caps on
   URL-derived params (`limit ≤ 24`, `page ≤ 200`, ADR-022 §4) — those are
   input validation, not design policy, and they live in the search-param
   schema, not in the gates.
4. **snapshot** the draft into a new immutable `PageVersion`, point
   `publishedVersionId`; the draft continues from it (ADR-032 §6)
5. `syncReferences()` for the published version (ADR-033 §4)
6. slug change → write a `Redirect` row for each old path (301), including
   descendants when `parentId` chains are affected
7. `recordAudit()`
8. `revalidateTag("page:{id}", { expire: 0 })` + each
   `page-path:{locale}:{path}` + `layout:{contentType}` when DETAIL +
   `part-data:{key}` when PART

Rollback = point `publishedVersionId` at an earlier version (same audit +
revalidation path). Unpublish = null the pointer; the catch-all 404s.

## 11. Security

Everything in `.claude/rules/security.md` applies unchanged. The
builder-specific restatements:

- Closed registry. No `eval`, no dynamic import from data, no executable
  content from an admin. **No `custom-html` block in MVP.**
- Rich text sanitized server-side on save (`sanitizeRichText`, ADR-009),
  with the existing XSS corpus extended to block props.
- **No SSRF.** Embeds are a static provider allow-list with locally
  constructed iframe URLs — the pattern ADR-015 #9 already uses for article
  videos. The app never fetches an admin-supplied URL.
- All external input parsed by `@repo/contracts` Zod schemas — including
  `searchParams` for every collection binding (ADR-022 §4).
- IDOR: `/admin/website/*` is covered by the Module 14 learner-session probe
  suite; page reads are permission-scoped and return 404 where existence is
  sensitive.
- CSP unchanged; authored styling produces classes, not inline styles
  (ADR-024 §1), so the public nonce-less `style-src` stays viable.
- Uploads: `storeImage()` only, magic-byte sniffing, no client MIME trust.

## 12. Phases

Each phase ends with CI green (`lint → typecheck → test → build`), a DEVLOG
entry with test results, and its acceptance criteria demonstrated.

### The four golden tests

A CMS that only ever renders News is a News page builder with extra steps.
The architecture is not proven generic until a **second content type, a
non-content data source and an interactive feature** all work with **no
builder change** — so these are named gates, not hopes:

|                  | What it proves                                                                                                                                                                                                                             | Where                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **GT1 — News**   | listing + detail + filters + related + card template, over a _shipped, locked_ module                                                                                                                                                      | Phases 4–5                                       |
| **GT2 — Course** | a second content type ships as **provider + descriptors + card template + page seeds only** — zero block changes, zero builder changes                                                                                                     | Phase 5, and it is an acceptance criterion there |
| **GT3 — Data**   | a `DataProvider` (rates or calendar) with no slug, no detail page and no card shape drives a rates page **through a widget's `needs`**                                                                                                     | Phase 7                                          |
| **GT4 — Widget** | a **Pip Calculator** page is composed in the builder and the entire diff is _a widget package/export + one registry line + a page seed + a menu item_ — zero changes in `@repo/blocks`, the composer or `@repo/contracts/cms` (ADR-030 §7) | Phase 7, contract landed in Phase 2              |

GT2 is the one that matters most, and it is deliberately pulled forward
into MVP: if adding courses turns out to need a new block or a builder
tweak, the ADR-022 contract is wrong and it is far cheaper to learn that in
Phase 5 than after launch. **Caveat, stated:** GT2 creates the public
courses listing/detail surface, which the module index currently lists as
deferred. Only the CMS-composed surface is in scope — enrollment, progress,
lesson players and the learn area stay deferred.

### Phase 0 — Reconciliation ✅ (this document set)

`docs/cms/00-reconciliation.md`, `docs/changes/dynamic-site-plan-review.md`,
ADR-020…029 (v2.1 added ADR-030…034), `.claude/skills/website-builder/SKILL.md`, claude.md +
plan.md updated.
**Accept:** no builder code written; every v1 decision either adopted,
adapted with an ADR, or explicitly rejected in writing.

### Phase 1 — Page model & resolver (no blocks yet)

**Scope in one line:** the `Page` model, its services, the public catch-all
rendering _title + placeholder_, and the admin Pages/Redirects screens —
everything a page needs except blocks. Six PRs, in order; each is
independently green (`lint → typecheck → test → build`, plus
`governance:check`, `check:permission-keys`, `check:phantom-deps`,
`check:catalog-completeness`).

**Starting state (verified 2026-09-05):** the schema below is already
drafted in `packages/db/prisma/schema.prisma` (uncommitted, no migration).
`packages/core/src/cms/` and `packages/contracts/src/cms/` do not exist.
There is no Playwright config in the repo — see the note under the
traceability table.

#### PR 1.1 — Schema, migration, seed (`packages/db`) — **shipped 2026-09-05**

- [x] **Review the drafted models** against ADR-021 / ADR-032 §6 / ADR-033
      §4 — `PageKind { STATIC COLLECTION DETAIL DATA }` (PART arrives in
      Phase 6), `Page` (incl. `parentId` self-relation `SetNull`,
      `updatedById`, `group`, the two version-pointer ids as plain columns),
      `PageTranslation` (`@@unique([pageId, locale])`,
      `@@unique([locale, path])`, `status @default(DRAFT)` — see §3.2),
      `PageVersion` (`number`, `revision`, `gateResult`, `templateKey`,
      `updatedAt`; `number = 0` is the mutable draft, `1…n` are published
      snapshots), `ContentReference` + its two enums. The draft stood with
      **one addition**: `@@unique([sourceType, sourceId, refType, refId,
field])` on `ContentReference` (replacing the `(sourceType, sourceId)`
      index it subsumes) — the invariant `syncReferences()`'s
      diff-and-replace relies on.
- [x] Migration **`20260904212045_add_cms_pages`** (UTC stamp). Generated
      offline — `prisma migrate diff --from-schema <HEAD schema> --to-schema
prisma/schema.prisma --script` — because the local dev DB had been
      `db push`-ed with the draft, which makes `migrate dev` refuse. The SQL
      carries three **CHECK constraints** Prisma cannot express:
      `page_translations.path LIKE '/%'`, `page_versions.number >= 0`,
      `page_versions.revision >= 0`. A fourth, `pages.parentId <> id`, is
      **impossible on MariaDB** (error 1901: no CHECK on a column governed
      by a FK referential action) — the whole cycle guard, self-parent
      included, is the service's (§5.1 rule 5, PR 1.3).
- [x] **Permissions** in `seed.ts` `PERMISSIONS` (new `"cms"` group):
      `cms.pages.view` · `cms.pages.create` · `cms.pages.update` ·
      `cms.pages.delete` · `cms.pages.publish` · `cms.parts.publish`.
      `cms.redirects.manage` was **not** added — `redirects.manage` exists.
      Role grants: `content_manager` += the five `cms.pages.*`; `editor` +=
      `cms.pages.view`, `cms.pages.update`; `seo_manager` +=
      `cms.pages.view`; `admin`, `super_admin`, `read_only` pick the keys up
      from the registry automatically. `cms.parts.publish` stays with admin
      and above.
- [x] **Seeded the `home` row** (upsert on `key`): `Page { key: "home",
kind: STATIC, status: DRAFT, createdById: <admin | "seed"> }` ·
      `PageTranslation { locale: <DB default>, title: "Home", slug: "",
path: "/" }` · `PageVersion { number: 0, revision: 0, layout:
{ version: 1, nodes: [] } }` with `draftVersionId` set and
      `publishedVersionId` **null** — `[locale]/page.tsx` + `home.sections`
      keep serving `/` until Phase 2 publishes the migrated layout (one
      source of truth). The literal is inlined (no `db → contracts` dep).
- [x] Tests (`packages/db/src/db.integration.test.ts`, Testcontainers):
      migrations from zero (the suite's `migrate deploy`); seed twice →
      identical counts incl. pages/translations/versions; the `home` row's
      exact shape; `(locale, path)` collision; `Page` delete cascades
      translations + versions; parent delete nulls `children.parentId`;
      `(pageId, number)` uniqueness; the two CHECKs; `ContentReference`
      duplicate rejected. **14/14 green.**
- [x] Exit: `pnpm --filter @repo/db lint` / `typecheck` clean;
      `check:permission-keys` OK; local dev DB reset with the owner's
      explicit consent (`prisma migrate reset --force` — Prisma's AI-agent
      guard requires it), `migrate status` up to date, seed run twice with
      identical output (65 permissions, `home` unchanged).
- [ ] **Open item for the owner (pre-existing, not PR 1.1's):** the
      ADR-019 `Comment` model sits in `schema.prisma` with **no migration**
      ("design-only"). Prisma Migrate has no such mode — `prisma migrate dev`
      will flag drift and demand a reset on every run until either a
      `comments` migration is generated or the model leaves the schema until
      Module 15's comments pass. `migrate deploy` (CI, Testcontainers, prod)
      is unaffected. This PR's migration deliberately excludes `comments`.

#### PR 1.2 — Contracts (`packages/contracts/src/cms/`) — **shipped 2026-09-05**

- [x] `paths.ts` — `RESERVED_PATHS`, `RESERVED_PREFIXES`, `CONTENT_ROUTES`,
      `MAX_PAGE_DEPTH = 6`, `pageSlugSchema` (normalises through the same
      rules as `slugify()`, duplicated rather than imported — contracts
      cannot depend on `@repo/core`; verified codepoint-identical to
      `content.ts`'s regexes), `derivePagePath()` (a `{ok, path} |
{ok: false, reason: "PARENT_NOT_TRANSLATED"}` result, not an
      exception — pure and table-testable), `publicPagePath()`,
      `firstPathSegment()` / `isReservedFirstSegment()`.
- [x] `layout.ts` — `layoutTreeSchema` v1 `{ version: 1, nodes:
StoredNode[] }` via `z.lazy` recursion, with the **full ADR-032
      envelope** (`type`, `version`, `id`, `props: unknown`, `label?`,
      `hidden` defaulted `false`, `anchor?`, `style? { presetId?,
overrides? }`, `motion?`, `visibility?` (new
      `featureVisibilitySchema`), `requiresFeature?`, `responsive?
{ hiddenOn? }`, `translations?`, `children` defaulted `[]`).
      `style.overrides` / `motion` / responsive props beyond `hiddenOn` are
      **placeholder `Record<string, unknown>` shapes** — the full
      token-only StyleChoices/MotionChoices contracts are Phase 2 (PR
      2.2); nothing in Phase 1 reads inside them, and widening later is
      additive. Per-type `props` validation is Phase 2's registry; Phase 1
      accepts any `props`. `EMPTY_LAYOUT`.
- [x] `pages.ts` — `createPageSchema`, `updatePageMetaSchema`,
      `savePageTranslationSchema` (slug empty allowed by the schema; "empty
      only for `home`" is a service-level rule, PR 1.3, because only the
      service knows `page.key`), `saveDraftSchema`, `publishPageSchema`,
      `rollbackPageSchema`, `listPagesQuerySchema` (the `articles/page.tsx`
      URL-state shape), `pageStatusSchema` (mirrors Prisma's
      `ContentStatus`, all 7 values), `createRedirectSchema`,
      `setRedirectActiveSchema`.
- [x] `index.ts` barrel; `packages/contracts/src/index.ts` exports it.
- [x] Tests (`paths.test.ts`, `layout.test.ts`, `pages.test.ts`): every
      schema round-trips; envelope defaults (`hidden: false`, `children:
[]`); recursion to arbitrary depth; `derivePagePath` table = the
      §5.1 worked examples verbatim (home, root, nested,
      `PARENT_NOT_TRANSLATED`); `publicPagePath` home/non-home ×
      default/non-default locale; reserved-segment flags for
      `RESERVED_PATHS` and `RESERVED_PREFIXES`, not for an ordinary page or
      the empty segment. **83/83 green** in `@repo/contracts`.
- [x] `scripts/check-reserved-paths.mjs` (+ root script
      `check:reserved-paths`) + `scripts/check-reserved-paths.test.mjs`:
      enumerates `apps/web/app/(public)/[locale]/*` directories (skipping
      `_*` and `[...]`/`[[...]]`) and `apps/web/app/{api,uploads,
robots.ts→robots.txt,sitemap.ts→sitemap.xml,favicon.ico}`, fails on a
      route missing from every list **or** a `RESERVED_PATHS`/
      `RESERVED_PREFIXES` entry with no route behind it (`admin`, `_next`
      are system-exempt — a route group and a framework internal,
      respectively, neither discoverable the way this script scans).
      **Verified against the live repo: OK** (11 reserved paths, 1 reserved
      prefix, 4 content routes) — **43/43** green in `test:governance`.
- [x] Exit: `pnpm --filter @repo/contracts lint`/`typecheck` clean;
      `pnpm check:phantom-deps` OK; workspace `pnpm typecheck` green after
      the new export.

#### PR 1.3 — Services (`packages/core/src/cms/`) — **shipped 2026-09-05**

Barrel `cms/index.ts`, re-exported from `packages/core/src/index.ts`.
Every mutation takes `actor: Subject` first, writes `recordAudit()` with
`actor.id`, and runs inside one transaction. Cached reads follow the
`navigation.ts` pattern: a pure `load*` exported for tests plus a
`"use cache"` wrapper. `@repo/db` gained one export for this PR:
`Prisma.TransactionClient`, the type of `db.$transaction(async (tx) =>
…)`'s callback parameter — needed because these services factor
transaction steps into separate exported functions (`upsertRedirectFor
PathChange`, `cascadeToChildren`, `syncReferences`) rather than one inline
callback.

- [ ] `pages.ts` — `createPage(actor, input)`, `updatePageMeta(actor, id,
input)`, `setPageParent(actor, id, parentId | null)` (cycle guard,
      subtree recompute, redirects), `duplicatePage(actor, id)` (copies
      translations with `-copy` slugs and the draft layout; never the
      published pointer), `setPageDeleted(actor, id, deleted)` (refuses
      while non-deleted children exist), `listPagesAdmin(query)`.
- [ ] `translations.ts` — `savePageTranslation(actor, pageId, input)`:
      slug → `derivePagePath` → reserved/collision pre-check → write →
      subtree recompute for that locale → redirects for published old paths
      → deactivate shadowing redirects → tags. `sourceHash` /
      `OUTDATED` flow as articles do.
- [ ] `paths.ts` — the DB half of §5.1: `resolveParentPath(parentId,
locale)`, `recomputeSubtreePaths(tx, pageId, locale)`, cycle guard.
- [ ] `versions.ts` — `saveDraft(actor, pageId, { layout, baseRevision })`
      → `updateMany({ where: { id: draftId, revision: baseRevision },
data: { layout, revision: { increment: 1 } } })`; `count === 0` →
      `ConflictError { currentRevision }`. `listVersions(pageId)`.
- [ ] `publish.ts` — `publishPage(actor, id, { note })`: validate layout
      (Zod) → run the gate list (Phase 1 gates: schema validity, depth > 3
      warning; the runner is a list so Phases 2–3 append) → snapshot the
      draft into `PageVersion { number: max + 1, revision: draft.revision,
note, authorId }` → set `publishedVersionId`, `status: PUBLISHED`,
      `publishedAt` → `syncReferences()` → audit → revalidate.
      `unpublishPage` (null the pointer, `status: DRAFT`), `rollbackPage(id,
versionNumber)` (pointer move, same audit + tags). Part publish
      (`cms.parts.publish`) is Phase 6; the permission is seeded now.
- [ ] `references.ts` — `syncReferences(tx, source, refs[])` (diff-and-
      replace) and `collectReferences(tree)` (returns `[]` for the empty
      Phase 1 trees; Phase 2 teaches it media, links, cards, styles,
      widgets, parts). The seam exists so every later save already calls it.
- [ ] `revalidate.ts` — `revalidatePageTags({ id, translations, kind,
contentType })` → `page:{id}`, every `page-path:{locale}:{path}`,
      `layout:{contentType}` when DETAIL; always `revalidateTag(tag,
{ expire: 0 })`.
- [ ] `public-pages.ts` — `loadPublishedPageByPath(locale, path)` +
      cached `getPublishedPageByPath` (tag `page-path:{locale}:{path}`),
      `getPublishedPage(id)` (tag `page:{id}`), `loadDraftPage(id)`
      (uncached, draft mode only), `resolvePublicPage(locale, segments,
{ draft })` → `{ kind: "page", page } | { kind: "redirect", to } |
{ kind: "not-found" }` in the §7.2 order, so the route file maps a
      result rather than deciding.
- [ ] `redirects.ts` — `listRedirects(query)`, `createRedirect(actor,
input)`, `setRedirectActive(actor, id, active)` (the `Redirect` model
      exists; only slug-change writes exist today).
- [ ] `packages/core/src/test-utils/next-cache-stub.ts` — make
      `revalidateTag` **record** its calls (it is a no-op now) so tag tests
      can assert exactly which tags a mutation touched.
- [x] Tests: `cms/paths.test.ts` (pure: `assertPathNotReserved`, no
      Testcontainers boot — the rest of `paths.ts` touches the database and
      is covered below); `cms/pages.integration.test.ts` (create → `/about`;
      nested path under "Tools"; duplicate with independent draft; delete
      guard; slug change → redirect; **parent slug change → child path +
      one redirect per old published path** — the acceptance criterion,
      verbatim; reparent recomputes own + descendant paths; shadowing
      redirect deactivated when a page moves into a vacated path;
      `PARENT_NOT_TRANSLATED`; cyclic/self parent refused;
      `MaxDepthExceededError` past `MAX_PAGE_DEPTH`; `listPagesAdmin`'s
      `global` tab empty, `hasUnpublishedChanges` flag); `cms/publish.
integration.test.ts` (publish creates `number: 1`, draft stays
      editable at `number: 0`; unpublish → `resolvePublicPage` = not-found;
      rollback moves the pointer; **publishing A records only A's
      `revalidateTag` calls, never B's** — the ADR-025 isolation test,
      proved against the now-recording `next-cache-stub`; actor without
      `cms.pages.publish` → `ForbiddenError` and no snapshot row; the home
      page resolves at `/`; a reserved segment never resolves as a CMS
      page even if a row existed there; a `Redirect` short-circuits before
      the published lookup); `cms/versions.integration.test.ts` (two saves
      on the same `baseRevision` → second refused with `DraftConflictError
{ currentRevision }`; a fresh read lets the next save through;
      `listVersions` excludes the draft row); `cms/redirects.integration.
test.ts`; every mutation asserted to have written an `AuditLog` row.
      **164/165 green** in `@repo/core`'s full suite — the one failure
      (`admin.integration.test.ts`, Module 02 theme-contrast validation) is
      unrelated to Module 16, reproduces in isolation, and touches no file
      this PR changed; flagged for the owner, not fixed here.

#### PR 1.4 — Public route, preview, sitemap (`apps/web`) — **shipped 2026-09-05**

- [x] `app/(public)/[locale]/[...slug]/page.tsx` — a **required** catch-all
      (`[...slug]`, not `[[...slug]]`): Next.js refuses an _optional_
      catch-all as a sibling of `[locale]/page.tsx` with "You cannot define
      a route with the same specificity as a optional catch-all route",
      because both would claim `/`. Discovered by actually running the dev
      server, not by typecheck (Next's route-tree validation only runs at
      dev/build time). `[locale]/page.tsx` keeps owning `/` via
      `home.sections` until Phase 2 (PR 2.7); this route only ever receives
      one or more segments. `setRequestLocale`; `resolvePublicPage()`;
      `permanentRedirect` / `notFound()` / renders `<Section><Container>
    <h1>{title}</h1><p>{t("public.pagePlaceholder")}</p></Container>
    </Section>`. Explicit route files keep precedence, so the catch-all
      only ever sees non-reserved paths; the reserved check in the
      resolver is defensive. `generateMetadata` builds the `Metadata`
      object inline (title/description/canonical/robots) — matching the
      existing `news/[slug]/page.tsx` precedent, which does the same
      rather than through a separate `core/cms/seo.ts` helper; a
      standalone helper returning a `next`-typed `Metadata` object would
      be a new kind of Next.js dependency on `@repo/core` with no
      precedent, for five lines of logic. `hreflang` alternates, JSON-LD
      and a real `buildPageSeo` shape land with the renderer in Phase 2,
      once there is more than a title to describe. **No
      `generateStaticParams` yet** — Cache Components refuse one that
      returns an empty array ("all `generateStaticParams` functions must
      return at least one result"), and Phase 1 has zero published STATIC
      pages to enumerate; `@repo/core`'s `loadStaticPageParams()` exists
      and is ready to wire in once Phase 4/5 publishes real content
      (ADR-025 §3) — also only found by running the app.
- [x] `app/api/preview/route.ts` — `GET ?pageId=&locale=`:
      `requirePermission("cms.pages.view")` → `resolvePreviewUrl()`
      (`@repo/core/cms`, **not** a raw `db` call — architecture.md #2
      forbids route handlers touching Prisma directly; the first draft of
      this route did exactly that and `next typegen && tsc` caught the
      missing `@repo/db` dependency, which is the _symptom_ the
      architecture rule exists to make visible) → `draftMode().enable()` →
      redirect. `app/api/preview/disable/route.ts`. The catch-all reads
      `draftMode().isEnabled` and passes `draft: true`; `resolvePublicPage`
      then finds the page by its **current** `(locale, path)` regardless of
      publish state and renders its draft layout — the admin's live path
      preview and the preview link show the same address.
- [x] `app/sitemap.ts` — appends `loadPageSitemapEntries()` (published +
      `includeInSitemap`, joined with `publicPagePath`) alongside the
      existing glossary/article feeds.
- [x] Catalog key `public.pagePlaceholder` added to all four
      `packages/i18n/messages/*.json` (`check:catalog-completeness` — OK;
      the pre-existing `admin.*`/`news.*` WARNs for `ar`/`es`/`ur` predate
      this PR and are untouched).
- [x] Tests: `proxy.test.ts` gains `/es/about` (locale-routed, not
      redirected) and `/admin/website` (STAFF-gated exactly like every
      other `/admin/*` path, never locale-prefixed) — **12/12 green**. The
      resolver's decisions are covered by PR 1.3's integration suite.
- [x] **Manual verification** (no Playwright harness — plan §12): built a
      throwaway page via the real service functions
      (`createPage`→`publishPage`) against the local dev DB, confirmed via
      direct query that `status: PUBLISHED` / `path: "/smoke-test-page"`,
      then over HTTP against a running dev server: `GET /smoke-test-page`
      → 200, `<h1>` and `<title>` correct; `GET /es/smoke-test-page` (no ES
      translation) → 404; `GET /about` (page doesn't exist) → 404;
      `GET /news`, `GET /`, `GET /sitemap.xml`, `GET /robots.txt` → 200,
      unaffected; `GET /admin/website` → 307 to `/sign-in`. Cleaned up
      (page + actor + audit rows deleted, dev server restarted to clear
      the now-stale `page-path` cache entry — expected: the direct-DB
      cleanup bypassed `revalidateTag`, which only a real publish/unpublish
      call reaches). `pnpm --filter @repo/web typecheck`/`lint`/`test`
      clean throughout.

#### PR 1.5 — Admin screens and actions (`apps/web/app/(admin)/admin/`) — **shipped 2026-09-05**

- [x] `_components/admin-shell.tsx` — new `navContent` entry "Website"
      (`icon: "website"`, `Globe`) gated on `["cms.pages.view",
"redirects.manage"]`, pointing at `/admin/website`.
      `website/page.tsx` redirects to `website/pages` until Phase 3 builds
      the Overview.
- [x] `website/pages/page.tsx` — `AdminPage` + the shared `SubNav` as tabs
      **Pages · Designs · Global · Redirects** (Designs and Global render a
      catalog empty-state until Phases 5/6 — the IA is stable from day
      one). **Simplification from the plan's literal wording:** the list
      uses the shipped `Table` primitives (`@repo/ui/components/table`),
      not the full `DataTable`/TanStack column-def machinery — Phase 1 has
      no sorting or column-visibility requirement, and a plain table is
      less code to get right under this phase's real time budget. Same
      `rows` shape either way, so upgrading to `DataTable` later (Phase 3,
      alongside real pagination) doesn't touch the server component.
      Columns: title (links to detail), path, status + unpublished-changes
      badge, row actions (edit, duplicate, soft delete). `NewPageDialog`
      (title, slug auto-derived from title until touched, create) — "Start
      from" is Phase 3.
- [x] `website/pages/[id]/page.tsx` + `page-editor.tsx` — locale switcher
      over a translation panel (title, slug, **live path preview** via
      `previewPagePathAction`, a debounced read action wrapping
      `previewPagePath()`, PR 1.3's read-only path-derivation helper; SEO
      title/description/canonical); page-level fields (parent — STATIC
      pages excluding self —, group, visibility, active) gated on
      `cms.pages.update`; a status bar with **Publish / Unpublish** (gated
      on `cms.pages.publish`) and a **Preview** link to `/api/preview`.
      **Not built this PR:** the versions list and Rollback control (the
      service function `rollbackPage` and its action exist; the UI panel
      is deferred to land with Phase 3's Versions panel, since a
      one-entry list — Phase 1 never publishes twice before this screen
      existed — has nothing to show yet). The composer is Phase 3; this
      screen never shows layout JSON.
- [x] `website/redirects/page.tsx` + `redirect-controls.tsx` — a plain
      table (from, to, status code, active toggle) + `NewRedirectDialog`,
      gated on the seeded `redirects.manage`.
- [x] `_actions/cms-page-actions.ts` — `createPageAction`,
      `updatePageMetaAction`, `savePageTranslationAction`,
      `duplicatePageAction`, `setPageDeletedAction`, `publishPageAction`,
      `unpublishPageAction`, `rollbackPageAction`, `previewPagePathAction`
      (read), `loadPageDetailAction` (read); `_actions/redirect-actions.ts`
      — `createRedirectAction`, `setRedirectActiveAction`. Each:
      `requirePermission()` first line → `@repo/contracts` parse →
      `@repo/core/cms` (the `article-actions.ts` shape). No
      `setPageParentAction` — reparenting goes through
      `updatePageMetaAction({ parentId })`, one action for every
      page-level field, matching `updateArticleMetaAction`'s shape.
- [x] Two `@repo/core` additions this PR needed and PR 1.3 didn't yet have:
      `loadPageDetail()` / `listParentCandidates()` (`pages.ts`) and
      `previewPagePath()` (`translations.ts` — computes the derived path
      for a **candidate** slug the admin is typing, not the last-saved one,
      which is what makes it a _live_ preview).
- [x] Catalog: 31 new keys under `admin.*` in all four locales (`website`,
      `websitePages/Designs/Global/Redirects`, `newPage`, `pagePath`,
      `pageParent`, `noParent`, `publish`, `unpublish`, `restoreVersion`,
      badges, confirm dialogs, redirect labels, empty-state copy) — reused
      ~25 existing keys (`save`, `titleLabel`, `slugLabel`, `visibility*`,
      `active`, `edit`, `duplicate`, `softDelete`, `confirm`, `cancel`,
      `translations`, …) rather than duplicating them. No literals; logical
      properties only; no hex.
- [x] Tests: permission-denied is asserted **at the service level** in PR
      1.3 (no row written); `pnpm --filter @repo/web lint`/`typecheck`
      clean (`next typegen` regenerated `PageProps` for every new route);
      `check:permission-keys`/`check:phantom-deps`/
      `check:catalog-completeness` all green.
- [x] **Manual, authenticated verification** (no Playwright harness):
      signed in as the seeded admin against a running dev server
      (`POST /api/auth/sign-in/email` → session cookie), then with that
      cookie: `GET /admin/website` → 200 (redirects to `/pages`);
      `/admin/website/pages` → 200, rendered the empty state ("No pages
      yet", tabs, New Page button) correctly; `/admin/website/redirects`
      → 200, rendered its form labels; created a draft page directly,
      confirmed `/admin/website/pages/{id}` → 200 with the correct title,
      path, Draft badge, Publish button, Parent/Visibility fields, and that
      the page appeared in the list screen. No server errors in the dev
      log across any of it. Cleaned up afterward. **One environment gap
      found and fixed, not a code defect:** the repo's own
      `SEED_ADMIN_PASSWORD` was empty (dev-only, per security.md #10), so
      no admin account existed to sign in with; a temporary local password
      was set in the gitignored `.env` to seed one for this verification —
      it now exists for the owner's own continued local testing too.

#### PR 1.6 — Governance close-out — **shipped 2026-09-05**

- [x] DEVLOG entries for every PR (1.1–1.5), each with real test output and
      anything unverified stated plainly (no Playwright harness yet — every
      PR that needed end-to-end proof used manual verification against a
      running dev server instead, and says so).
- [x] `claude.md` module index → "Phase 1 complete"; `docs/plan.md` Module
      16 gained a dated status paragraph naming what shipped and what's
      next.
- [x] No ADR needed. Everything found while coding (the required-vs-
      optional catch-all, the route-handler-touching-Prisma draft, the
      `Table`-vs-`DataTable` and no-versions-panel scope cuts, the
      `ContentReference` compound-unique addition) is a correction to how
      an already-decided architecture was implemented, not a reversal of a
      decision — matching Part F #10's actual test ("does this contradict
      a locked decision", not "did anything change while coding").

**Phase 1 is complete.** Six PRs, ~35 new/changed files across
`packages/db`, `packages/contracts`, `packages/core`, and `apps/web`.
164/165 tests green in `@repo/core` (one unrelated pre-existing Module 02
failure, flagged to the owner separately, not fixed here — out of
Module 16's scope). Every acceptance criterion in the table below is
demonstrated. Phase 2 (`@repo/blocks`, the two-pass renderer, the homepage
migration behind a fallback switch) is next.

#### Acceptance → test traceability

| Criterion (unchanged from v2.1)                                                                                                                                                                                                                                                                                                                                 | Proven by                                                                                                                                                      | PR       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Admin creates "About" with an EN slug → `/about` renders the title                                                                                                                                                                                                                                                                                              | `pages.integration` (create + resolve) + manual journey in the DEVLOG                                                                                          | 1.3, 1.5 |
| Unpublish → 404                                                                                                                                                                                                                                                                                                                                                 | `publish.integration` (`resolvePublicPage` → not-found)                                                                                                        | 1.3      |
| Slug change → old path 301s                                                                                                                                                                                                                                                                                                                                     | `pages.integration` (redirect row) + `resolvePublicPage` → redirect                                                                                            | 1.3      |
| Child under "Tools" resolves at `/tools/<slug>` and follows a parent slug change with a redirect                                                                                                                                                                                                                                                                | `pages.integration` nested-path cases (the §5.1 examples)                                                                                                      | 1.3      |
| Two autosaves on the same base `revision` → the second is refused                                                                                                                                                                                                                                                                                               | `versions.integration`                                                                                                                                         | 1.3      |
| Publishing page A does not flush page B's cache                                                                                                                                                                                                                                                                                                                 | `publish.integration` against the recording cache stub                                                                                                         | 1.3      |
| Every mutation has an audit row                                                                                                                                                                                                                                                                                                                                 | asserted in every integration suite                                                                                                                            | 1.3      |
| A user without `cms.pages.publish` cannot publish (DB-level)                                                                                                                                                                                                                                                                                                    | `publish.integration` (`ForbiddenError`, no snapshot row)                                                                                                      | 1.3      |
| Reserved paths match the route files                                                                                                                                                                                                                                                                                                                            | `check:reserved-paths`                                                                                                                                         | 1.2      |
| Migration applies from zero; `home` seeded once and unchanged on reseed                                                                                                                                                                                                                                                                                         | `db.integration` (`migrate deploy` in `beforeAll`; seed-idempotency + `home` shape cases) — **green 2026-09-05**                                               | 1.1      |
| DB-level invariants: `(locale, path)` unique, `(pageId, number)` unique, `path LIKE '/%'`, non-negative `number`/`revision`, no duplicate `ContentReference`                                                                                                                                                                                                    | `db.integration` "CMS page model" cases — **green 2026-09-05**                                                                                                 | 1.1      |
| Contracts round-trip; `derivePagePath`/`publicPagePath` match the §5.1 examples; reserved paths match the route files                                                                                                                                                                                                                                           | `@repo/contracts` cms suites (83/83) + `check:reserved-paths` (OK) — **green 2026-09-05**                                                                      | 1.2      |
| Nested path under "Tools", reparent cascade, shadow-redirect deactivation, cycle/depth guard, duplicate independence, delete guard, optimistic lock, publish snapshot + isolation, unpublish/rollback, permission denial at the service level, every mutation audited                                                                                           | `@repo/core` cms/* integration suites — **164/165 green 2026-09-05** (unrelated pre-existing failure noted above)                                              | 1.3      |
| Public route serves a published page at its derived path with correct title/metadata; reserved paths and non-existent pages 404; a page missing a locale's translation 404s in that locale; the preview link works through `requirePermission` + draft mode; the sitemap includes published pages; `/admin/website` stays STAFF-gated and never locale-prefixed | `apps/web` `proxy.test.ts` (12/12) + **manual create→publish→HTTP round trip against a running dev server** — **green 2026-09-05** (no Playwright harness yet) | 1.4      |
| Admin creates a page from the Pages list, edits its title/slug/SEO per locale with a live path preview, sets parent/group/visibility, publishes/unpublishes it, and sees it 200 at its address; the Redirects screen lists and creates rows                                                                                                                     | **Manual, authenticated verification against a running dev server** (signed in as the seeded admin) — **green 2026-09-05** (no Playwright harness yet)         | 1.5      |

**E2E, stated plainly:** there is no Playwright configuration in the
repository (every module's E2E is deferred). Phase 1's user-visible journey
is executed by hand and recorded in the DEVLOG; the Playwright journey for
it is written when Module 14 wires the harness, and Phase 3's authoring
journey is the first E2E this module owns. Do not claim E2E coverage in
the DEVLOG before the harness exists.

### Phase 2 — `@repo/blocks`, renderer, and the homepage migration

`defineBlock` + registry + versioning/migration; `renderTree` **with the
two-pass collect → resolve → render pipeline and the need-dedupe in place
from the start** (ADR-029 — retrofitting it after blocks fetch inline is a
rewrite, so it lands before there is anything to retrofit);
**the node envelope and style/responsive contracts of ADR-032** (label,
hidden, anchor, style presets slot, responsive values, backgrounds incl.
overlay gate, class lookup tables, pure `/definitions` subpath);
**the `LinkTarget` contract and resolver** (ADR-031) with menus switched
to it; **the generic `widget` block and `WidgetDefinition`/`WidgetRuntime`
contracts** (ADR-030) with an empty registry; layout/content block set
(§6.2 first two groups, incl. `video`, `table`, `tabs`, `breadcrumb`) as
wrappers over `@repo/ui`; token-only style plumbing + motion enums (ADR-024
§1–2); `FallbackBlock`; JSON fixtures per block; **`home.sections` → the
`home` STATIC page** (hero CTA and `header.cta` become `LinkTarget`s),
rendered **behind a fallback switch** in `[locale]/page.tsx` — the CMS
page when published, else today's section registry. Parity in this phase
covers the four **static** sections (`hero`, `newsletter`, `faq`,
`risk_disclaimer`); the two dynamic ones (`latest_analysis`,
`glossary_spotlight`) migrate in Phase 4 with the `collection` block, and
only then are the setting and `check-home-sections` retired (§3.2).

**PR breakdown**

- [x] **2.1 Package scaffold** — `packages/blocks` (`package.json` with
      `@repo/ui`, `@repo/contracts`, `lucide-react` — `@repo/i18n`/`@repo/theme`
      omitted, unused so far; `react-library` tsconfig; eslint combining
      `noColorLiteralRule`/`noPhysicalSpacingRule` (the latter newly exported
      from `react-internal.js` for this purpose) + a `no-restricted-syntax`
      rule for template literals inside `cn()`/`className`; exports `.`,
      `./definitions`, `./render`); `check:phantom-deps` green.
- [x] **2.2 Node contracts** — `@repo/contracts/src/cms/{style,responsive,
links,widgets}.ts` (block `<type>.ts` prop schemas live beside each
      block in `@repo/blocks` instead, alongside `definition.ts` — see PR
      2.4); tests: no schema accepts `/^#[0-9a-f]{3,8}$/i`, `LinkTarget`
      refuses relative internal URLs, `image|video` backgrounds require
      `overlay` (+ `posterAssetId`). 46 new tests.
- [x] **2.3 Registry + renderer** — `defineBlock`, `registry.ts`, `migrate`
      chains, `render.tsx` with `RenderContext { locale, draft, isVisible,
resolveNeeds, resolveLinks, resolveMediaUrl, widgets, onWarning }` (no
      `subject`/`presets` — visibility and preset resolution are injected as
      functions, not raw data, to keep `@repo/blocks` fully decoupled) and the
      three passes; need + link collection and dedupe; `FallbackBlock`;
      `styles/tables.ts` literal class tables. Tests: determinism, 3 identical
      needs → 1 resolution, migrations, hidden skip, unknown type, link
      resolution states — 13 tests, 5 proof blocks (section/container/heading/
      paragraph/button). **classes-exist still open** — the DEVLOG's open item
      carries forward again, deferred to whenever a real Tailwind CLI build
      step is worth adding.
- [x] **2.4 Layout + content blocks** — all 24 of the §6.2 first two
      groups (not a subset); per block: `definition.ts`, `index.tsx`,
      `fixture.json`, a light/dark render test (one consolidated
      `fixtures.test.tsx`, not 24 files — see DEVLOG), an axe-fixture entry in
      the new `axe-fixture.tsx`; `scripts/check-block-fixtures.mjs` + root
      script, wired into `ci.yml`. `video`'s embed source deferred to Phase 3
      (Media v2/ADR-034); `breadcrumb` is a `needs`-driven block with no live
      provider yet.
- [x] **2.5 `widget` block + contracts** — `WidgetDefinition`/
      `WidgetRuntime` (moved to `packages/blocks/src/widgets.ts`, not
      `@repo/contracts` — see DEVLOG for why), the generic block,
      `apps/web/app/_cms/registry.ts` with an **empty** widget map; 6 ADR-030
      compliance tests. No React `<Suspense>` boundary (deliberate — see
      DEVLOG; the two-pass pipeline resolves data before `Render` ever runs).
- [x] **2.6 `LinkTarget` resolver** — `packages/core/src/cms/links.ts`
      (`URL`, `ROUTE`, `PAGE`, `MEDIA`, `ANCHOR`, `NONE` now; entity types
      resolve to `missing` until their providers land in Phase 4);
      `buildNavigation`'s `resolveHref` shares the stateless half
      (`resolveStatelessLinkTarget`) rather than becoming async itself —
      `assembleNavigation` stays the pure, synchronous function ~20 existing
      tests exercise directly (see DEVLOG); `collectReferences()` now reads a
      real layout tree via `@repo/blocks/definitions` and learns links, media,
      presets, widgets (card templates watch for the conventional prop key,
      ready for Phase 4). 35 new tests.
- [x] **2.7 Homepage migration** — seed publishes the four static
      `home.sections` entries as blocks (hero CTAs as `LinkTarget`s); the
      `home` page is published by the seed; `[locale]/page.tsx` gains the
      fallback switch. **Snapshot parity was not machine-verified** — no
      Playwright/visual-snapshot tooling exists in this repo (unchanged since
      Phase 1) — verified instead against a real running dev server end to
      end (content, resolved CTA hrefs, the `/es` fallback path, admin Pages
      screen showing Published). The hero's decorative image is dropped
      (`centered` variant, not `split` — no `MediaAsset` exists for it; see
      DEVLOG). The CMS homepage is missing `latest_analysis`/
      `glossary_spotlight` until Phase 4 — accepted, no production deploy
      exists yet (§5.2).

**Accept:** the homepage renders from a `PageVersion` behind the switch,
and its four static sections are visually identical to the settings-driven
version (snapshot, light+dark, ltr+rtl); a block version bump with a
`migrate` renders an old fixture
correctly; an unknown block type — and an unknown `widgetKey` — renders
nothing in production and a named warning in preview; a hidden node is
skipped; an image background with a heading and no overlay is refused by
the gate; every emitted class exists in the built CSS; a page button to an
unpublished page renders as static text; the renderer suite runs **with no
database**.

### Phase 3 — Composer, preview, translations (+ Puck spike)

Composer UI (§8, in full): tree/layers panel, block picker with search /
recently used / "Start from", add/remove/reorder/duplicate/copy/paste/
hide/label/anchor, undo/redo, settings panel with Responsive tab and device
toggle, autosave + `revision` lock, gates on autosave, Data panel + budget
meter, locale switcher with status dots, **Versions panel** (preview,
restore as draft), **Translations tab**; draft-mode preview at three
widths; SEO fields with suggestions; publish gates (§10) wired into
`publishPage()`.

**`StylePreset` + `LayoutTemplate` (ADR-033):** models, services,
`/admin/website/styles` and `/admin/website/templates`, "Use style" /
"Save as style" / "Save as template" / "Start from" in the composer, seeded
system rows (six styles; Landing / Tool page / Legal / Contact / Blank page
templates), usage counts and deletion guards over `ContentReference`.

**Media v2 (ADR-034) — a hard dependency of this phase, delivered inside
it.** `storeMedia()` for the four kinds, Range serving, `MediaAsset`
metadata, replace-in-place, guarded soft delete, and the `MediaLibrary`
component hosted at `/admin/website/media` and as the composer's picker.
There is no "minimum picker": a composer where an admin can design a page
but cannot upload, find and reuse an image or a video is not a usable
composer. Deferred with a DEVLOG note: bulk operations, focal point,
generated image variants.

**In parallel:** the 2-day Puck spike and its follow-up ADR (ADR-026).

**PR breakdown**

- **3.1 Reuse models** — **shipped 2026-09-05.** `StylePreset`,
  `LayoutTemplate` (+ `LayoutTemplateKind`)
  migration; `@repo/contracts/src/cms/{styles,templates}.ts`;
  `core/cms/{styles,templates}.ts` (CRUD, usage counts and deletion guards
  over `ContentReference`); seed six system styles and the five page
  templates; `cms.styles.manage`, `cms.templates.manage` seeded;
  `/admin/website/{styles,templates}` screens; tests per ADR-033
  (propagation, copy independence, guards).
- **3.2 Media v2** — **shipped 2026-09-05, with one item incomplete.**
  `MediaKind` + the `MediaAsset` columns (defaults carry
  existing rows, §5.2); `storeMedia()` with `storeImage()` as a wrapper;
  `/uploads/[file]` HTTP Range; `replaceMedia()`, `updateMediaMeta()`,
  `deleteMedia()` (soft, guarded); `media.maxBytes.{kind}` settings seeded;
  **`media.view` and `media.update` seeded**; the `MediaLibrary` component
  (`(admin)/admin/website/media/_components/`) hosted at
  `/admin/website/media` and as the picker; `_actions/media-actions.ts`
  extended. **Follow-up, same day (ADR-035):** `syncReferences()` wired
  into Article (cover image + per-locale OG image) and BrandAsset (logo/
  favicon) — the two of the four named consumers with a real write path.
  Setting (`site.faviconUrl`/`seo.defaultOgImage`) and MenuItem/Course
  stay deliberately unwired: Settings' generic `Json` value shape costs
  more to change than two keys justify, and MenuItem/Course have no write
  path yet to hook into. See ADR-035 and DEVLOG 2026-09-05 for the full
  reasoning. ADR-034 compliance tests in place for the two wired
  consumers; Setting/MenuItem/Course's absence is asserted by ADR-035's
  text, not silently implied by an untested path.
- **3.3 Composer core** — **shipped 2026-09-05.** `website/pages/[id]/
builder/` (`_builder/`): tree/layers panel, block picker (search,
  grouped, "Start from" a saved section/block), settings panel generated
  from `fields` (General · Style · Motion · Visibility · Responsive — no
  block-level SEO tab, page-level SEO already covers it and no `fields`
  entry needs one), add/remove/duplicate/copy/paste/hide/label/anchor,
  undo/redo, autosave with `revision` + a conflict toast, a locale
  switcher, "Use style / Save as style / Save as template". **Deviation
  from this line item, named and reasoned in DEVLOG:** reorder is
  up/down buttons, not drag — `/admin/navigation`'s own code (checked
  before building on it) only has up/down buttons and no drag-and-drop
  dependency exists anywhere in this repo, so the plan's "as
  `/admin/navigation` already does" was inaccurate; matched the real
  precedent instead of introducing a new dependency on a false premise.
  "Replace with…" is not built; entity `LinkTarget`s (ARTICLE/COURSE/
  GLOSSARY_TERM/etc.) aren't offered by the link editor yet (URL/ROUTE/
  PAGE/ANCHOR only); "recently used" in the picker isn't built. Two
  prerequisites this PR also closed: the catch-all public route now
  calls `renderTree` for real (was a Phase-1 placeholder), and
  `RenderContext.resolveMediaUrl` became a real batched
  `resolveMediaUrls` now that Media v2 (PR 3.2) exists. Verified against
  the real seeded homepage (4 real sections, including the FAQ block),
  not just a scratch page.
- **3.4 Gates + budget** — **shipped 2026-09-05.** `cms.dataBudget`
  setting seeded and validated (ADR-029 §5's own numbers,
  `block ≥ warn` enforced by the schema). `runPublishGates` moved to
  `packages/core/src/cms/gates.ts` and became async (two checks read the
  DB): heading order, the ADR-032 §2 overlay gate, missing style
  reference, and the budget's block threshold all BLOCK; the budget's
  warn threshold, empty translatable props in a published locale,
  duplicate anchors, and depth > 3 all WARN. **Two checks named as not
  implemented, not faked:** dangling `bindingId` and a missing card
  template both need a Phase 4 model that doesn't exist yet; the budget
  count is real and wired but has nothing to count until Phase 4
  registers a `category: "collection"` block, and can never see the
  app's widget registry from `@repo/core` (architecture.md #8) — a
  permanent limitation, not a TODO. "A `LinkTarget` typed as a relative
  internal URL" needed no active check: `externalUrlSchema` already
  refuses a non-absolute URL at the contract layer, so this case cannot
  occur under the current schema. Composer's gate hook (wired in PR 3.3)
  now shows real results — verified live: a heading-order violation
  appeared in the gate panel within one autosave cycle and cleared on
  the next. The Data panel + budget meter ships as a toolbar indicator
  ("Dynamic collections: N / block"), not a separate panel — sufficient
  for what there is to show today (always 0 until Phase 4).
- **3.5 Preview, versions, translations** — **shipped 2026-09-05.** A
  device-width toggle (375/768/1440) above the composer's existing live
  preview; Versions panel (publish history with resolved author names,
  "Restore as draft" per version, "Discard draft"); Translations panel
  (every string-typed translatable field × every non-default locale, with
  MISSING badges and inline editing) reading and writing
  `node.translations`. **Deviations named and reasoned in DEVLOG:**
  "preview any version through draft mode" scoped to restore-then-preview
  — a true version-parameterized preview needs `/api/preview` and the
  public route to accept a version number instead of always reading the
  mutable draft, real separate plumbing not built here; the Translations
  panel shows MISSING only, not OUTDATED (no source-hash mechanism exists
  on the node envelope to detect a stale translation). `restoreVersionAsDraft`/
  `discardDraft` deliberately bypass the ADR-032 §6 optimistic lock —
  one-shot explicit admin actions, not a concurrent-editing race. Verified
  against the real seeded homepage, including a full sign-out/reload
  round-trip proving a translation edit persists server-side.
- **3.6 SEO** — **shipped 2026-09-05.** `buildPageSeo`
  (`packages/core/src/cms/seo.ts`, pure tree-walking, no DB): explicit
  `PageTranslation` SEO fields win, otherwise title/description/OG image
  are suggested from the page's own first heading/paragraph/image
  (locale-aware, same translation-merge order as the renderer). JSON-LD
  (`WebPage` by default, or an admin-set `schemaType`) on both the
  catch-all route and — a real pre-existing gap opportunistically closed —
  `[locale]/page.tsx` (Home), which had no CMS-driven metadata at all
  despite `home` being a real `PageTranslation` row since Phase 1. **Named
  scope cut:** hreflang alternates (plan §9 prose, not the PR bullet) need
  a `PublicPageRow` lookup change not built here. Verified against the
  real seeded homepage and a scratch static page (both suggestion and
  explicit-override paths, via `curl` against the live server).
- **3.7 Puck spike** — **shipped 2026-09-05, resolved reject (ADR-036).**
  4 of 5 ADR-026 gates pass cleanly or with only a named, containable
  future CSP risk (a canvas-iframe CSS-mirroring helper creates an
  un-nonced `<style>` tag — irrelevant under today's report-only,
  nonce-less public CSP); the fifth (real render fidelity against this
  repo's `fields` vocabulary) is the one thing a single-session spike
  can't verify without installing Puck, which ADR-026 forbids before this
  ADR exists. Correction to the record: Puck's real `latest` is 0.20.2,
  not "0.23.x." No code merged, no dependency added — `git status`
  confirms zero trace in `package.json`/`pnpm-lock.yaml`. Not a permanent
  rejection: the composer already delivers everything ADR-026 asked of
  it and nothing later in this plan depends on a canvas, so revisiting is
  optional, gated on a real future product need.

**Accept:** an admin builds a new static page end to end — start from the
Landing template, add blocks, reorder in the tree, **upload an image and a
video and place both**, set a hero image background with a dark overlay,
apply a style preset then save a variant as a new one, set two-column →
one-column on mobile, add an EN + ES translation in the Translations tab,
preview at 375/768/1440, publish, then restore the previous version as a
draft — with no developer involvement; replacing the image updates the
page; deleting it is refused with the page named; a page with a skipped
heading level is refused at publish with the block named; a user without
`cms.pages.publish` cannot publish (asserted at the DB level); undo
reverts the last change and autosave persists the reverted state.

### Phase 4 — Collections: providers, generic filters, card templates

`CollectionProvider` registry + `news`/`analysis`/`glossary` providers over
existing services; collection block set with `bindingId` binding and URL
params (ADR-022 §4); `CardTemplate` model + library + seeded system
templates matching today's `standard`/`featured`/`compact`/`horizontal`;
`/news` becomes a COLLECTION page **behind a fallback switch** — the route
renders the CMS page when one is published, else today's composition.

**PR breakdown**

- **4.1 Providers** — **shipped 2026-09-05.**
  `@repo/contracts/src/cms/providers.ts` (`CollectionItem`,
  `CollectionProvider`, `DataProvider`, `CollectionQuery`, filter/sort
  descriptors, `buildCollectionSearchSchema` with the request-side caps
  `limit ≤ 24`, `page ≤ 200`); `core/cms/providers/{news,analysis,
trade-idea,glossary}.ts` composing `public-articles.ts`/
  `public-content.ts` (never re-deriving `publicArticleWhere`); the
  registry assembled in `apps/web/app/_cms/registry.ts`
  (`collectionProviders`); the conformance suite (9 tests) including the
  "equals `getPublishedArticles`" test. `ProviderContext` is a minimal
  `{locale}` shape rather than ADR-022's illustrative full `RenderContext`
  — avoids `@repo/contracts` depending on `@repo/blocks` backwards;
  `RenderContext` structurally satisfies it. No premium-item filtering
  added: `Article.isPremium` is enforced nowhere on the public site today,
  and `FeatureVisibility.PREMIUM` means staff-only here (ADR-012) — not
  a paid-subscriber tier — so conflating them would have been wrong, not
  just incomplete; the real visibility rule (a gated block never reaching
  an unauthorized subject) is already enforced upstream by the renderer.
  `resolveNeeds`/`RenderContext` untouched — nothing produces a real
  `BlockDataNeed` until PR 4.2's `collection` block exists to do it.
- **4.2 Collection blocks** — **shipped 2026-09-05.** `collection`,
  `featured-content`, `collection-filter`, `collection-search`,
  `collection-sort`, `collection-pagination`; a real Pass 0 in
  `render.tsx` (`collectBindings`) resolves each `collection`/
  `featured-content` node's canonical query via a new injected
  `RenderContext.resolveBindingQuery` (implemented in `apps/web/app/_cms/
render-context.ts`, the only place a provider's real filter/sort
  vocabulary is reachable) and hands it to every node as `ctx.bindings` —
  so a `collection-pagination` sharing a `bindingId` dedupes onto the same
  resolved result via the existing `needKey` mechanism, with no
  provider-specific knowledge baked into `@repo/blocks`. Per-need caching:
  `"use cache"` + `cacheTag("content")` + `cacheLife(300)`, keyed by Next's
  own argument-identity caching. The dangling-`bindingId` gate is a WARN
  (`gates.ts`'s `checkDanglingBindingId`), matching ADR-022 §4's exact
  wording. **Two real, live-browser-only bugs found and fixed:** a
  `"use client"` block's `registerBlock()` call never reaches the
  server-side registry (Next doesn't run a client file's top-level code
  server-side) — fixed by splitting each interactive block into a server
  `index.tsx` + a `client.tsx`; and a function-valued prop
  (`resolveMediaUrl`/`widgets`) crashes any client component even if
  unused — fixed with a new `BlockDefinition.client` flag so `render.tsx`
  omits them entirely for client blocks. `collection-search`/`-sort`/
  `-filter` are pure client controls (`window.location`, never
  `next/navigation` — `@repo/blocks` has zero Next.js dependency) with no
  live data; `collection-pagination` is the one exception needing live
  `total`/`limit`, since a wrong page count is a real bug. Named
  trade-off: pagination links are `onClick` handlers, not crawlable
  `<a href>`s. Verified live end to end: a real published article
  ("USD Rallies on Strong CPI Report") rendering through a `collection`
  block, and a real search query narrowing/clearing results on the
  published public route in a cookie-isolated browser context.
- **4.3 Card templates** — **shipped 2026-09-05.** `CardTemplate` model +
  migration; `cardConfigSchema` (+ `version`); `core/cms/cards.ts`
  mirroring `styles.ts`'s exact deletion-guard shape (`ContentReference`,
  `refType: "CARD_TEMPLATE"` — an enum value and a `references.ts`
  extraction case both already existed from Phase 2, needing no change);
  resolution tagged `card-template:{id}` via `getCardTemplateConfig`,
  invalidated by `updateCardTemplate`'s `revalidateTag`; 4 seeded system
  templates (`standard`/`featured`/`compact` checked field-for-field
  against `article-list.tsx`'s real variants; `horizontal` built new, no
  precedent existed); `cms.cards.manage`; `/admin/website/cards` with a
  real live preview (a new `@repo/blocks` `./card` export so the admin
  screen calls the exact `renderCard()` the public renderer uses).
  `collection`/`featured-content` bumped to schema v2 (`cardTemplateId`,
  optional) and now render through one shared `card/render-card.tsx`
  instead of each block's own hardcoded markup. Verified live: switching
  a real collection block's `cardTemplateId` between two seeded templates
  re-rendered two real published articles into completely different
  layouts instantly.
- **4.4 `/news` as a COLLECTION page** — page seed at
  `CONTENT_ROUTES.news`; `news/page.tsx` fallback switch; snapshots at
  1440 and 390 before/after; back-navigation test.
- **4.5 Homepage completion** — `latest_analysis` and `glossary_spotlight`
  become `collection` blocks in the `home` seed; full parity snapshot;
  **retire `home.sections`, `_sections/registry.ts`, `check-home-sections`**
  in this PR.
- **4.6 Entity links** — `ARTICLE`, `ARTICLE_CATEGORY`, `ARTICLE_TAG`,
  `GLOSSARY_TERM` in `links.ts` through the providers; slug-change /
  unpublish / leak / query-count tests from ADR-031.

**Accept:** `/news` renders from the CMS with the same visual result as
today (snapshot at 1440 and 390, the two widths the DEVLOG verified);
category/search/pagination work through the URL and survive back-navigation;
editing the "standard" card template updates the listing **and** the
homepage's latest-analysis section in one request cycle; the provider
conformance suite passes for every provider; a logged-out probe never sees a
premium item.

### Phase 5 — Detail pages

`DETAIL` page kind wired into `/news/[slug]`; detail block set
(`content-hero`, `content-body`, `content-meta`, `author-card`, `share-row`,
`content-tags`); `related-content` with the strategy enum; SEO/JSON-LD from
the item; `layout:{contentType}` invalidation.

**PR breakdown**

- **5.1 DETAIL kind** — `Page{ kind: DETAIL, contentType }` creation rules
  (one active per content type, no translations' paths); `ctx.item` from
  `provider.bySlug`; `layout:{contentType}` read + invalidation; the
  **Designs** tab comes alive; seed the `news` DETAIL page reproducing
  today's article layout.
- **5.2 Detail blocks** — `content-hero`, `content-field`, `content-body`,
  `content-meta`, `author-card`, `share-row`, `content-tags`,
  `related-content` (`SAME_CATEGORY | SAME_TAGS | SAME_AUTHOR | MANUAL`);
  `news/[slug]/page.tsx` fallback switch; JSON-LD `NewsArticle` from the
  item; snapshots before/after.
- **5.3 GT2 — courses** — `course` provider + descriptors + a seeded card
  template + two page seeds (COLLECTION at `CONTENT_ROUTES.course =
/courses`, DETAIL); the `courses/` route directory (`page.tsx` hosting the
  COLLECTION page, `[slug]/page.tsx` hosting the DETAIL page) — `courses`
  moves from `RESERVED_PREFIXES` to `RESERVED_PATHS` in the same PR;
  `COURSE` in `links.ts`; the DEVLOG lists the diff and asserts it contains
  no block, renderer or composer change.

**Accept (end-to-end, the milestone that proves the architecture):** publish
an article in the existing News module → it appears in the homepage
section and on `/news` and renders at `/news/{slug}` through the
admin-designed detail page with correct metadata and JSON-LD; changing that
detail design changes every article at once with no deploy; **no article
data is duplicated into CMS tables**; ADR-015's visibility rule is still the
only gate on what is visible.

**Accept (GT2 — the genericity proof):** a course listing page and a course
detail page are composed in the builder, and the entire diff needed to get
there is **a provider, its filter/sort descriptors, a seeded card template
and two page seeds** — no new block type, no renderer change, no composer
change. If that diff contains a block or a builder change, stop and fix
ADR-022's contract before Phase 6.

### Phase 6 — Global Website & Navigation Builder (ADR-027 / ADR-028)

**Size this honestly: it is a module, not a polish pass** — the
second-largest phase in the plan after Phase 4. It contains a header
builder, a footer builder, a mega-menu panel system, the announcement and
top-bar systems, mobile navigation, the menu entity resolver, dynamic shell
data, responsive behaviour, keyboard accessibility across the whole site
shell, and a performance budget. Anyone scheduling it as "the last bit
before MVP" will be wrong by a wide margin.

`PART` page kind + the three override columns; part block set; shell
behaviour enums + the `HeaderShell` scroll leaf; seeded header and footer
presets **generated from today's settings**; `menu-panel:*` parts with
collection support; `MenuItem` extended to polymorphic targets, dynamic
children and panel references, with the Module 08 contract test rewritten to
the new matrix and existing rows backfilled; announcement scheduling;
`/admin/website/global` screens.

**PR breakdown**

- **6.1 PART kind + overrides** — `PageKind.PART`; `Page.headerPartId` /
  `footerPartId` / `announcementPartId`; reserved part keys; the
  `layout.headerPartKey` / `footerPartKey` / `announcementPartKey` default
  settings; the resolver `page.override ?? setting ?? shipped component`
  with all three paths tested.
- **6.2 Part blocks + shell props** — the ADR-027 §3 block set; the root
  prop schemas (`header`, `footer`, `announcement`); the `HeaderShell`
  client leaf (`data-scrolled` via IntersectionObserver, reduced-motion
  gated); class tables for every enum.
- **6.3 Presets from settings** — `LayoutTemplate{PART}` rows seeded for
  the header and footer presets **generated from today's `header.*` /
  `footer.*` settings**; the `header` / `footer` / `announcement` PART pages
  seeded and published from the same values.
- **6.4 Grouped resolution** — one cached call per `(partKey, locale,
tier)` tagged `part-data:{key}` with per-part `cacheLife`; provider
  `listMany` seam; the **zero-query shell** test, the isolation test
  (`content` does not flush `part-data:*`), the part budget.
- **6.5 Menus** — `MenuItem.linkType` / `targetId` / `dynamicSource` /
  `iconType` / `badgeKey` / `panelPartKey` (+ `MenuLinkType`); the
  migration carries the one-statement backfill (§5.2); the Module 08
  contract test rewritten to the matrix; dynamic children (`≤ 8`) through
  providers; `menu-panel:{slug}` parts rendered from `panelPartKey`;
  `/admin/navigation` extended with the link picker.
- **6.6 Global screens** — the **Global** tab: header / footer /
  announcement / top bar / mobile nav / panels, "Apply preset" (Start from),
  the staleness window shown in the part editor, announcement `startsAt` /
  `endsAt` evaluated inside `cacheLife 300`.
- **6.7 Parity and cut-over** — snapshot parity at 1440/390, both modes,
  both directions; axe fixture with a mega panel; keyboard/escape/focus
  assertions; Lighthouse route with a panel collection; the shipped
  components stay as the fallback until every check is green.

**Accept:** the shipped header and footer are reproduced by seeded presets —
snapshot-identical at 1440 and 390, light and dark, ltr and rtl — **before**
any fallback is removed; the homepage renders a transparent header that goes
solid on scroll while `/news` stays solid, from per-page overrides;
a mega-menu panel renders **a live News column and a Featured Courses column
together** — resolved as one grouped cached call, one entry for the whole
site — and is fully keyboard operable (axe + E2E, escape closes, focus
returns); rendering `/about` with a warm cache makes **zero provider calls
from the shell**; publishing an article invalidates `content` but **not**
`part-data:*`; changing an article's slug updates a menu link with no menu
edit; an unpublished target is pruned from the nav rather than rendering a
404 link; exceeding the data budget warns, exceeding its block threshold
refuses with the blocks named; reduced-motion disables the scroll
transition.

**MVP ends here.**

### Phase 7 — Widgets & data (GT3 + GT4)

`packages/widgets` (ADR-030) with granular exports: **calculators** (pip
value, position size, margin — over the pure functions already in
`@repo/utils/calculators.ts`; profit, risk, Fibonacci, swap as they are
specified) and **market** (rates table, converter, ticker) whose `needs`
use the `market.rates` `DataProvider` over `market.ts` (MSW-mocked in
tests); `apps/web/app/_cms/registry.ts` populated; fixtures + axe entries;
`check-block-fixtures` extended to widgets; a `/tools` parent page seeded
with one child page per calculator and a menu item each.

**PR breakdown**

- **7.1 `packages/widgets` + calculators** — package scaffold (deps:
  `@repo/ui`, `@repo/contracts`, `@repo/i18n`, `@repo/utils`,
  `@repo/theme`; exports `./calculators`, `./calculators/definition`);
  `calc.pip`, `calc.position-size`, `calc.margin` over
  `@repo/utils/calculators.ts`; fixtures, axe entries, light/dark tests;
  the definition-purity test.
- **7.2 Market provider + widgets** — `market.rates` `DataProvider` over
  `core/market.ts` (MSW-mocked in tests); `market.rates-table`,
  `market.converter`, `market.ticker` with `needs`; `Skeleton` / `Empty` /
  `Error`; a client leaf polling `app/api/market/rates` for refresh.
- **7.3 Registry, seeds, GT4** — the two lines in
  `apps/web/app/_cms/registry.ts`; the `/tools` STATIC parent and one child
  page per calculator (paths per §5.1); menu items; **the DEVLOG lists the
  GT4 diff** and asserts it touches neither `@repo/blocks`, the composer,
  nor `@repo/contracts/cms`.
- **7.4 Gates for widgets** — `check-block-fixtures` extended; a widget in
  the header resolves inside the part's grouped call (zero-query shell test
  still green); removing a widget from the registry → fallback + Overview
  attention row.

**Accept (GT3):** a rates page is composed in the builder and renders live
data through a widget's `needs` with the provider's own caching; a
malformed provider payload degrades to stale cache, then the widget's
`Error` state, never a 500; no `CollectionItem` shape appears anywhere.
**Accept (GT4):** the Pip Calculator page exists and the diff that produced
it is _the widget export + one registry line + a page seed + a menu item_ —
the DEVLOG lists the files; a second calculator is added by the same recipe;
a widget placed in the header resolves inside the part's grouped call and
the zero-query shell test still passes; a widget's `version` bump with a
`migrate` renders an old fixture; removing a widget from the registry
renders nothing in production, a warning in preview, and a row in the
Overview's attention list.

_(The course provider moved into Phase 5 as GT2. If calculators, rates or
the calendar are needed for the first launch, Phase 7 is inside MVP; the
architecture does not care, only the schedule does.)_

### Phase 8 — Hardening & gate extension (folds into Module 14)

Extend the gates to authored content (ADR-024 §4): combination-contrast
property test, all-blocks axe fixture, Lighthouse budget on the seeded CMS
home and a worst-realistic-page fixture, `check-block-fixtures.mjs`,
learner-session probes on `/admin/website/*`, cache-leak test across
visibility tiers, XSS corpus over block props.

**PR breakdown** — one PR per gate, each adding its CI wiring: (8.1) the
`(background, overlay, textTone)` contrast property test in `@repo/theme`;
(8.2) the all-blocks + all-widgets axe fixture page, light/dark, ltr/rtl;
(8.3) Lighthouse budget on the seeded CMS home, `/news`, a route with a
panel collection, and the worst-realistic-page fixture (max blocks, max
collections, one video background); (8.4) learner-session IDOR probes over
every `/admin/website/*` route and `/api/preview`; (8.5) the cache-leak test
across tiers and orderings; (8.6) the XSS corpus over `rich-text` and every
translatable prop; (8.7) the Playwright harness if Module 14 has not landed
it yet, plus the Phase 3 authoring journey and the Phase 5 publish-an-
article journey as the module's first E2E suites.

**Accept:** every gate in the ADR-024 table is green and blocking;
the launch checklist entry is signed off in the DEVLOG.

### Phase 9 — Reusable sections (**the first post-MVP feature, not an open-ended deferral**)

A "Newsletter CTA" designed once and placed on the homepage, `/news`, the
news detail page, courses and events is the difference between a CMS and a
page duplicator. It is deferred **only because it is cheaper to build once
the block tree, versioning and card-template reference semantics have proven
themselves** — a synced section is the same reference problem `CardTemplate`
solves (ADR-023), one level up, so building it second means building it once.

Scope when it lands: a `Section` entity holding a block subtree, inserted
**by reference** (edit once, every placement updates) with an explicit
"detach to a copy" action; its own ADR covering versioning, what happens to
placements when a section is deleted, and how it interacts with the data
budget.

### Phase 10 — Visual canvas (only if ADR-026's spike passed)

Puck or equivalent, replacing the composer's editing surface without
touching the layout JSON, the services or the renderers.

## 13. Testing

Standard from `.claude/rules/testing.md` applies. Module-specific:

- **Unit** (`@repo/blocks`, no DB): tree validation, migrations per block
  version, locale merge, visibility evaluation, `renderTree` determinism
  (same input → same output), fallback behaviour, **need collection and
  dedupe** (three identical needs → one resolution).
- **Resolution** (ADR-029): grouped part resolution produces one cache entry
  and one batched call; `listMany` and `Promise.all(list)` return identical
  results; **warm-cache render of a non-CMS route makes zero provider calls
  from the shell**; publishing an article invalidates `content` but not
  `part-data:*`; budget warn publishes, budget block refuses with names.
- **Contract** (`@repo/contracts`): layout schema round-trips; **no block
  schema accepts a hex string** (ADR-024 §Compliance); reserved paths match
  the real route files and `RESERVED_PREFIXES`; every envelope field has a
  default; `LinkTarget` refuses relative internal URLs; image/video
  backgrounds require overlay and poster; no editor-library type anywhere.
- **Node schema & classes** (ADR-032): every enum value of every class
  table emits classes present in the built CSS; the `/definitions` and
  `/definition` subpaths import neither `react-dom` nor `@repo/ui`;
  `(overlay, textTone)` pairs pass the contrast property test.
- **Widgets** (ADR-030): unknown key → fallback; invalid config → fallback
  - log; `needs` collected in pass 1; Skeleton inside Suspense; every
    registered widget has a fixture and an axe entry; no widget package
    imports `@repo/core`/`@repo/db`; GT4's diff is recorded.
- **Links** (ADR-031): slug change → new href on page and menu with no
  redirect hop; unpublish → static text / pruned; premium leak probe; at
  most one read per target type; not served stale from `page:{id}`.
- **References & reuse** (ADR-033): save writes/removes the expected
  `ContentReference` rows; guarded deletion for media, cards, styles;
  `StylePreset` propagation + fallback; `LayoutTemplate` copy independence;
  every reuse action carries one of the two verbs.
- **Media** (ADR-034): magic bytes per kind, spoofed types refused, caps
  from settings, Range 206, replace keeps id and invalidates references,
  soft delete refused while referenced, embeds allow-listed and never a
  background; a test enumerates media-holding models and asserts each
  service syncs references.
- **Integration** (Testcontainers): publish → correct tags invalidated and
  only those; slug change → 301; card edit → two surfaces update; provider
  conformance suite; premium leak probes across cache orderings.
- **E2E** (Playwright): the Phase 3 authoring journey; the Phase 5
  publish-an-article journey; permission-denied paths asserted at the DB
  level; back-navigation preserves filters; RTL smoke on an authored page.
- **A11y/perf:** all-blocks axe fixture (light/dark, ltr/rtl); Lighthouse
  budgets including a worst-realistic-page fixture.
- Coverage: `@repo/blocks` is pure logic → **90% floor**; `@repo/core/cms`
  → 80%.

## 14. Risks

| Risk                                                                     | Mitigation                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored pages defeat contrast/a11y/perf gates                           | ADR-024: token-only styling + gates that block publish; fixture coverage CI check                                                                                                                                                                                |
| `/news` regression while converting a shipped surface                    | fallback switch, snapshot at 1440/390 before and after, no rewrite of `ArticleCards`                                                                                                                                                                             |
| Puck never passes its spike                                              | Composer is the product path (ADR-026); nothing else depends on the canvas                                                                                                                                                                                       |
| Block evolution breaks published pages                                   | per-block `version` + `migrate` + a fixture per historic version; `FallbackBlock`                                                                                                                                                                                |
| Coarse `content` tag over-invalidates                                    | measured in Module 14; every provider read goes through one helper, so splitting later is contained                                                                                                                                                              |
| Scope creep back toward v1                                               | MVP boundary = **Phases 1–6**; anything in §15 needs an ADR                                                                                                                                                                                                      |
| Phase 6 read as "a small final polish phase"                             | it is named **Global Website & Navigation Builder** and sized as a module in §12; it is the second-largest phase after 4                                                                                                                                         |
| Media library work slips, blocking Phase 3                               | **Media v2 is inside Phase 3's own scope** (ADR-034): `storeMedia()`, metadata, replace, guarded delete and the one `MediaLibrary` component, all over ADR-017's shipped pipeline; only bulk ops, focal point and generated variants may lag, with a DEVLOG note |
| A mega-menu panel puts a query in the site shell on every page           | grouped per-part cached resolution + `part-data:{key}` tagging (never `content`) + a warm-cache zero-query test; budget warns/blocks; a header-with-collection route joins the Lighthouse budget (ADR-029)                                                       |
| Header data goes stale (5 min window) because it is not tagged `content` | deliberate and stated in the admin UI; per-part `cacheLife`; republish forces immediate refresh (ADR-029)                                                                                                                                                        |
| Budgets get raised casually until the public surface degrades            | a raise is a settings change **plus** a Lighthouse measurement recorded in the DEVLOG                                                                                                                                                                            |
| Mega panels regress keyboard a11y across the whole site                  | axe fixture + E2E keyboard/escape/focus assertions before the header fallback is removed                                                                                                                                                                         |
| Menu resolution N+1 as entity targets multiply                           | targets batched one read per type; query-count test on a mixed menu (ADR-028)                                                                                                                                                                                    |
| Build OOM worsens with new routes                                        | resolve before Phase 4 adds static params; tracked from the 2026-09-04 DEVLOG entry; the catch-all pre-generates published STATIC paths only                                                                                                                     |
| Multi-instance hosting breaks tag propagation                            | shared cache handler is a deployment prerequisite, recorded before launch                                                                                                                                                                                        |
| A future tool is added by growing a switch inside `@repo/blocks`         | the `widget` block dispatches by key and never changes; GT4 asserts the diff; review checklist in ADR-030                                                                                                                                                        |
| Widget config drifts as tools evolve                                     | `version` + `migrate` + fixtures per historic version, exactly as blocks                                                                                                                                                                                         |
| A feature package is removed and pages hold orphan widgets               | `FallbackBlock` in production, warning in preview, an Overview attention row                                                                                                                                                                                     |
| Premium tools/pages assumed to work before entitlements exist            | `PREMIUM` = staff-only (ADR-012) is stated on the visibility control; the hook is the enum, the semantics arrive with the entitlements module — no CMS change then                                                                                               |
| Usage tables lie because one entity forgot to sync references            | a test enumerates every media/link-holding model and asserts its service calls `syncReferences()`                                                                                                                                                                |
| Video backgrounds degrade public performance                             | poster-first, lazy, reduced-motion → poster, a budget row (`videoBackgrounds`), a Lighthouse fixture                                                                                                                                                             |
| Tailwind purges authored classes                                         | literal lookup tables + a test that every emitted class exists in the built CSS; lint against template literals in `className`                                                                                                                                   |
| A copy is mistaken for a link (or the reverse)                           | two verbs, one badge, a UI test that every reuse action carries a verb                                                                                                                                                                                           |

## 15. Deferred — but scheduled, not open-ended

**Next after MVP, in this order** (each still needs its ADR before code):

1. **Reusable sections** — Phase 9. The first post-MVP feature; the
   "Newsletter CTA on six pages" requirement is real and the deferral is
   about build order, not doubt.
2. **Visual canvas** — Phase 10, if the ADR-026 spike passed.
3. **Scheduled page publishing** — the `ContentStatus.SCHEDULED` +
   `cacheLife` pattern from ADR-015 #6 applies unchanged; it is a small
   addition once versions exist.

**Optional, cheap, no ADR needed when wanted:** a signed share-preview
token for non-admin reviewers · a `not-found` STATIC page by reserved key ·
`MediaAsset` focal point / generated variants (`sharp` is pre-approved) ·
bulk media operations · `Page.group` filters beyond the list screen.

**Needs its own ADR before scope:** a **generic forms module**
(`FormDefinition` / `FormSubmission`, spam control, submissions screen —
a widget under ADR-030) · a route-param `DATA` page (`/rates/[pair]`,
ADR-030 §5) · scheduled page publishing (above).

**No date, needs a reason to enter scope:** revision diff UI beyond the
versions panel · review/approval workflow · `custom-html` · per-section
JSON-LD · A/B variants · per-item design overrides · automatic preset
screenshots · block locking · a visual form builder (rejected in ADR-030
unless a real requirement appears).

_(Header, footer, menus and the announcement bar were on this list in the
first draft of v2 and are **now in scope** as Phase 6 — ADR-027/028. Page
templates, section/block presets, style presets and embedded video were on
this list in v2.0 and are **now in scope** as Phase 2–3 — ADR-032/033/034.)_

## 16. Hand-off rules

1. Read, in order: `claude.md`, `.claude/rules/*`,
   `.claude/skills/website-builder/SKILL.md`, ADR-020…034,
   `docs/cms/00-reconciliation.md`, the last 5 DEVLOG entries.
2. **`docs/MBX-Dynamic-Site-Controle-Plan.md` (v1) is history.** Do not
   implement from it. Where it is useful (§5.7, §6.1, §7.1, §16 wording) it
   has already been carried into this document.
3. Phases in order. Each ends with acceptance criteria demonstrated, CI
   green, and a DEVLOG entry recording test results.
4. `@repo/blocks` and every widget package never import `@repo/db` or
   `@repo/core`. Route handlers and server actions never touch Prisma.
   `requirePermission()` is the first line of every mutation, every
   mutation writes an audit row, and every save of a layout-holding row
   calls `syncReferences()`.
5. Every block — and every widget — ships with: Zod schema, defaults,
   `version`, server renderer, editor field metadata, a JSON fixture, a
   render test in light+dark, and an entry in the axe fixture page.
   Widgets add `Skeleton`, and `Empty`/`Error` when they have needs or
   actions.
6. No hex, no arbitrary classes, no inline styles from authored data. No
   hardcoded user-facing strings — catalog keys or translatable props only.
   Enum → class is a literal lookup table, never a template string.
   6a. **A new feature never edits the CMS.** It ships a provider and/or a
   widget, one registry line, a page seed and a menu item. If you are
   adding a `variant` to a switch in `@repo/blocks` for a feature, stop —
   that is ADR-030's failure mode.
   6b. **Internal links are never free text.** Every link prop is a
   `LinkTarget`; menus and blocks share the resolver (ADR-031).
   6c. **Reuse is _Linked_ or _Start from_.** Do not add a third preset entity;
   a "button preset" is a `StylePreset`, a "section preset" is a
   `LayoutTemplate` (ADR-033).
   6d. **Media goes through `storeMedia()`** and is placed by id; the picker is
   the library (ADR-034).
7. Every publish path calls the revalidation helper with the ADR-025 tags.
   No `revalidatePath`, no `export const revalidate`.
8. A provider composes the existing service's visibility rule. It never
   writes its own publication-state `where` clause.
9. When this plan conflicts with something the code actually does, prefer
   extending the code and record the deviation in a new ADR **before**
   writing it (Part F #10).
10. **Work from the PR breakdowns** (§12) and the touchpoint index (§18).
    A PR that touches a schema, a service, a screen or a seed the index does
    not list for its ADR is either a missing index row (fix the index) or a
    deviation (write the ADR). Pre-launch, migrations land under §5.2 —
    reset, no backfill scripts — until the DEVLOG records the first
    production deploy.

## 17. Architecture test and final acceptance criteria

### 17.1 "Can we build this without changing the CMS?" — thirteen cases

For every case: what the CMS controls · what the feature controls · which
blocks/widgets · how data connects · whether developer work is needed, and
of what kind. Publishing is identical for all thirteen: draft → gates →
snapshot → pointer → references → audit → tags → public route. No case
requires a developer to edit a public route file for a new CMS page.

| #   | Page                   | CMS controls                                                                                                  | Feature controls                                                                | Blocks / widgets                                                                                                     | Data                                          | Dev work                                                                                                                   |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Static landing         | everything                                                                                                    | —                                                                               | section, heading, paragraph, image, video, button, icon-card, stat-card, faq, tabs, table, cta-band, newsletter-form | static                                        | **none**                                                                                                                   |
| 2   | News listing           | composition, filters, card design, style                                                                      | article data, visibility rule                                                   | collection, collection-filter/search/sort/pagination                                                                 | `news` provider                               | none after Phase 4                                                                                                         |
| 3   | News detail            | the design for every article                                                                                  | article data, slugs, SEO fields                                                 | content-hero, content-body, content-meta, author-card, share-row, content-tags, related-content                      | route context + `news` provider               | none after Phase 5                                                                                                         |
| 4   | Course listing         | same as 2                                                                                                     | course data                                                                     | same as 2                                                                                                            | `course` provider                             | **backend only** — provider + descriptors + card + seeds (GT2)                                                             |
| 5   | Course detail          | same as 3                                                                                                     | course data                                                                     | same as 3                                                                                                            | `course` provider                             | same diff as 4                                                                                                             |
| 6   | Pip Calculator         | hero, intro, placement, width, style preset, related tools, FAQ, CTA, SEO, background, responsive, menu entry | fields, dropdowns, validation, calculation (`@repo/utils`), result card, states | content blocks + `widget{calc.pip}`                                                                                  | none (pure)                                   | **feature package only** (GT4)                                                                                             |
| 7   | Risk Calculator        | same as 6                                                                                                     | same as 6                                                                       | `widget{calc.risk}`                                                                                                  | none                                          | one more widget export + registry line                                                                                     |
| 8   | Currency Converter     | same as 6                                                                                                     | pair list, conversion, refresh                                                  | `widget{market.converter}`                                                                                           | `market.rates` DataProvider via `needs`       | feature package only                                                                                                       |
| 9   | Live Rates             | same as 6; may sit in a part                                                                                  | rates, caching, client refresh                                                  | `widget{market.rates-table}` / `{market.ticker}`                                                                     | `market.rates` via `needs`; grouped in a part | feature package only                                                                                                       |
| 10  | Contact Form           | placement, surrounding content                                                                                | fields, validation, storage, spam, notifications                                | `widget{form.contact}`                                                                                               | its own service + bound action                | feature package + **its own ADR** (`FormSubmission`)                                                                       |
| 11  | Premium Tool           | page/block `visibility: PREMIUM`, gated CTA                                                                   | entitlement check in its service                                                | any + a widget                                                                                                       | as above                                      | feature package; **waits on the entitlements module** (ADR-012) — no CMS change then                                       |
| 12  | EA Trading Hub         | its marketing/landing pages, teaser widgets, menu entries                                                     | authenticated app routes, services, permissions, data                           | content blocks + `widget{ea.*}`                                                                                      | its providers/needs                           | a module of its own; the CMS side is pages + widgets only                                                                  |
| 13  | Unknown future feature | placement and presentation                                                                                    | everything else                                                                 | provider and/or widget                                                                                               | registry                                      | feature package. If it needs a new **layout primitive**, that is a versioned block — the one CMS change the design absorbs |

### 17.2 Final acceptance criteria for the module

The architecture is successful only if **all** of these hold, each with a
test or a demonstrated journey named in the DEVLOG:

1. An administrator designs the public page structure and visual
   presentation — pages, parts, navigation, backgrounds, responsive layout,
   media, SEO — **without developer involvement** (Phase 3 journey).
2. A developer adds new business functionality **without redesigning the
   CMS** (GT2, GT3, GT4; ADR-030's review checklist).
3. Existing pages are **not rebuilt** when a new feature is introduced
   (the `widget` block is placed, nothing else changes; block/widget
   `migrate` keeps old versions rendering).
4. Static and dynamic sections **coexist on one page** (the calculator
   page in 17.1 #6; the homepage's hero + latest news + newsletter).
5. Media is **uploaded once and reused** across pages, replaced in place,
   and never deleted while in use (ADR-034 tests).
6. Layouts and styles are reused through **clearly labelled copy-vs-linked
   semantics** (ADR-033's verb/badge test).
7. Calculators, market tools, forms and future features are inserted into
   CMS-designed pages **through the Widget registry**, and a fully static
   page renders with no feature code at all.
8. The quality gates — contrast, axe, heading order, Lighthouse, logical
   properties, catalog completeness, data budget — **see authored content**
   and block publish when they fail (ADR-024 §4, ADR-029 §5, ADR-032 §2).

### 17.3 The rule that survives every future module

`CMS = presentation + composition + publishing` ·
`Providers = content/data` · `Widgets = interactive features` ·
`Feature modules = business logic` · `UI library = reusable visual
primitives` · `Media library = reusable assets` · `Templates/presets =
reusable design`. Any proposal that moves a responsibility across one of
these lines needs an ADR that says why.

## 18. ADR → implementation touchpoint index

One row per binding decision: what it makes you write, where, and which
test proves it. "Drafted" means the schema text exists in the uncommitted
`schema.prisma` with no migration yet (2026-09-05). Phases are where the
touchpoint lands, not where the ADR is read — read all of them first.

| ADR     | Decision (one line)                                                                                                                                                                                                                                                | Schema (`packages/db`)                                                                                                              | Contracts (`@repo/contracts/src/cms`)                                                                                                             | Packages / services                                                                                                                      | `apps/web`                                                                          | Seed                                                                                                                                            | Proof (key tests / checks)                                                                                                                                                                                                                 | Phase                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **020** | One new package, `@repo/blocks`; everything else extends what exists                                                                                                                                                                                               | —                                                                                                                                   | shared schemas live here                                                                                                                          | `packages/blocks` (never imports `db`/`core`); `core/src/cms/*`                                                                          | `(admin)/admin/website/_builder`                                                    | —                                                                                                                                               | fixture render with no DB in the import graph; `import-x/no-cycle`; `check:phantom-deps`; review: no new `packages/*` for the CMS                                                                                                          | 2                                                           |
| **021** | `Page` / `PageTranslation` / `PageVersion`, one `PageKind`, layout as validated JSON                                                                                                                                                                               | `PageKind`, `Page`, `PageTranslation`, `PageVersion` — **drafted**                                                                  | `layout.ts`, `pages.ts`, `paths.ts` (reserved paths)                                                                                              | `core/cms/{pages,translations,versions,publish,public-pages}.ts`                                                                         | `[...slug]/page.tsx`, `website/pages/*`                                             | `home` page row; `cms.pages.*`                                                                                                                  | malformed node → `FallbackBlock`; `check:reserved-paths`; migration + seed idempotency (Testcontainers)                                                                                                                                    | 1 (routes, services) · 2 (blocks)                           |
| **022** | Two provider interfaces, generic collection blocks, `bindingId` + URL                                                                                                                                                                                              | —                                                                                                                                   | `providers.ts` (`CollectionItem`, `CollectionProvider`, `DataProvider`, descriptors, derived search-param schema with `limit ≤ 24`, `page ≤ 200`) | `core/cms/providers/{news,analysis,trade-idea,glossary,course,market.rates,market.calendar}.ts`                                          | `app/_cms/registry.ts`                                                              | —                                                                                                                                               | conformance suite over every provider; news provider ≡ `getPublishedArticles`; no `where` on publication state under `providers/*`; dangling-`bindingId` warning                                                                           | 4 · 5 (course) · 7 (market)                                 |
| **023** | Card designs are `CardTemplate` rows referenced by id                                                                                                                                                                                                              | `CardTemplate`                                                                                                                      | `cards.ts` (`cardConfigSchema` + `version`)                                                                                                       | `core/cms/cards.ts`; resolution tagged `card-template:{id}`                                                                              | `website/cards/*`                                                                   | `standard` / `featured` / `compact` / `horizontal`; `cms.cards.manage`                                                                          | deletion guard names usages; missing id → system template; edit propagates to two surfaces in one cycle; seed idempotency                                                                                                                  | 4                                                           |
| **024** | Token-only styling, bounded motion, gates extended to authored content                                                                                                                                                                                             | —                                                                                                                                   | `style.ts` (base vocabulary; extended by 032), motion enums; **no hex** regex test                                                                | `blocks/styles/tables.ts`; gate runner in `core/cms/publish.ts`                                                                          | composer Style / Motion tabs                                                        | —                                                                                                                                               | contrast property test over every legal pair; all-blocks axe fixture; heading-order gate; `check-block-fixtures`                                                                                                                           | 2 (schemas) · 3 (gates) · 8 (full)                          |
| **025** | Tags `page:{id}`, `page-path:{locale}:{path}`, `layout:{contentType}`, `card-template:{id}`; provider reads keep `content`                                                                                                                                         | —                                                                                                                                   | —                                                                                                                                                 | `core/cms/revalidate.ts`; cached readers with `cacheLife 300`; query key includes tier                                                   | no `revalidatePath` / `export const revalidate` under `(public)` (grep gate)        | —                                                                                                                                               | publish A does not flush B; card edit propagates; tier leak test across orderings                                                                                                                                                          | 1 (page tags) · 4 (provider reads)                          |
| **026** | Renderer first; Puck spike-gated; editor client code in `apps/web`                                                                                                                                                                                                 | —                                                                                                                                   | layout schema has no editor type (test)                                                                                                           | —                                                                                                                                        | `website/_builder/*`; `/api/preview` (draft mode renders the real route)            | —                                                                                                                                               | no editor-library type in any schema/service; spike → ADR before any import                                                                                                                                                                | 3                                                           |
| **027** | Header/footer/announcement/panels are `PART` pages; bounded shell behaviours; per-page override                                                                                                                                                                    | `PageKind.PART`; `Page.headerPartId` / `footerPartId` / `announcementPartId`                                                        | `parts.ts` (part keys, root prop schemas)                                                                                                         | part block set + `HeaderShell` in `blocks`; part resolver in `core/cms/parts.ts`                                                         | public root layout switch; Global tab                                               | PART pages from `header.*` / `footer.*` settings; `layout.*PartKey` settings                                                                    | snapshot parity at 1440/390 × modes × directions; three-path resolution; reduced-motion                                                                                                                                                    | 6                                                           |
| **028** | Menu items get polymorphic targets, dynamic children, panel references                                                                                                                                                                                             | `MenuItem.linkType` / `targetId` / `dynamicSource` / `iconType` / `badgeKey` / `panelPartKey`; `MenuLinkType`                       | matrix in `navigation.ts` (shared with `LinkTarget`)                                                                                              | `core/navigation.ts` extended (batched per type, dynamic children through providers)                                                     | `/admin/navigation` link picker                                                     | one-statement backfill in the migration (§5.2)                                                                                                  | matrix contract test; slug change → no hop; unpublish → pruned; premium leak; query count; depth ≤ 2                                                                                                                                       | 6                                                           |
| **029** | Two-pass resolution; grouped for parts, per-need for page collections; `part-data:{key}`; budgets in settings                                                                                                                                                      | —                                                                                                                                   | `BlockDataNeed` in `blocks.ts`                                                                                                                    | `blocks/render.tsx` passes; `core/cms/resolve.ts` (grouped / per-need helpers, `listMany` seam)                                          | Data panel + budget meter                                                           | `cms.dataBudget` (bounds validated)                                                                                                             | zero-query shell; 3 needs → 1 call; grouped = one entry + one `listMany`; `content` does not flush `part-data:*`; warn publishes / block refuses with names                                                                                | 2 (pipeline) · 3 (budget) · 6 (parts)                       |
| **030** | Widget registry; one generic `widget` block; feature packages own runtimes                                                                                                                                                                                         | —                                                                                                                                   | `widgets.ts` (`WidgetDefinition`, `WidgetRuntime`)                                                                                                | `blocks/widget`; `packages/widgets/*` (pure `/definition` subpaths; never `db`/`core`)                                                   | `app/_cms/registry.ts` (bound actions); `app/api/<tool>/*`                          | `/tools` parent + calculator pages + menu items                                                                                                 | unknown key → fallback; invalid config → fallback + log; `needs` in pass 1; Skeleton in Suspense; definition purity; `check-block-fixtures` over widgets; **GT4 diff recorded in the DEVLOG**                                              | 2 (contract) · 7 (widgets)                                  |
| **031** | Every authored link is a `LinkTarget`, resolved at render by one batched resolver                                                                                                                                                                                  | —                                                                                                                                   | `links.ts` (union; `URL` refuses relative internal paths)                                                                                         | `core/cms/links.ts` shared with `buildNavigation`; per-need reads tagged `content`                                                       | link picker replaces every URL field                                                | hero CTA + `header.cta` → `LinkTarget` in the `home` seed                                                                                       | slug change → new href on page **and** menu, no hop; unpublish → static text / pruned; premium leak; ≤ T reads per T types; not stale from `page:{id}`; link-bearing fixtures cover `ok` / `missing` / `forbidden`                         | 2 (contract, resolver) · 4 (entity types) · 6 (menus)       |
| **032** | Node envelope (`label`, `hidden`, `anchor`, `style {presetId, overrides}`, responsive, `hiddenOn`); complete token-only style vocabulary with the overlay gate; class lookup tables; pure `/definitions`; draft mutable in place + publish snapshots; nested paths | `Page.updatedById` / `parentId` / `group`; `PageVersion.updatedAt` / `revision` / `gateResult` / `templateKey` — **drafted**        | `layout.ts` envelope, `style.ts`, `responsive.ts`, `paths.ts` (§5.1)                                                                              | `blocks/styles/tables.ts` + lint rule; `core/cms/versions.ts` (optimistic lock), `publish.ts` (snapshot), `paths.ts` (subtree recompute) | Responsive tab + device toggle; overlay controls                                    | —                                                                                                                                               | every envelope field defaults; overlay + poster required; classes exist in built CSS; definitions import no `react-dom` / `@repo/ui`; reduced-motion poster; two saves on one `baseRevision` → second refused; nested-path + redirect test | 1 (columns, paths, lock) · 2 (schema, tables) · 3 (UI)      |
| **033** | Reuse is _Linked_ (`CardTemplate`, `StylePreset`, parts) or _Start from_ (`LayoutTemplate`); one `ContentReference` table                                                                                                                                          | `StylePreset`; `LayoutTemplate` + `LayoutTemplateKind`; `ContentReference` + two enums — **CR drafted**                             | `styles.ts`, `templates.ts` (same Zod as node style / layout)                                                                                     | `core/cms/references.ts` (`syncReferences`, `collectReferences`), `styles.ts`, `templates.ts`; resolution tagged `style-preset:{id}`     | `website/{styles,templates}/*`; the two verbs + the Linked badge in the composer    | six system styles; Landing / Tool / Legal / Contact / Blank page templates; PART presets (Phase 6); `cms.styles.manage`, `cms.templates.manage` | preset edit propagates to two pages; copy stays independent; save writes / removes expected reference rows; guarded deletion for media / cards / styles; every reuse action carries a verb                                                 | 1 (table + helper) · 3 (models, screens) · 6 (part presets) |
| **034** | `storeMedia()` for four kinds; asset metadata; replace-in-place; usage-guarded soft delete; one `MediaLibrary`                                                                                                                                                     | `MediaKind`; `MediaAsset.kind` / `title` / `altText` / `folder` / `tags` / `durationMs` / `posterAssetId` / `version` / `deletedAt` | `media.ts` extended (kinds, metadata, `video` block `EMBED` allow-list)                                                                           | `core/media.ts` (`storeMedia`, `replaceMedia`, `deleteMedia`); `syncReferences` in every media-holding service                           | `/uploads/[file]` Range; `website/media/*`; the picker = the library in select mode | `media.view`, `media.update` (**new**); `media.maxBytes.{kind}` settings                                                                        | magic bytes per kind, spoof refused, caps from settings, Range 206, replace keeps id + invalidates, delete refused while referenced, enumerating "every media-holding model syncs references" test, embed never a background               | 3                                                           |
