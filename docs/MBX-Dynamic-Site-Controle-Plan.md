> ⚠️ **SUPERSEDED (4 Sep 2026) — do not implement from this document.**
> It was written without access to this repository (see §3's own opening
> line) and proposes eight new packages, twelve new models and a two-app
> topology against decisions already locked in ADR-003/004/006/011/012/
> 015/017/018. Replaced by **`docs/MBX-Dynamic-Site-Control-Plan-v2.md`**
> with binding decisions in **ADR-020…ADR-026**. The review that
> superseded it: `docs/changes/dynamic-site-plan-review.md`. The repo facts
> that replace its §3 audit: `docs/cms/00-reconciliation.md`.
> Retained as history — its §5.7, §6.1–6.3, §7.1 and §16 survive, edited,
> in v2.

# MBX Learning Center — CMS & Website Builder

## Consolidated Execution Plan (v1.0 — 4 Sep 2026)

This document merges four inputs into one plan that can be handed to Claude Code:

1. The deep-research architecture report (hybrid block CMS on Puck)
2. Three rounds of clarifications (UX, effects, SEO, multilingual, linking, dark mode)
3. The Admin UI specification
4. Your "Dynamic CMS & Website Builder Execution Plan" document

Where the inputs disagreed, the decision is recorded in Section 2 with the reason.

---

## 0. Reading Guide

| Section | Purpose                                                               |
| ------- | --------------------------------------------------------------------- |
| 1       | Final locked decisions (one line each)                                |
| 2       | Conflicts between inputs and how they were resolved                   |
| 3       | Phase 0: Existing-system audit (checklist Claude Code must run first) |
| 4       | Target architecture and monorepo layout                               |
| 5       | Data model (Prisma)                                                   |
| 6       | Block registry and module integration contract                        |
| 7       | Renderer, routing, caching                                            |
| 8       | Editor (Puck) integration                                             |
| 9       | Effects, theme and dark-mode system                                   |
| 10      | SEO system                                                            |
| 11      | Multilingual system                                                   |
| 12      | Media library                                                         |
| 13      | Menus, header, footer                                                 |
| 14      | Access control (free/premium)                                         |
| 15      | Publishing workflow                                                   |
| 16      | Security                                                              |
| 17      | Phased implementation plan with acceptance criteria                   |
| 18      | Testing and hardening                                                 |
| 19      | Risks                                                                 |
| 20      | Hand-off instructions for Claude Code                                 |

---

## 1. Locked Decisions

**Platform**

- Keep the existing Turborepo + pnpm monorepo, Next.js App Router, TypeScript, Tailwind v4, shadcn/ui, Prisma + MariaDB, next-intl. Nothing is replaced.
- Architecture is **Option D (hybrid)**: relational entities for pages/templates/media/menus/access/revisions; a validated JSON block tree per page version; a versioned block registry shared by admin and web; dynamic blocks that query existing domain modules.
- The CMS is a **presentation/composition layer**. News, Courses, Learning, Users, Categories, Tags keep owning their data.

**Editor**

- Visual editor is **Puck** (`@puckeditor/core`, MIT, pin to current stable 0.23.x). Wrapped in `packages/page-builder` so it can be replaced without touching data or blocks.
- Tiptap (already locked) is the rich-text field inside blocks.
- Admins never write JSON. Drag/drop + form fields only. No AI dependency.
- Inline text editing on the canvas for headings/paragraphs (Puck supports this via its field/overlay system; fallback is the settings panel).

**Design control**

- Theme tokens: Primary, Secondary, Accent, Background, Surface, Text, Muted Text, Border, Success, Warning, Error, plus typography/spacing/radius/shadow scales. Each color token carries a light and a dark value.
- Component-level color overrides only where useful (Hero background, CTA button, Card background, Section background), each with light + dark values.
- Effects come from a **preset library** (hover, loading, entrance). Admins pick presets; they can also create new presets from a constrained builder. No arbitrary CSS.
- Dark/light mode remains **user-controlled**. Admin sets token values per mode and per-component overrides per mode; admin cannot force a mode.

**Content model**

- Multilingual: **one page, many translations** (page-level translations for title/slug/SEO; block-level translatable props). Not separate pages per language. Translation status tracking (Published / Draft / Missing) and "copy from language."
- Reusable sections (unsynced copy in MVP, synced reference in V2) are separate from templates (full-page structures) and presets (saved design/config for a single block).
- Custom HTML/Embed block exists but is sanitized, allow-listed, and permission-gated.

**SEO**

- Auto-suggested from content (title, excerpt, image, dates, author, schema type) at page and content-template level; admin can override at page level and add optional section-level SEO (H2/description) per block.

**Navigation**

- Menus use adjacency list with polymorphic link targets (page / article / category / course / external). Icons are preset (icon library name) or media (uploaded SVG/image).
- Listing → detail linking is modeled explicitly (`parentPageId` + navigation config) so back button, breadcrumbs, prev/next and filter preservation work automatically.

**Media**

- Central library with folders, tags, metadata, usage tracking, replace, bulk ops. Storage driver interface: local now, S3-compatible (R2 recommended) later.

**Caching**

- Next.js cache tags + on-demand revalidation. Publish invalidates only affected tags. Extend the existing News cache-tag scheme; don't replace it.

**Security**

- Closed block registry. No arbitrary JS. Server-side sanitization of rich text. SVG sanitization. Embed allow-list. Strict CSP. Access checks server-side.

---

## 2. Conflict Resolution Log

