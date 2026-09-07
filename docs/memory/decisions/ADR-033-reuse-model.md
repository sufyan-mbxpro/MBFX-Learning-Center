# ADR-033: Reuse is either _linked_ or _start from_ — `StylePreset` (by reference), `LayoutTemplate` (by copy), one `ContentReference` table for usage and integrity

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** ADR-023 **in part** (its §6 "`BlockPreset` is not built" — a copy-semantics template is built under the name "Start from", exactly the honest naming that section required) · ADR-027 **in part** (§4: part presets become `LayoutTemplate{kind: PART}` rows instead of loose seeded `PageVersion` layouts; apply-by-copy semantics unchanged) · ADR-025 **in part** (adds the `style-preset:{id}` tag)
**Superseded by:** —

## Context

The owner's brief asks for section presets, component presets, effect
presets, page templates, layout presets, style/design presets and reusable
content blocks, managed "without creating duplicate data", and for the UI
to make it impossible to create a globally linked thing when a copy was
intended.

Plan v2 already has both reuse semantics without naming them: `CardTemplate`
is a **reference** (edit once, every placement follows — ADR-023); part
presets and "duplicate page" are **copies** (ADR-027 §4, ADR-021 §7). v1's
`CmsEffectPreset` builder was rejected (ADR-024 §2) and stays rejected —
but the real need behind "effect presets" is _a named bundle of choices an
admin can apply in one click_, which needs no builder.

Three of the review's required reports — media usage, template/preset
usage, broken links — and two guards — card-template and media deletion
(ADR-023 §5 assumes "the same guard the media library uses", which does not
exist) — all need the same thing: knowing which saved layouts reference
which ids.

## Decision

### 1. Two semantics, two words, two tables

| Semantics      | UI verb                            | Meaning                                                        | Rows                                                                                                                                     |
| -------------- | ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Linked**     | "Use design…" / badge **Linked**   | the node stores an id; editing the row updates every placement | `CardTemplate` (ADR-023) · **`StylePreset`** (new) · header/footer/announcement parts by id (ADR-027) · `Section` (Phase 9, its own ADR) |
| **Start from** | "Start from…" / "Save as template" | the layout is **copied** into the page and is then independent | **`LayoutTemplate`** (new) — `kind: PAGE \| SECTION \| BLOCK \| PART`                                                                    |

No third mechanism. The composer never offers an action whose semantics
are not one of these two words, and the badge on a linked node is always
visible in the tree panel.

```prisma
model StylePreset {
  id           String   @id @default(cuid())
  key          String   @unique @db.VarChar(80)
  name         String   @db.VarChar(120)
  scope        String   @default("any") @db.VarChar(60)   // "any" | a block type | "widget"
  config       Json     // StyleChoices + MotionChoices (ADR-032 §2, ADR-024 §2) — same Zod as node.style.overrides
  isSystem     Boolean  @default(false)                   // seeded; clone-only
  createdById  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum LayoutTemplateKind { PAGE SECTION BLOCK PART }

model LayoutTemplate {
  id             String   @id @default(cuid())
  key            String   @unique @db.VarChar(80)
  name           String   @db.VarChar(120)
  kind           LayoutTemplateKind
  pageKind       PageKind?          // PAGE templates: which kind they seed
  partKey        String?            // PART templates: header | footer | announcement | … (ADR-027 presets)
  layout         Json               // a full tree (PAGE/PART), a subtree (SECTION) or one node (BLOCK) — Zod-validated
  previewImageId String?
  isSystem       Boolean  @default(false)
  createdById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### 2. `StylePreset` — what "effect preset" and "style preset" actually are

- `node.style = { presetId?, overrides? }` (ADR-032 §1). The renderer
  resolves the preset once per page (cached, tag **`style-preset:{id}`**,
  added to the frozen vocabulary in architecture.md #12) and applies
  `overrides` on top.
- A preset is **choices only** — the same `StyleChoices` + `MotionChoices`
  enums a node may hold. No hex, no sliders, no CSS: ADR-024 is unchanged,
  and "effect preset", "button preset", "card hover preset", "section
  style" are all one table with a `scope`.
- Editing a preset updates every placement; deleting one referenced by any
  published version is refused with the usage list (§4). A missing
  reference renders the node's own `overrides` and logs.
- Seed: `hero-dark`, `hero-light-image`, `band-primary`, `card-lift`,
  `section-muted`, `section-plain` — enough that a first page needs no
  preset authoring.

### 3. `LayoutTemplate` — what "page template", "section preset", "block preset" and "part preset" are

- **PAGE** — "Create page → Start from": Landing · Tool page · Legal page ·
  Contact · Blank (seeded). Copies `layout` into the new page's draft and
  records `PageVersion.templateKey` (ADR-032 §6).
- **SECTION** — a subtree inserted by copy from the block picker; **BLOCK**
  — one configured node (a "widget preset", a "CTA preset") inserted by
  copy. Both come from **"Save as template"** on any node in the composer.
- **PART** — ADR-027 §4's header/footer/announcement presets, moved into
  this table so they are listed, previewed and managed like every other
  template. "Apply preset" copies into the part's draft version, as before.
- After insertion a copy is independent: no `templateKey` on the node, no
  link, no propagation. The picker labels every entry **Start from**.
- **Layout presets, responsive presets, calculator-UI presets,
  dashboard/widget presets are not separate entities** — each is a SECTION
  or BLOCK template. Reusable _inputs, buttons, tables, icons as
  admin-designed components_ are not a CMS feature at all: `@repo/ui`
  variants + `StylePreset` cover them; a new component is a code change
  with a contrast test (ADR-024).

### 4. `ContentReference` — one table for usage, guards and integrity

```prisma
enum ReferenceSourceType { PAGE_VERSION MENU_ITEM CARD_TEMPLATE STYLE_PRESET LAYOUT_TEMPLATE ARTICLE COURSE BRAND SETTING }
enum ReferenceType       { MEDIA CARD_TEMPLATE STYLE_PRESET WIDGET PART PAGE ARTICLE ARTICLE_CATEGORY ARTICLE_TAG COURSE GLOSSARY_TERM }