| Topic             | Input A                                                           | Input B                                                                                  | Decision                                                                                                                                                                                                          | Reason                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor            | Research report: Puck                                             | Your plan: "Elementor-like, proper drag/drop architecture" (library unspecified)         | **Puck**                                                                                                                                                                                                          | Meets every requirement in your plan (drag/drop, inline editing, responsive preview, undo/redo, JSON output) without building DnD from scratch. Wrapped so it's replaceable. |
| Routing           | Report: content routes like `/news/[slug]` owned by domain module | Your plan: everything through `[[...slug]]` resolver, with special domain routes allowed | **Hybrid resolver**: `[[...slug]]` handles CMS pages and CMS-managed listings (`/news`); domain detail routes (`/news/[slug]`, `/courses/[slug]`) stay as explicit route files that load a CMS _content template_ | Keeps SEO/static params simple for detail pages; still lets admin redesign `/news` without a developer.                                                                      |
| News page         | Existing News plan: fixed `/news/page.tsx`                        | Your plan: `/news` becomes a CMS page                                                    | **`/news` becomes a CMS page** composed of News dynamic blocks; existing News UI components are reused as the block renderers                                                                                     | Section 54 of your plan; avoids duplicating News UI.                                                                                                                         |
| Multilingual      | My earlier suggestion: separate pages per language for MVP        | You: translatable content from the start                                                 | **Translatable content from Phase 1**                                                                                                                                                                             | Retrofitting translations later is the most expensive migration; page/block translation tables are added in Phase 1 even if UI polish lands in Phase 10.                     |
| Custom HTML       | Report: no raw HTML block in MVP                                  | You: support it, sanitized                                                               | **Sanitized Custom HTML/Embed block, permission-gated, in Phase 3**                                                                                                                                               | Your requirement; sanitization + permission keeps the security posture.                                                                                                      |
| Section-level SEO | Report: page-level only                                           | You: page and section level                                                              | **Page-level in MVP, optional per-block SEO fields (H2 text, description, tags) in Phase 3 blocks; section schema in V2**                                                                                         | Low cost to add fields now; full schema markup per section later.                                                                                                            |
| Effects           | Report: fixed preset list                                         | You: presets plus "add more for reuse"                                                   | **Preset library table + constrained preset builder**                                                                                                                                                             | Presets are data, not code; admins can add new ones from bounded parameters.                                                                                                 |
| Phase order       | Report: 10 phases                                                 | Your plan: 13 phases (0–12) with News integration as Phase 6                             | **Your 13-phase order adopted**, with acceptance criteria added and News integration kept as the critical milestone                                                                                               | Your order front-loads the audit and keeps News as the end-to-end proof.                                                                                                     |

---

## 3. Phase 0 — Existing-System Audit (must complete before any builder code)

I cannot see your repository. Claude Code must run this audit and write `docs/cms/00-audit.md` with findings before Phase 1. Each item lists what to inspect and what decision it feeds.

### 3.1 Monorepo & tooling

- [ ] List `apps/*` and `packages/*` with their `package.json` names, exports, and internal dependencies (`pnpm -r list --depth 0`).
- [ ] Confirm Turborepo pipeline tasks (`build`, `lint`, `typecheck`, `test`) and which packages run them.
- [ ] Confirm Next.js version, React version, Tailwind v4 config location, shadcn/ui component location, and whether a shared `packages/ui` exists.
- [ ] Confirm pinned versions policy (exact versions, ADR process). Record the ADR template path.
- **Feeds:** package boundaries in Section 4; whether `packages/ui` can host shared block primitives.

### 3.2 Database & Prisma

- [ ] Dump current `schema.prisma`. List every model, especially: Users, Roles, Permissions, Settings, Articles/News, Categories, Tags, Authors, Courses, Lessons, Media (if any), Menus (if any), Translations (if any).
- [ ] Identify naming conventions (snake_case vs camelCase, id type: cuid/uuid/int), soft-delete pattern, timestamp pattern.
- [ ] Identify how MariaDB JSON columns are currently used (if at all) and the Prisma `Json` handling.
- [ ] Identify existing migrations workflow (`prisma migrate` vs push).
- **Feeds:** Section 5 naming/ID conventions; whether to extend or create Media/Menu models.

### 3.3 News & Analysis module (highest priority)

- [ ] Locate article query functions (list, by slug, by category, by tag, featured, related, search). Record signatures and where caching/tags are applied.
- [ ] Locate article UI components: standard/featured/compact cards, list, grid, sidebar, pagination, search, subscribe CTA. Record whether they are Server or Client Components and what props they take.
- [ ] Locate `/news` route files and how metadata is generated.
- [ ] Record existing cache tags (e.g., `articles`, `article:{id}`, `category:{slug}`) and where `revalidateTag` is called on publish.
- [ ] Record article SEO fields already stored (title, description, OG, canonical).
- [ ] Record video-embed handling (pasted links) and any sanitization already present.
- **Feeds:** Section 6.4 News block adapters; Section 7.3 cache tag extension; Section 10 SEO auto-suggest sources.

### 3.4 Learning Center / Courses

- [ ] Same inventory as 3.3 for Courses, Lessons, Learning Paths, Instructors, enrollment/progress if present.
- **Feeds:** Phase 7 Course blocks.

### 3.5 Auth, roles, permissions

- [ ] Record the permission model (RBAC tables, permission string format, how routes/actions are guarded in admin).
- [ ] Record how the current user/session is accessed in Server Components and Server Actions.
- **Feeds:** CMS permissions (`cms.pages.edit`, `cms.pages.publish`, `cms.media.upload`, `cms.blocks.custom_html`), access-rule evaluation in Section 14.

### 3.6 Settings & branding

- [ ] Locate the admin-controlled branding system: header, menus, footer, colors (background/primary/secondary/hover/active), typography. Record storage model and how CSS variables are emitted (server-rendered `<style>`, inline `style` on `<html>`, generated CSS file?).
- [ ] Record how dark/light mode is toggled by users (class on `<html>`, `data-theme`, next-themes?) and where per-mode values live.
- [ ] Record curated self-hosted font list and how fonts are loaded.
- **Feeds:** Section 9 theme extension; must extend, not duplicate.

### 3.7 Media

- [ ] Record existing upload handling (route, storage path, validation, size limits, image processing), and any media table.
- [ ] Record how images are served (Next `<Image>`, static path, custom loader).
- **Feeds:** Section 12; whether to create `media` table or migrate an existing one.

### 3.8 i18n

- [ ] Record next-intl setup: locale list, routing strategy (`[locale]` segment), message file structure, RTL handling, default locale behavior.
- [ ] Record whether any content tables already have translation tables.
- **Feeds:** Section 11.

### 3.9 Menus / navigation

- [ ] Record current header/footer nav: hard-coded, settings-driven, or table-driven. Record the item shape.
- **Feeds:** Section 13 migration path.

### 3.10 Caching & deployment

- [ ] Record hosting (single Node instance? multiple? Docker?), whether a custom cache handler exists, ISR usage, `revalidate` values on routes.
- [ ] Record the CDN situation for static assets and media.
- **Feeds:** Section 7.3; whether a shared cache handler (Redis) is needed for multi-instance.

### 3.11 UI audit outputs

- [ ] List reusable components suitable for block renderers (cards, buttons, badges, sections, containers, grids).
- [ ] List duplicate components to consolidate.
- [ ] Confirm token discipline (zero hex in web/UI layer) and the token naming scheme.

### 3.12 Audit deliverable

`docs/cms/00-audit.md` containing: current architecture summary, current data model (mermaid ERD), reusable components table, duplicate components table, required changes, migration risks, and a filled-in "Decisions confirmed by audit" list that updates Sections 4–13 of this plan where needed.

---

## 4. Target Architecture & Monorepo Layout

### 4.1 System diagram

```text
ADMIN (apps/admin)                                   PUBLIC (apps/web)
┌────────────────────────────┐                       ┌───────────────────────────┐
│ Website area               │                       │ [locale]/[[...slug]]      │
│  Pages / Templates /       │                       │ [locale]/news/[slug]      │
│  Sections / Media / Menus  │                       │ [locale]/courses/[slug]   │
│  Header / Footer / Theme   │                       │                           │
│                            │                       │ Page resolver             │
│ packages/page-builder      │                       │ packages/renderer         │
│  (Puck wrapper, client)    │                       │  (server, deterministic)  │
└─────────────┬──────────────┘                       └─────────────┬─────────────┘
              │ save / publish                                     │ read
              ▼                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ packages/cms  (services: pages, templates, sections, media, menus, theme,    │
│                seo, access, revisions, revalidation)                          │
│ packages/blocks (registry: schema + fields + server render, versioned)        │
│ packages/theme  (token schema, CSS var emitter, effect presets)               │
│ packages/access (AccessPolicy)                                                │
│ packages/media  (storage drivers, image pipeline)                             │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ Prisma
                                   ▼
                     MariaDB  ◄──── existing domain modules
                                    (News, Courses, Learning, Users, Categories, Tags)
```

### 4.2 Package boundaries (final)

| Package                         | Runtime         | Imported by                        | Contents                                                                                                                                                                   |
| ------------------------------- | --------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cms`                  | server          | admin, web                         | Prisma models access, services, Zod schemas for JSON columns, cache tag helpers, revalidation, page resolver                                                               |
| `packages/blocks`               | split           | admin (`/editor`), web (`/server`) | Block definitions. Each block exports `schema`, `version`, `migrate`, `defaults`, and two entry points: `server` (RSC render) and `editor` (Puck fields, preview)          |
| `packages/renderer`             | server          | web, admin preview                 | `renderTree`, validation, migrations, context binding, synced-section resolution, fallback block                                                                           |
| `packages/page-builder`         | client          | admin only                         | Puck config assembly, custom fields (media picker, color picker light/dark, effect picker, link picker, icon picker, translatable text), toolbar, autosave, preview bridge |
| `packages/theme`                | server + client | admin, web                         | Token Zod schema, CSS variable emitter, effect preset definitions and CSS class mapping, `prefers-reduced-motion` handling                                                 |
| `packages/media`                | server          | cms, admin                         | `StorageDriver` interface, `LocalDriver`, `S3Driver`, image metadata extraction, SVG sanitizer, MIME validation                                                            |
| `packages/access`               | server          | cms, renderer, domain modules      | `AccessPolicy.can(user, rule)`, rule types, future entitlement hooks                                                                                                       |
| `packages/content-adapters`     | server          | blocks                             | Thin typed adapters over existing News/Course/etc. query functions so blocks never import domain internals directly                                                        |
| `packages/ui` (existing or new) | client + server | all                                | shadcn primitives, cards, badges, section/container primitives used by block renderers                                                                                     |

Rules:

- `apps/web` may import `cms`, `blocks/server`, `renderer`, `theme`, `access`, `ui`, `content-adapters`. It must never import `page-builder` or `blocks/editor`.
- `blocks/server` files carry no `"use client"`; interactive parts (carousel, accordion, tabs) are small client leaf components inside the block.
- Domain modules never import from `cms`. `content-adapters` imports from domain modules. Direction is one-way.

---

## 5. Data Model (Prisma)

Naming below uses snake_case tables; adapt to the convention found in audit 3.2. `Json` columns are validated by Zod in `packages/cms` on every read and write.

### 5.1 Pages and versions

```prisma
model CmsPage {
  id               String   @id @default(cuid())
  key              String?  @unique          // optional stable key e.g. "home"
  kind             PageKind @default(STANDARD) // STANDARD | LISTING | SYSTEM
  templateId       String?
  parentPageId     String?                    // listing page for detail-style pages
  status           PageStatus @default(DRAFT) // DRAFT | PUBLISHED | ARCHIVED
  currentVersionId String?  @unique           // published snapshot
  draftVersionId   String?  @unique           // working copy
  accessRuleId     String?
  navigationConfig Json?                      // back button, breadcrumbs, prev/next, preserveFilters
  createdById      String
  publishedAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  translations     CmsPageTranslation[]
  versions         CmsPageVersion[]
  template         CmsTemplate? @relation(fields: [templateId], references: [id])
}

model CmsPageTranslation {
  id              String  @id @default(cuid())
  pageId          String
  locale          String
  title           String
  slug            String                       // localized slug
  path            String                       // full resolved path e.g. "/ur/about"
  status          TranslationStatus @default(MISSING) // MISSING | DRAFT | PUBLISHED
  seoTitle        String?
  seoDescription  String?
  canonicalUrl    String?
  ogTitle         String?
  ogDescription   String?
  ogImageId       String?
  robots          String?  @default("index,follow")
  includeInSitemap Boolean @default(true)
  schemaType      String?  @default("WebPage")
  schemaOverrides Json?
  updatedAt       DateTime @updatedAt

  @@unique([pageId, locale])
  @@unique([locale, path])
  @@index([locale, slug])
}

model CmsPageVersion {
  id         String   @id @default(cuid())
  pageId     String
  number     Int
  layout     Json     // validated block tree (Puck Data shape + our extensions)
  note       String?
  authorId   String
  createdAt  DateTime @default(now())

  @@unique([pageId, number])
}
```

Block-level translations live **inside** `layout` as a `translations` map keyed by locale on translatable props (see 11.2). This keeps a version atomic and rollback-safe. Page-level metadata (title/slug/SEO) is relational because it's queried for routing.

### 5.2 Templates, sections, presets

```prisma
model CmsTemplate {
  id               String @id @default(cuid())
  key              String @unique      // "single-news", "news-listing", "standard-page"
  name             String
  kind             TemplateKind        // PAGE | CONTENT | PART
  contentType      String?             // "news" | "course" | "analysis" (for CONTENT)
  routePattern     String?             // "/news/:slug"
  currentVersionId String? @unique
  seoTemplate      Json?               // { titleTemplate, descriptionTemplate, schemaType, ogImageField }
  navigationConfig Json?
  previewImageId   String?
  versions         CmsTemplateVersion[]
}