model ContentReference {
  id         String @id @default(cuid())
  sourceType ReferenceSourceType
  sourceId   String
  refType    ReferenceType
  refId      String
  field      String? @db.VarChar(120)   // "style.presetId", "props.image", "props.link"
  @@index([refType, refId])
  @@index([sourceType, sourceId])
}
```

- Written **on save** by the owning service through one helper,
  `syncReferences(source, refs[])`, which diffs and replaces the rows for
  that source. `@repo/core/cms` walks the tree once on every
  `PageVersion`/`LayoutTemplate`/`CardTemplate` write and collects media
  ids, card ids, style ids, widget keys, part ids and every `LinkTarget`
  (ADR-031 §5). Articles, menu items, brand assets and settings call the
  same helper for their media and link fields.
- **Never scanned on read.** "In use" = referenced by a page's current
  draft or published version, a menu item, or a system row.
- Serves: media usage + deletion guard (ADR-034), card/style/template
  deletion guards and usage counts, widget usage, part usage ("pages
  overriding the header"), the **Broken links** and **Missing media**
  reports (a join against the target table's existence and status), and
  the "widgets with no registered runtime" row (ADR-030).

### 5. Permissions

`cms.templates.manage` · `cms.styles.manage` (seeded in the PR that first
calls them). System rows are clone-only, matching ADR-016/ADR-023.

## Consequences

- **Two more tables and one more tag.** Both small; both replace ad-hoc
  mechanisms the plan already needed (part presets, usage counts).
- **A "Start from" copy can drift from its template.** That is the
  definition of a copy, and the badge/verb rule exists so nobody is
  surprised. Admins who want propagation use a linked thing.
- **Every save does a tree walk.** Linear in nodes, once per save, in the
  same transaction; a `PageVersion` of a few hundred nodes is milliseconds.
- **`StylePreset` deletion can be refused** with a long list. The list is
  the feature.
- **ADR-027's presets move tables.** No seeded data exists yet; nothing to
  migrate.

## Alternatives considered

- **A single `Preset` table with a `kind` covering both semantics.**
  Rejected: one table for two behaviours is how admins end up with a
  "preset" that sometimes propagates and sometimes does not.
- **A table per preset type** (button, card, section, effect, page…).
  Rejected: identical rows with different names; the owner's rule 11
  forbids it.
- **Synced sections now** (skip Phase 9). Rejected: still cheaper after
  card-template reference semantics have proven themselves — plan §12
  Phase 9's reasoning stands. `LayoutTemplate{SECTION}` covers the copy
  case meanwhile.
- **Usage by scanning `PageVersion.layout` on demand.** Rejected: a JSON
  scan across every version on every media delete or dashboard load;
  `ContentReference` costs one walk per save instead.
- **Foreign keys from a relational node table.** Rejected — ADR-021 keeps
  the tree as JSON; `ContentReference` is the integrity index for it.

## Compliance

- Contract tests: `StylePreset.config` and `LayoutTemplate.layout` validate
  with the same schemas as nodes; a preset accepting hex fails the
  ADR-024 regex test.
- Propagation test: edit a `StylePreset` → two pages render the change
  after `style-preset:{id}` invalidation; fallback test for a missing id.
- Copy test: insert a `LayoutTemplate`, edit the template → the placed copy
  is unchanged; the node carries no template id.
- Reference tests: saving a version writes the expected `ContentReference`
  rows and removes stale ones; deleting a referenced media asset, card
  template or style preset is refused with the source list; the broken-link
  report lists an unpublished target.
- UI test: every reuse action in the composer carries one of the two verbs;
  linked nodes show the badge in the tree panel.
- `check-permission-keys` covers `cms.templates.manage`,
  `cms.styles.manage`.