model CmsTemplateVersion {
  id         String @id @default(cuid())
  templateId String
  number     Int
  layout     Json
  createdAt  DateTime @default(now())
  @@unique([templateId, number])
}

model CmsSection {                       // reusable section (synced reference in V2)
  id          String @id @default(cuid())
  name        String
  category    String?
  synced      Boolean @default(false)    // false = insert as copy; true = insert as reference
  definition  Json                       // block subtree
  previewImageId String?
  updatedAt   DateTime @updatedAt
}

model CmsBlockPreset {                   // saved design/config for a single block type
  id          String @id @default(cuid())
  blockType   String
  name        String
  category    String?
  props       Json                       // saved props minus content (if "design only")
  includesContent Boolean @default(false)
  previewImageId String?
}

model CmsEffectPreset {
  id        String @id @default(cuid())
  kind      EffectKind                   // HOVER | LOADING | ENTRANCE
  key       String @unique               // "lift", "scale-up", "skeleton", "fade-up"
  name      String
  params    Json                         // bounded params: scale, duration, easing, shadow, opacity, offset, stagger
  builtIn   Boolean @default(false)
}
```

### 5.3 Media

```prisma
model Media {
  id          String @id @default(cuid())
  folderId    String?
  provider    String   // "local" | "s3"
  key         String   // storage key/path
  url         String   // public URL (resolved by driver, cached here)
  mime        String
  size        Int
  width       Int?
  height      Int?
  duration    Int?     // video/audio seconds
  title       String?
  altText     String?
  caption     String?
  description String?
  tags        Json?    // string[]
  checksum    String?
  uploadedById String
  createdAt   DateTime @default(now())
  usages      MediaUsage[]
}

model MediaFolder { id String @id @default(cuid()); name String; parentId String? }

model MediaUsage {
  id         String @id @default(cuid())
  mediaId    String
  entityType String   // "page" | "template" | "section" | "article" | "menu" | "theme"
  entityId   String
  field      String?  // e.g. "layout.content[3].props.image"
  @@unique([mediaId, entityType, entityId, field])
}
```

If audit finds an existing media table, extend it toward this shape instead of creating a second one.

### 5.4 Menus, header, footer

```prisma
model CmsMenu     { id String @id @default(cuid()); key String @unique; name String; items CmsMenuItem[] } // "main","footer","mobile","topbar"

model CmsMenuItem {
  id         String @id @default(cuid())
  menuId     String
  parentId   String?
  sortOrder  Int
  linkType   LinkType   // PAGE | ARTICLE | CATEGORY | COURSE | EXTERNAL | CUSTOM
  targetId   String?    // page/article/category/course id
  url        String?    // external/custom
  iconType   IconType @default(NONE) // NONE | PRESET | MEDIA
  iconName   String?
  iconMediaId String?
  imageMediaId String?  // optional image for mega-menu / category tile
  openInNewTab Boolean @default(false)
  visibility Json?      // access rule inline or accessRuleId
  translations Json     // { [locale]: { label, description? } }
}
```

Header and footer are `CmsTemplate` rows with `kind = PART` and keys `header`, `footer`, `topbar`, `mobile-nav`. Their layouts use the same block system (Logo, Menu, Search, ThemeToggle, SocialLinks, Copyright, etc.) plus part-level style config (background per mode, sticky, transparency, height, border).

### 5.5 Theme

```prisma
model CmsThemeSettings {
  id       String @id @default(cuid())
  key      String @unique   // "default"
  tokens   Json             // { colors: { primary: { light, dark, hoverLight, hoverDark } ... }, typography, spacing, radius, shadows, motion }
  brand    Json             // { logoLightId, logoDarkId, faviconId, siteTitle, siteDescription }
  updatedAt DateTime @updatedAt
}
```

Extend the existing branding/settings model if audit 3.6 finds one; do not create a parallel theme store.

### 5.6 Access, redirects, audit

```prisma
model AccessRule {
  id                   String @id @default(cuid())
  visibility           Visibility // PUBLIC | LOGGED_IN | MEMBERS | PREMIUM | PRIVATE
  requiredRoles        Json?
  requiredEntitlements Json?      // reserved for subscriptions/plans/enrollments
  fallbackBehavior     String @default("placeholder") // "hide" | "placeholder" | "redirect"
}

model CmsRedirect { id String @id @default(cuid()); fromPath String @unique; toPath String; code Int @default(301); locale String? }

model CmsAuditLog { id String @id @default(cuid()); actorId String; action String; entityType String; entityId String; diff Json?; createdAt DateTime @default(now()) }
```

### 5.7 Relational vs JSON rule

Relational: anything routed, filtered, joined, or reported on (slugs, paths, status, locale, template links, menu items, media metadata, access rules, usage tracking). JSON (validated): the block tree, per-block props, block translations, theme tokens, effect parameters, navigation config, SEO template strings.

---

## 6. Block Registry & Module Integration Contract

### 6.1 Block definition shape

```ts
// packages/blocks/src/define-block.ts
export interface BlockDefinition<P> {
  type: string; // "news-grid"
  version: number; // 1, 2, ...
  label: string;
  category: "layout" | "content" | "marketing" | "learning" | "news" | "widget" | "part";
  icon: string; // icon library name
  schema: z.ZodType<P>; // props validation
  defaults: P;
  translatable?: (keyof P)[]; // props stored per-locale
  migrate?: Record<number, (old: any) => any>; // vN-1 -> vN
  seoFields?: boolean; // adds sectionTitle/sectionDescription/sectionTags
  supports: {
    styleOverrides?: ("background" | "textColor" | "padding" | "radius" | "shadow")[];
    hoverEffect?: boolean;
    loadingEffect?: boolean;
    entranceEffect?: boolean;
    responsive?: ("columns" | "layout" | "padding" | "fontSize" | "visibility")[];
    access?: boolean;
    children?: boolean; // container block
  };
  presets?: { name: string; props: Partial<P> }[];
}
// Server entry: packages/blocks/src/<type>/server.tsx  -> async RSC render(props, ctx)
// Editor entry: packages/blocks/src/<type>/editor.tsx  -> Puck fields + lightweight preview
```

Every block's stored node is:

```json
{ "type": "news-grid", "version": 1, "id": "ng_01", "props": { ... }, "translations": { "ur": { "sectionTitle": "..." } } }
```

### 6.2 Static vs dynamic

- Static block: props contain the content (`heading`, `image`, `buttonLabel`).
- Dynamic block: props contain a **query config** (`source`, `category`, `tag`, `limit`, `sort`, `featuredOnly`, `access`, `excludeContext`). Data is fetched inside the server render via `content-adapters`, wrapped in cache tags.
- Context-bound block (used in content templates): props reference `context` fields (`"titleField": "title"`, `"category": "context.category"`). The renderer injects the current content item.

### 6.3 Module integration contract (for News now, Courses/Tools later)

A module exposes CMS blocks by providing exactly four things:

1. **Query layer** in the module (already exists for News): typed functions with cache tags.
2. **Adapter** in `packages/content-adapters/<module>.ts`: normalizes to `{ id, slug, title, excerpt, image, date, url, category, tags, badges }` so cards are interchangeable.
3. **Public components** (existing News cards/list/grid/carousel) exported from the module or `packages/ui`.
4. **Block definitions** in `packages/blocks/src/<module>/*` referencing 2 and 3.

No changes to the builder are needed for a new module.

### 6.4 News block set (Phase 6)

`latest-news`, `featured-news`, `category-news`, `tag-news`, `analysis-list`, `news-grid` (2/3/4 cols), `news-list`, `news-compact`, `news-carousel`, `related-articles`, `news-hero` (context), `article-body` (context, Tiptap HTML sanitized), `article-meta` (context), `author-card` (context), `social-share`, `comments` (provider allow-list), `news-filter-bar` (client, drives listing via URL params), `news-pagination`.

All share `NewsCardVariant = "standard" | "featured" | "compact" | "horizontal"` mapped to existing components.

### 6.5 Core block set (Phases 2–3)

Layout: `section`, `container`, `columns`, `grid`, `stack`, `spacer`, `divider`.
Content: `heading`, `paragraph`, `rich-text`, `image`, `video`, `gallery`, `icon`, `button`, `link`, `quote`, `badge`.
Marketing: `hero` (variants: centered/split/image-bg/video), `cta`, `feature-cards`, `testimonials`, `stats`, `logos`, `pricing`, `faq`, `contact-form`, `newsletter-form`.
Widgets: `custom-html` (sanitized, permission-gated), `embed` (allow-listed providers), `economic-calendar`, `ticker`, `chart` (static JSON data or approved API), `tabs`, `accordion`, `carousel`.
Parts: `logo`, `menu`, `search`, `theme-toggle`, `social-links`, `copyright`, `language-switcher`.

---

## 7. Renderer, Routing, Caching

### 7.1 Renderer pipeline

```text
load version.layout
 → Zod validate (reject/repair with logged warnings)
 → run block migrations to current versions
 → resolve synced sections (CmsSection.synced = true) by id
 → resolve template parts (header/footer)
 → pick locale props: merge base props with translations[locale]
 → evaluate AccessPolicy per block with access rules (hide / placeholder)
 → for each node: registry[type].server.render(props, { locale, context, user, theme })
 → unknown type → FallbackBlock (renders nothing in prod, warning box in preview)
```

`renderTree` is pure with respect to inputs; all data fetching happens inside block renders (so caching is per block).

### 7.2 Routing (App Router)

```text
apps/web/app/[locale]/[[...slug]]/page.tsx     CMS pages + CMS listings (/, /about, /news, /courses)
apps/web/app/[locale]/news/[slug]/page.tsx     loads article + CONTENT template "single-news"
apps/web/app/[locale]/courses/[slug]/page.tsx  loads course + "single-course"
apps/web/app/[locale]/news/category/[category]/page.tsx  optional; or handled by listing page + filter params
```

Resolver order in `[[...slug]]`: redirects table → `CmsPageTranslation` by `(locale, path)` → draft mode check → published version → 404. `generateStaticParams` returns published paths; `revalidate` uses ISR with tag-based purge.

Reserved-path guard: the CMS refuses slugs that collide with explicit route files (`news/*`, `courses/*`, `admin`, `api`, `_next`).

Draft preview: `/api/preview?token&pageId&locale` enables Next.js draft mode and renders `draftVersionId`. The admin "Preview" button opens this in an iframe with device-width toggles.

### 7.3 Cache tags

| Tag                                                     | Set on                       | Invalidated by             |
| ------------------------------------------------------- | ---------------------------- | -------------------------- |
| `page:{id}`                                             | page render                  | page publish/unpublish     |
| `page-path:{locale}:{path}`                             | resolver                     | page publish, slug change  |
| `template:{key}`                                        | content template render      | template publish           |
| `part:header`, `part:footer`                            | part render                  | header/footer publish      |
| `menu:{key}`                                            | menu block                   | menu save                  |
| `theme`                                                 | root layout                  | theme save                 |
| `articles`, `article:{id}`, `category:{id}`, `tag:{id}` | existing News queries (keep) | article publish (existing) |
| `courses`, `course:{id}`                                | course queries               | course publish             |
| `media:{id}`                                            | image blocks                 | media replace              |

Publish flow: write version → set `currentVersionId` → `revalidateTag` for the page, its path, and any parts changed → audit log. Never `revalidatePath("/")` globally.

Multi-instance hosting (audit 3.10): if more than one Node instance, add a shared cache handler (Redis) so `revalidateTag` propagates.

---

## 8. Editor (Puck) Integration

### 8.1 Layout

Top bar: back, page name, undo/redo, device toggles (desktop 1440 / tablet 768 / mobile 375), language selector with status dots, preview, autosave status, Save draft, Publish (permission-gated).
Left: searchable block library grouped by category + Reusable sections + Presets.
Center: Puck canvas in an iframe using the **web app's CSS** (theme variables, fonts) so the design matches production.
Right: tabbed settings — General | Style | Effects | Responsive | SEO | Access | Link.

### 8.2 Custom Puck fields (in `packages/page-builder/fields`)

- `mediaField` — opens Media Library modal (folders, search, upload, select); stores `mediaId`.
- `colorField` — token selector (Primary/Secondary/…/Custom) + when Custom, two pickers (light/dark) with contrast preview and "lock to light" option.
- `effectField` — preset list with live demo card; "+ New preset" opens constrained builder (bounded sliders) that writes `CmsEffectPreset`.
- `linkField` — link type (Page/Article/Category/Course/External) with entity search; stores `{ linkType, targetId, url }`; resolved to URL at render so slug changes never break links.
- `iconField` — preset icon search + Media SVG option.
- `translatableText` / `translatableRichText` — edits the active locale, shows base-locale text as hint, "copy from EN" button.
- `responsiveField` — per-breakpoint values for columns/layout/padding/visibility.
- `accessField` — visibility dropdown + fallback behavior.
- `queryField` — for dynamic blocks: source, category, tag, limit, sort, featured, exclude-context.

### 8.3 Behaviors

- Inline editing: Puck's inline text editing for `heading`, `paragraph`, `button` label; rich text opens Tiptap inline for `rich-text`.
- Autosave to `draftVersionId` every N seconds after change (debounced), with optimistic lock (`updatedAt` check) and conflict toast.
- Duplicate/delete/reorder via Puck; "Save as section" and "Save as preset" from the block context menu.
- "Choose template" on page create shows previews from `previewImageId` (auto-generated screenshot in V2; static image in MVP).
- Preview opens the draft-mode URL in a modal iframe; hover/loading effects behave as in production because it _is_ the web app rendering.

---

## 9. Effects, Theme, Dark Mode

### 9.1 Token emission

`packages/theme` reads `CmsThemeSettings.tokens` and emits:

```css
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --shadow-md: ...;
  --radius-md: ...;
  --motion-normal: 300ms;
}
[data-theme="dark"] {
  --color-primary: #60a5fa;
  --color-primary-hover: #3b82f6;
  --shadow-md: ...;
}
```

Tailwind v4 `@theme` maps utilities to these variables (`--color-primary` etc.). Do **not** use `@theme inline` for values that change at runtime. The user's mode toggle (existing) switches the selector; admin never sets the mode.

### 9.2 Per-component overrides

Blocks that support `styleOverrides` accept `{ background: { mode: "token" | "custom", token?: "primary", light?: "#...", dark?: "#..." } }` and render as scoped CSS variables on the block root (`--blk-bg-light`, `--blk-bg-dark`) with classes `bg-[var(--blk-bg-light)] dark:bg-[var(--blk-bg-dark)]`. Custom hex is validated and contrast-checked in the editor.

### 9.3 Effect presets

Built-in `CmsEffectPreset` rows seeded on install:

- Hover: `none`, `lift`, `scale-up`, `color-shift`, `fade-text`, `glow-edge`, `image-zoom`, `underline-slide`.
- Loading: `none`, `skeleton`, `pulse`, `spinner`, `shimmer`.
- Entrance: `none`, `fade-in`, `fade-up`, `slide-left`, `scale-in`, `stagger-children`, `counter` (stats).

Each preset maps to a CSS class set in `packages/theme/effects.css` driven by CSS variables for duration/scale/offset. Admin-created presets only change those variables within bounds (duration 100–800 ms, scale 1.00–1.15, offset 0–40 px, stagger 0–200 ms). All animations sit under `@media (prefers-reduced-motion: no-preference)`. Entrance effects use a tiny IntersectionObserver client component.

### 9.4 Header/footer style config

Part-level config: background (token/custom per mode, or transparent-over-hero with scroll-solid), text color per mode, height (compact/normal/large), sticky, border, shadow, menu hover effect, active link style, transparency percentage. Stored in the part template's root props.

---

## 10. SEO System

### 10.1 Sources of auto-suggestion

- CMS page: first `heading`/`hero` text → title; first `paragraph`/`rich-text` excerpt → description; first image → OG image; `WebPage` schema.
- Content template: `seoTemplate` strings (`{{ title }} | MBX Pro`, `{{ excerpt }}`, `{{ featuredImage.url }}`, `NewsArticle` / `Course` / `BlogPosting`) filled from the content item's existing SEO fields first, then from content fields.
- Listing pages: page-level SEO plus `noindex` for `?page>1`, canonical without query params.

### 10.2 Override model

`CmsPageTranslation` holds per-locale overrides; empty field = use suggestion (UI shows suggestion greyed with "Accept"/"Edit"). Article-level SEO stays in the News module; the content template only fills gaps.

### 10.3 Section-level SEO

Blocks with `seoFields: true` expose `sectionTitle` (rendered as H2/H3 with correct hierarchy), `sectionDescription`, `sectionTags`. V2 adds `ItemList`/`FAQPage` schema emission for grid/FAQ blocks.

### 10.4 Implementation

`generateMetadata` in each route calls `cms.seo.build({ page|content, locale })`; JSON-LD emitted via a `<script type="application/ld+json">` from a server helper; sitemap route reads `includeInSitemap` per translation; `hreflang` alternates built from translations.

---

## 11. Multilingual

### 11.1 Page level

`CmsPageTranslation` per locale: title, slug, path, SEO, status. Missing locale → fall back to default locale content with a `MISSING` badge in admin; public site either falls back or 404s per a global setting.

### 11.2 Block level

Translatable props (declared in `translatable`) are stored as `translations[locale][prop]` inside the node. Non-translatable props (layout, colors, query config, media) are shared. Renderer merges base props with locale props.

### 11.3 Admin UX

Language selector in top bar with status dots (● Published / ◐ Draft / ○ Missing). Switching locale re-renders the canvas with that locale's text. "Copy content from EN" clones translatable props into the target locale as a draft. Missing-translation warnings on publish. Language-specific preview.

### 11.4 RTL

Existing next-intl RTL machinery is respected; block styles use logical properties (`ps-`, `pe-`, `ms-`, `me-`) so layouts mirror correctly; icons with direction flip via a `rtl:` variant.

---

## 12. Media Library

- Admin area `Website → Media`: grid/list, folders tree, search, filters (type, folder, tag, date, unused), preview, rename, alt/caption/description editing, replace (keeps id → all usages update), delete (blocked with usage list if used), bulk move/tag/delete, upload with drag-drop and progress.
- Upload pipeline: MIME + extension validation, size limits per type, image dimension extraction, thumbnail generation, SVG sanitization (strip scripts/handlers/foreignObject) or serve via `<img>` only, checksum for dedupe.
- `StorageDriver` interface: `put`, `get`, `delete`, `url`, `exists`. `LocalDriver` writes under a configured public path; `S3Driver` (R2/S3/MinIO) later, switch by env. No call-site changes.
- Delivery: Next `<Image>` for images with a driver-aware loader; video via allow-listed embeds now, optional self-hosted later.
- `MediaUsage` maintained on every page/template/section/menu/theme save by walking the JSON for `mediaId` fields.

---

## 13. Menus, Header, Footer

- Menu builder: tree with drag-reorder and nesting, item editor (link type + entity search, label per locale, icon preset/media, optional image, open in new tab, visibility).
- Locations: `main`, `footer`, `mobile`, `topbar`, plus custom keys. The `menu` block in header/footer parts references a menu key.
- Header/footer parts editable in the same Puck editor with the part block set; style config per 9.4.
- Migration: audit 3.9 decides whether current settings-driven navigation is imported into `CmsMenu` with a one-time script.

---

## 14. Access Control

- `AccessRule` attached to pages, blocks (via `accessField`), and (already) domain content. Single `AccessPolicy.can(user, rule)` in `packages/access`.
- MVP evaluation: `PUBLIC` always; `LOGGED_IN` needs session; `MEMBERS`/`PREMIUM` check roles; `PRIVATE` admin only. `requiredEntitlements` is stored but ignored until subscriptions exist.
- Renderer applies `fallbackBehavior`: hide, render paywall placeholder block (with CTA), or redirect (page-level only).
- Dynamic blocks pass `access` to adapters so premium items are filtered server-side; never rely on client hiding.

---

## 15. Publishing Workflow

MVP: Draft → Preview → Publish → Update → Unpublish. Every page has `draftVersionId` (autosaved) and `currentVersionId` (published). Publish copies draft to a new version and points current at it. Unpublish clears current. Every action writes `CmsAuditLog` and triggers tag revalidation.

V2: revision list, diff (JSON tree diff rendered as block-level changes), restore, scheduled publish (`scheduledAt` + cron/queue), review status, publish permission separate from edit permission, shareable preview tokens with expiry, optimistic locking with conflict resolution UI.

---

## 16. Security

- Closed registry; no `eval`, no dynamic imports from data.
- Rich text sanitized server-side at save with `sanitize-html` allow-list (headings, lists, links with `rel="noopener"`, images by media id, tables, code). `javascript:` and `data:` URLs rejected.
- `custom-html` block: sanitized with a stricter allow-list (no script, no iframe unless from allow-list, no inline handlers, no `style` unless whitelisted properties), requires `cms.blocks.custom_html` permission, shows a warning banner in editor, and is logged.
- `embed` block: provider allow-list (YouTube, Vimeo, TradingView, X/Twitter, etc.) with URL pattern validation; rendered in sandboxed iframes.
- SVG uploads sanitized; media served from non-executable paths; MIME sniffing.
- Strict CSP with nonces on the web app; admin routes and server actions guarded by CMS permissions; rate limits on upload.
- Access checks in renderer and adapters (server-side).

---

## 17. Phased Implementation Plan

Each phase lists tasks, deliverables, and acceptance criteria. Phases 0–6 are the MVP. Estimates assume one focused engineer plus Claude Code; adjust after Phase 0.

### Phase 0 — Audit (Section 3)

Deliverable: `docs/cms/00-audit.md`, updated decisions, ADRs for: Puck adoption, JSON-in-MariaDB, token-based theme, hybrid routing.
Accept: every checklist item answered; Sections 4–13 amended; no code written.

### Phase 1 — CMS Foundation

Tasks: Prisma models 5.1, 5.6 (pages, translations, versions, redirects, audit, access rule); `packages/cms` services (create/update/publish/unpublish/duplicate page, translations, slug validation, reserved-path guard); `packages/access` skeleton; CMS permissions; page resolver; `[[...slug]]` route rendering a minimal placeholder from the page title; cache tag helpers; admin "Website → Pages" list/create/edit-metadata screens (no builder).
Accept: admin creates "About" with EN/UR titles and slugs → `/en/about` and `/ur/about` render the title; unpublish → 404; slug change → old path redirects; publish invalidates only that page's tags.

### Phase 2 — Block Registry & Renderer

Tasks: `packages/blocks` with `defineBlock`, registry, versioning/migration; `packages/renderer`; `packages/theme` token emitter wired to existing branding; core layout + content blocks (section, container, columns, grid, stack, spacer, divider, heading, paragraph, rich-text, image, button, link, badge); style override plumbing; effect preset seed + CSS; fallback block; JSON fixtures.
Accept: a hand-written page version renders correctly in web with theme tokens in light and dark; a block schema bump with `migrate` renders an old fixture correctly; unknown block renders nothing in prod and a warning in preview.

### Phase 3 — Visual Builder

Tasks: `packages/page-builder` Puck wrapper; canvas iframe with web CSS; custom fields 8.2; inline editing; autosave with optimistic lock; undo/redo; duplicate/delete/reorder; device toggles; draft-mode preview endpoint + modal; language selector with block translations; settings tabs (General/Style/Effects/Responsive/SEO/Access/Link); marketing blocks (hero variants, cta, feature-cards, testimonials, stats, logos, pricing, faq, contact-form, newsletter-form); widgets (custom-html sanitized + permission, embed allow-list, tabs, accordion, carousel); SEO auto-suggest + override UI; page-level Link tab (parent page, back/breadcrumb/prev-next options).
Accept: the Section 58 success workflow through "Reorder sections → Preview desktop/mobile" completes with no developer involvement; hover/loading/entrance effects visible in preview; custom hex with poor contrast is warned; a user without `custom_html` permission cannot add that block.

### Phase 4 — Media Library

Tasks: `packages/media` drivers and pipeline; Media models; admin Media area (12); `mediaField` integration into every media-bearing block; usage tracking on save; replace/delete guards.
Accept: upload image/SVG/video, use in hero and image blocks, replace the image → all usages update; delete blocked while used; switching `MEDIA_DRIVER=s3` in a test env works with no code change.

### Phase 5 — Templates, Sections, Presets

Tasks: template models and versions; page-create flow with template chooser and previews; "Save page as template"; reusable sections (copy mode) with "Save as section" and library insertion; block presets ("Save as preset" with design-only option); built-in preset library (18 of your plan: hero/card/news/media/FAQ/testimonial/form presets); template duplicate/preview.
Accept: create "Trading Course Landing Page" template from an existing page; new page from it renders identically; a saved "Newsletter CTA" section inserted on three pages; a saved "Forex Course Card" preset applies design without content.

### Phase 6 — News & Analysis Integration (critical milestone)

Tasks: `packages/content-adapters/news.ts` over existing queries; refactor News UI into reusable components (no behavior change); News block set 6.4; content templates `single-news` (context-bound) and `news-listing`; convert `/news` into a CMS page seeded from the current design; `/news/[slug]` loads article + template; SEO auto-suggest from article fields; extend existing cache tags; filter bar + pagination with URL params and preserved state on back navigation; related articles; comments provider allow-list.
Accept (end-to-end): publish an article in the News module → within one request cycle it appears in Latest News on Home and `/news` and renders at `/news/{slug}` using the admin-designed template with correct SEO/JSON-LD in EN and UR; changing the `/news` design in the builder requires no code change; no article data is duplicated in CMS tables.

### Phase 7 — Courses & Future Dynamic Content

Tasks: `content-adapters/courses.ts`; course blocks (grid, cards, lesson list, learning paths, instructor cards, related courses, progress where user is logged in); `single-course` and `course-listing` templates; glossary/tools/market/economic-calendar blocks as adapters exist.
Accept: same end-to-end test as Phase 6 for a course; adding a new module block requires only the four contract items in 6.3.

### Phase 8 — Menus, Header, Footer

Tasks: Menu models and builder; `linkField` reuse; header/footer/topbar/mobile-nav as PART templates with part block set and style config; migrate existing navigation via script; `menu:{key}` and `part:*` cache tags.
Accept: admin builds main and footer menus with icons, nests a dropdown, sets header transparent-over-hero with sticky solid on scroll, previews light/dark; renaming a page slug does not break menu links.

### Phase 9 — Theme & Visual System

Tasks: Theme admin (brand, colors per mode, typography from curated fonts, spacing/radius/shadows, button/card/badge styles); effect preset builder (bounded); badge system (Featured/New/Premium/Free/Analysis/Breaking/Popular/Updated) with semantic colors; RTL checks; reduced-motion checks; contrast checks.
Accept: changing Primary in admin re-skins all pages after `theme` revalidation; user toggling dark mode switches every override correctly; no hex in web layer outside emitted variables.

### Phase 10 — Multilingual Completion

Tasks: translation status dashboard per page; copy-from-language; missing-translation warnings on publish; language preview; per-locale SEO and `hreflang`; per-locale sitemap; fallback policy setting.
Accept: Section 58 "Add Urdu translation → Preview Urdu → Publish" works; `/ur/about` has Urdu metadata and RTL layout.

### Phase 11 — Publishing & Revisions

Tasks: revision list, block-level diff, restore, scheduled publishing, review status, publish permission split, preview tokens with expiry, conflict resolution UI, audit history screen.
Accept: restore a revision from a week ago; schedule a publish and verify it goes live and invalidates tags.

### Phase 12 — Production Hardening (Section 18)

---

## 18. Testing & Hardening

- **Unit:** Zod schemas, migrations per block, `renderTree` determinism (same input → same output), AccessPolicy matrix, SEO builder, slug/path validation, sanitizer allow-lists (with XSS corpus), storage drivers.
- **Integration:** publish → tag invalidation → re-render; News publish → block update; media replace → usage update; menu save → header refresh; translation fallback.
- **E2E (Playwright):** the Section 58 workflow in full; drag/drop reorder; inline edit; preview in three widths; dark/light toggle; back-navigation filter preservation; permission-gated custom HTML.
- **Visual regression:** snapshots of each block preset in light/dark, LTR/RTL, at 375/768/1440.
- **Accessibility:** keyboard operation of the admin builder and public widgets; focus states; ARIA on carousels/accordions; reduced-motion honored; contrast on token defaults and warned on overrides.
- **Performance:** Lighthouse budgets for `/`, `/news`, `/news/{slug}`; verify `x-nextjs-cache` HIT after warm; dynamic block query limits; image sizes.
- **Security:** CSP report-only then enforce; upload fuzzing; sanitizer bypass tests; access leakage tests for premium items in grids and search.
- **CI gates:** `lint`, `typecheck`, `test`, `build` for all packages; block fixture render test for every registered block.

---

## 19. Risks & Mitigations

| Risk                                         | Mitigation                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Puck is pre-1.0; breaking changes            | Pin exact version; all Puck code in `packages/page-builder`; our JSON/blocks are Puck-agnostic; upgrade behind a feature flag          |
| Block evolution breaks old pages             | Per-block `version` + `migrate`; fixture tests for every historic version; fallback block                                              |
| News refactor regresses current site         | Refactor to components with snapshot tests before converting `/news`; feature flag to switch `/news` between legacy route and CMS page |
| Over-invalidation or stale cache             | Tag matrix in 7.3; integration tests; shared cache handler if multi-instance                                                           |
| Admin-authored content XSS                   | Closed registry, server sanitization, CSP, permission-gated custom HTML, tests with XSS corpus                                         |
| Translation model drift                      | Translations in schema from Phase 1; renderer merge logic tested early                                                                 |
| Scope creep toward WordPress clone           | MVP boundary = Phases 0–6; V2 = 7–11; anything else needs an ADR                                                                       |
| Theme collides with existing branding system | Phase 0 audit decides extend-vs-migrate; single source of truth for tokens                                                             |
| Performance of many dynamic blocks per page  | Per-block cache tags, query limits (max 24), pagination, no N+1 (adapters batch)                                                       |

---

## 20. Hand-off Instructions for Claude Code

1. Read this document and the audit checklist (Section 3). Do **not** write builder code before `docs/cms/00-audit.md` exists and Sections 4–13 have been reconciled with the real codebase.
2. Create ADRs for: Puck adoption and pinning; JSON block tree in MariaDB with Zod validation; token-based theme extension; hybrid routing (catch-all + explicit content routes).
3. Implement phases in order. Each phase ends with its acceptance criteria demonstrated and CI green (`lint`, `typecheck`, `test`, `build`).
4. Package rules: `apps/web` never imports `page-builder` or `blocks/editor`; domain modules never import `cms`; `content-adapters` is the only bridge from blocks to domain modules.
5. Every block must ship with: Zod schema, defaults, `version`, server render, editor fields, at least one preset, a JSON fixture, and a render test in light/dark.
6. Every publish path must call the revalidation helper with the tags in 7.3 and write an audit log entry.
7. Never add a block, field, or setting that lets an admin inject executable JavaScript; custom HTML always goes through the sanitizer and the permission check.
8. Keep dark/light mode user-controlled; admin inputs are always per-mode values, never a mode switch.
9. When something in this plan conflicts with what the audit finds, prefer extending the existing system and record the deviation in an ADR.

### MVP definition (what "done" means for the first release)

Phases 0–6 complete: admin can create pages with the visual builder, use templates/sections/presets and the media library, control effects and per-mode colors, edit SEO with suggestions, manage EN/UR/AR translations at block level, preview drafts on three widths, publish with correct cache invalidation, and `/news` plus article detail pages are fully CMS-composed over the unchanged News module.
