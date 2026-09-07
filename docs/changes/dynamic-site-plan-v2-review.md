# Review — Plan v2 (Module 16) against the admin-UX, presets and future-tools brief

**Reviewed:** 2026-09-04
**Subject:** `docs/MBX-Dynamic-Site-Control-Plan-v2.md` (v2.0) + ADR-020…029,
`docs/cms/00-reconciliation.md`, `.claude/skills/website-builder/SKILL.md`
**Verified against:** the repository at commit `49377f4` + uncommitted
planning docs — `packages/db/prisma/schema.prisma`, `packages/ui/src/
components/*`, `packages/core/src/*`, `packages/utils/src/calculators.ts`,
`apps/web/app/(public)/[locale]/_sections/*`, `_components/*`
**Brief:** the owner's two-part review request (general plan review +
"fully flexible visual design system" test). Both parts are answered here.
**Disposition (2026-09-04):** accepted by the owner as the required
amendment checklist. Applied the same day: ADR-030 (widget registry),
ADR-031 (link targets), ADR-032 (node schema v1 + page-model amendments),
ADR-033 (reuse model + `ContentReference`), ADR-034 (media v2); plan v2 →
**v2.1** (§3.1 lists the changes; §17 carries the 13-case architecture test
and the final acceptance criteria); header-line updates on ADR-020…028;
SKILL.md rules 16–21; every §2 inconsistency below resolved. The one
deliberate deviation from §11.C: `PageVersion` columns landed in ADR-032
rather than a separate note, and part presets moved into `LayoutTemplate`
(ADR-033) so there is exactly one copy-semantics table.

Classification used throughout:

| Tag                         | Meaning                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| **[A] Already supported**   | in the plan or an ADR, as written                                                       |
| **[B] Partially supported** | the mechanism exists but the requirement is not fully covered, or the plan is ambiguous |
| **[C] Missing — add**       | should be in the plan before Phase 1 or the named phase starts                          |
| **[D] Optional / future**   | worth an ADR later; not needed to start                                                 |

---

## 0. Two corrections to the brief's premises

The second half of the brief says: _"The current plan already has Puck
drag/drop, inline text editing, media library, static/dynamic blocks,
templates, sections, presets, and dynamic content adapters"_ and later
_"The current plan already proposes an effect preset library and
constrained effect builder"_ and _"already includes reusable sections,
templates and block presets."_

That describes **v1**, not v2. v2 deliberately reversed most of it:

| Brief assumes                                      | v2 actually says                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Puck drag-and-drop, inline canvas editing          | **Spike-gated, not locked** (ADR-026). MVP editor is a form-based composer; inline text editing is explicitly _not_ available (ADR-026 §Consequences). |
| Effect preset library + constrained effect builder | **Rejected** (ADR-024 §2): motion is a bounded enum, "no `CmsEffectPreset` table and no slider-based preset builder".                                  |
| Block presets                                      | **Not built** (ADR-023 §6): copy-semantics presets are a support burden.                                                                               |
| Reusable / synced sections                         | **Phase 9, post-MVP** (§12, §15).                                                                                                                      |
| Page templates                                     | **Not in MVP** (ADR-021 §7): "use duplicate this page".                                                                                                |
| Media library with folders / tags / usage          | **Only a minimum picker** in Phase 3 (select + upload + alt); the full library is Module 11 deferred work.                                             |
| `mediaField`                                       | does not exist in v2.                                                                                                                                  |

Every recommendation below is therefore made against v2 as written. Where
the brief wants something v2 rejected, this review says whether the
rejection should stand (most of ADR-024 should) or be softened (presets,
backgrounds, responsive props should).

## 1. Verdict

The plan's **rendering architecture is sound and future-proof**: pages as
validated versioned JSON, a closed block registry with migrations,
providers injected into a pure renderer, two-pass resolution, card
templates by reference, tag-based invalidation, and the publish gates. None
of that needs restructuring for anything in the brief.

Three things are genuinely missing and should be added **before Phase 1**,
because each touches the node schema or a contract that later phases
freeze:

1. **A feature-widget contract.** The plan's only hook for tools is
   `data-widget` with a `variant` enum over `DataProvider` keys (Phase 7).
   That is the "NewsPageBuilder" mistake reappearing for tools: a Pip
   Calculator is not `load(params) → T`, and every new tool would edit the
   `data-widget` variant list — i.e. a CMS change. The fix is a third
   registry, **widgets**, injected into `renderTree` exactly like
   providers. Detailed in §5. This is the most important finding.
2. **Node-level essentials that every builder needs and the node schema
   does not yet carry:** `hidden`, `label`, `anchor`, bounded responsive
   values, and a **resolved-at-render `LinkTarget`** for every link prop
   (buttons, CTAs, image links) — the same polymorphic target ADR-028 gives
   menus. Without the last one, "broken link detection" and "slug change
   never breaks a link" are true for menus and false for every button on
   every page.
3. **Media beyond images.** `storeImage()` is image-only. The brief needs
   video (self-hosted and embedded), documents and per-asset metadata.
   The plan's §11 says embeds exist by allow-list; §6.2 has no `video` or
   `embed` block; §15 defers "embed blocks" with no date. That is an
   internal contradiction to resolve, and the answer is cheap because
   `video-embeds.ts` already ships.

Everything else in the brief is either already supported, a small schema
addition, or correctly deferred. The presets question (§4) has a clean
answer that does **not** reopen ADR-023/024: two honest mechanisms,
_linked_ (by reference) and _start from_ (copy), with one table each.

## 2. Inconsistencies and stale references in the document set

Each is small; together they would confuse whoever starts Phase 1.

| #   | Where                                                                                                                                    | Problem                                                                                                                                                                                                                                                                                                   | Fix                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Plan §10 step 3                                                                                                                          | Still says "≤ 6 provider-backed blocks, every collection `limit ≤ 24`" as a **hard gate**. §2 and ADR-029 §5 say no cap lives in code and `cms.dataBudget` is a setting.                                                                                                                                  | Rewrite step 3: budget from settings (warn/block); keep `limit ≤ 24` only as the **request-side** cap on URL-derived params (ADR-022 §4), which is security, not design policy. State that distinction once. |
| 2   | ADR-022 §4 / SKILL rule 5 vs SKILL rule 14                                                                                               | Rule 5 hard-codes `limit ≤ 24, page ≤ 200`; rule 14 says "if you write a cap into a Zod schema, that is the bug".                                                                                                                                                                                         | Same fix as #1: name the two kinds of limit (request caps vs authored budgets).                                                                                                                              |
| 3   | `docs/plan.md` Module 16 ("ADR-020…ADR-028"), Part F row 11 ("ADR-020…026"), SKILL.md line 3 ("ADR-020…026 are the binding decisions")   | Stale ranges; the binding set is ADR-020…029.                                                                                                                                                                                                                                                             | Update the three strings.                                                                                                                                                                                    |
| 4   | ADR-020 table row "Menus, header, footer — out of builder MVP scope"; reconciliation §9 "header/footer … out of the builder's MVP scope" | Superseded by ADR-027 but ADR-020's `Superseded by:` header is still `—`.                                                                                                                                                                                                                                 | Header-line edit on ADR-020 (allowed by governance); add a one-line "superseded by ADR-027" note to reconciliation §9.                                                                                       |
| 5   | Plan §11 vs §6.2 vs §15                                                                                                                  | §11 specifies how embeds are made safe; §6.2 has no `video`/`embed` block; §15 defers "embed blocks".                                                                                                                                                                                                     | Add a `video` block (MEDIA or allow-listed EMBED source) to §6.2 MVP; keep `custom-html` deferred.                                                                                                           |
| 6   | Plan §8 "autosave to `draftVersionId` with an optimistic-lock conflict toast" vs ADR-021 `PageVersion`                                   | No `updatedAt` / revision counter on `PageVersion`; optimistic locking has nothing to compare. Also unclear whether each autosave is a new `PageVersion` row (history explodes) or an in-place write (history = publishes only).                                                                          | Decide: the draft version is **mutable in place**, carries `updatedAt` + `revision Int`, and publish snapshots it. Add both columns.                                                                         |
| 7   | ADR-023 §5 "the same guard the media library uses"                                                                                       | No such guard exists — `MediaAsset` has no usage tracking and no delete guard in code.                                                                                                                                                                                                                    | Make usage tracking a stated deliverable (§7 below).                                                                                                                                                         |
| 8   | Plan §12 Phase 3 "set alt text"                                                                                                          | `MediaAsset` has no `altText` column; alt is contextual and translatable, so it belongs on the placement, not only the asset.                                                                                                                                                                             | Alt = translatable prop on the `image` node, with `MediaAsset.altText` as the default. State it.                                                                                                             |
| 9   | ADR-021 `PageKind.DATA`                                                                                                                  | A `DATA` page is "a page over a non-content provider", but a STATIC page holding a `data-widget` block is the same thing. The kind adds a taxonomy value with no distinct renderer behaviour.                                                                                                             | Either drop `DATA`, or redefine it as "route-param-driven data page" (`/rates/[pair]`) — the DETAIL analogue for a `DataProvider`. Calculators live on STATIC pages.                                         |
| 10  | Plan §7.2 reserved paths                                                                                                                 | The list matches today's `[locale]` route directories exactly (verified). It omits root-level files the catch-all would otherwise let an admin shadow in the DB — `sitemap.xml`, `robots.txt`, `favicon.ico` — and has no rule for paths future modules will claim (`/tools`, `/search`, an EA hub area). | Add the three root files; state that the unit test enumerates route files **and** a `RESERVED_PREFIXES` constant that new modules append to in their own PR.                                                 |
| 11  | Plan §8 admin list "one `DataTable` list (kind, content type…)" vs §8.1                                                                  | DETAIL and PART pages have no URL and different verbs; one flat list with a `kind` column contradicts the vocabulary rule.                                                                                                                                                                                | Tabs: **Pages** (STATIC/COLLECTION) · **Designs** (DETAIL) · **Global** (PART).                                                                                                                              |
| 12  | ADR-020 rule 4 / native reuse                                                                                                            | "`blocks-native` later against the same schemas" only works if the definitions subpath has **no `@repo/ui` import**. Not stated.                                                                                                                                                                          | Add: `@repo/blocks/definitions` imports only `@repo/contracts` + `@repo/i18n` keys. Same rule for widget definitions (§5).                                                                                   |
| 13  | Renderer + Tailwind v4                                                                                                                   | Token→class mapping is described, but not the constraint that classes must be **statically present** (Tailwind scans source). A renderer that concatenates `bg-${token}` produces classes that do not exist in the CSS.                                                                                   | State: every enum→class mapping is a literal lookup table; a test asserts each emitted class exists in the built CSS. Applies doubly to responsive variants (§3).                                            |

## 3. Page builder / section management — checklist

| Requirement (brief)                                                   | Status                      | Notes / what to add                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add / remove / reorder / duplicate blocks                             | **[A]**                     | §8 composer; drag reorder as `/admin/navigation`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Nested layouts (columns, grid) in a **form-based** composer           | **[B]**                     | `children` is supported but a flat ordered list cannot show nesting. Add a **tree / layers panel** as the composer's primary navigation (Phase 3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Hide / disable a block without deleting                               | **[C]**                     | Add `node.hidden: boolean` (renderer skips; composer dims). Distinct from `visibility` (audience).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Rename / label a block for admins                                     | **[C]**                     | Add `node.label?: string` (admin-only, not rendered).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Lock a block                                                          | **[D]**                     | `node.locked` — only useful with multi-editor teams. Skip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Section anchor for in-page links                                      | **[C]**                     | `section.anchor` slug prop; `LinkTarget` (§3.1) may target `PAGE#anchor`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Replace a block (swap type, keep position)                            | **[B]**                     | Falls out of delete + insert; a "replace with…" that carries common props (style, motion, visibility) is a composer nicety. Phase 3 optional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Copy / paste blocks across pages                                      | **[C] (cheap)**             | Clipboard = node JSON; validated on paste; ids regenerated. Composer-only, no schema change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Undo / redo                                                           | **[C] (cheap)**             | In-memory history stack in the composer, Phase 3. The plan never mentions it; an autosaving editor without undo is dangerous.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Static content (headings, text, images, CTA)                          | **[A]**                     | §6.2 content blocks, translatable props.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Rich text (Tiptap)                                                    | **[A]**                     | `rich-text` block, sanitized server-side (ADR-009).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Dynamic content (collections, related, featured)                      | **[A]**                     | Providers + generic collection blocks (ADR-022).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Live data widgets                                                     | **[B]**                     | `data-widget` exists but is the wrong shape for interactive tools — see §5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Background: colour**                                                | **[A]**                     | Token choice (ADR-024 §1). Correct; keep.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Background: image / video / gradient / overlay**                    | **[C]**                     | Extend `supports.style.background` to `{ kind: "token" \| "gradient" \| "image" \| "video" }`. Gradient = bounded token pair + direction enum. Image/video = `MediaAsset` id + **mandatory `overlay` token** (`none\|light\|dark\|brand`, strength `sm\|md\|lg`) + `textTone: "on-image"` resolved by the engine. Publish gate: an image/video background with text children and `overlay: none` is refused. Video: muted, `playsinline`, lazy, **poster required**, static poster under reduced-motion. This preserves ADR-024's contrast guarantee — the contrast property test covers `(overlay, textTone)` pairs. |
| Spacing / radius / width / shadow                                     | **[B]**                     | padding, radius, width exist. Add `shadow: none\|sm\|md\|lg` and `gap`. Still tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Border                                                                | **[C] (small)**             | `border: none\|hairline\|strong` token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Hover effects                                                         | **[A]**                     | `hover: none\|lift\|zoom` (ADR-024 §2). Add `glow` if the theme engine can derive it; otherwise leave.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Entrance / scroll effects                                             | **[A]**                     | `entrance: fade\|fade-up\|stagger` over `Reveal`. Parallax deliberately out (ADR-018, reduced-motion). Keep it out.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Loading effects                                                       | **[B]**                     | Skeletons for collections and widgets are renderer/widget-owned, not authored. State that `Skeleton` from `@repo/ui` is the loading state for every `needs`-bearing block and every widget (§5).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Focus / button / card interactions                                    | **[A]**                     | Owned by `@repo/ui` variants and the theme engine's derived states (ADR-003). Not authorable — correct.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Image effects                                                         | **[A]**                     | `ImageReveal` exists; expose as `image.reveal: boolean`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Effect presets**                                                    | **[B] → §4**                | ADR-024's rejection of a _builder_ stands. A named **bundle of token + motion choices** (a `StylePreset`) satisfies the real need without hex or sliders.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Responsive settings (desktop / tablet / mobile)**                   | **[C]**                     | Nothing in the plan. Add `ResponsiveValue<T> = T \| { base: T; md?: T; lg?: T }` for a **bounded** prop set: `columns`, `padding`, `textAlign`, `hiddenOn: ("mobile"\|"tablet"\|"desktop")[]`, `order` inside columns. Mapped by literal lookup tables (§2 #13). Three breakpoints, fixed, matching the preview widths 375/768/1440.                                                                                                                                                                                                                                                                                  |
| Preview at three widths, real route                                   | **[A]**                     | §8, ADR-026 §5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Draft / publish / unpublish                                           | **[A]**                     | §10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Version history list, preview any version, restore to draft           | **[B]**                     | `PageVersion` rows exist and rollback is a pointer move, but there is no **versions panel**. Add to Phase 3: list (number, author, note, date), "preview this version" via draft mode, "restore as draft". Diff view stays [D].                                                                                                                                                                                                                                                                                                                                                                                       |
| Scheduled publishing                                                  | **[B]**                     | Deferred (§15 #3) with the pattern named. Fine to defer; add `Page.scheduledAt` when it lands, not now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Publish gates with named blocks                                       | **[A]**                     | ADR-024 §4, ADR-029 §5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Translation per block, status dots                                    | **[A]**                     | ADR-024 §3, §9.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Translator view** (all translatable strings of a page in one table) | **[C] (cheap, high value)** | Per-block editing is the wrong UI for a translator. A per-page "Translations" tab listing every translatable prop × locale with MISSING/OUTDATED badges, editing in place. Reads and writes the same node `translations`.                                                                                                                                                                                                                                                                                                                                                                                             |

### 3.1 The `LinkTarget` gap (add before Phase 2)

ADR-028 solves resolved-at-render links for **menus** only. Every block with
a link (`button`, `cta-band`, `image`, `icon-card`, `process-step`,
card CTAs) would otherwise store a raw href. Consequences: slug changes
break page buttons (via a redirect hop at best), no broken-link report is
possible, and a `PREMIUM`/unpublished target renders as a dead link.

**Recommendation:** promote ADR-028's target shape to a shared contract in
`@repo/contracts`:

```ts
LinkTarget =
  | { type: "URL";  url: string; newTab?: boolean }
  | { type: "ROUTE"; routeKey: string }
  | { type: "PAGE"; pageId: string; anchor?: string }
  | { type: "ARTICLE" | "ARTICLE_CATEGORY" | "ARTICLE_TAG" | "COURSE" | "GLOSSARY_TERM"; targetId: string }
  | { type: "MEDIA"; assetId: string }          // downloads (PDF)
```

One resolver in `@repo/core/src/cms/links.ts`, batched per type (ADR-028's
batching requirement), used by `buildNavigation` **and** by `renderTree`
as a collected need (it fits the two-pass model: links are needs too). A
missing target renders the block's non-link variant, never a 404 link. This
also gives the "Broken links" report for free (§8.3).

## 4. Presets and reusability — the model

The plan already contains both reuse semantics; it just does not name them
as a system. Make it explicit, because admins must always know which one
they are holding:

| Semantics                                                        | UI word                    | What it is               | Existing                                                                    | Add                                                                   |
| ---------------------------------------------------------------- | -------------------------- | ------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Linked** (reference by id; edit once, every placement updates) | "Linked" / "Design"        | a row the node points at | `CardTemplate` (ADR-023, MVP) · header/footer parts by id (ADR-027)         | **`StylePreset`** (MVP-lite) · `Section` (Phase 9, already scheduled) |
| **Start from** (copy on insert; then independent)                | "Start from…" / "Template" | a stored layout fragment | part presets = seeded `PageVersion` layouts (ADR-027 §4) · "duplicate page" | **`LayoutTemplate`** — one table, `kind: PAGE \| SECTION \| BLOCK`    |

Two new tables cover everything the brief lists, without a builder for
either:

```prisma
model StylePreset {            // linked: a named bundle of token + motion choices
  id, key @unique, name, scope String   // "any" | block type
  config Json                  // { background, textTone, padding, radius, shadow, border, motion } — same Zod as node.style
  isSystem Boolean, createdById, updatedAt
}
model LayoutTemplate {         // copy: a starting point
  id, key @unique, name, kind LayoutTemplateKind   // PAGE | SECTION | BLOCK
  pageKind PageKind?           // for PAGE templates: which kind it seeds
  layout Json                  // a full tree (PAGE), a subtree (SECTION) or one node (BLOCK)
  previewImageId, isSystem, createdById, updatedAt
}
```

- `node.style` becomes `{ presetId?: string; overrides?: StyleChoices }`;
  the renderer resolves the preset (tag `style-preset:{id}`, one more
  frozen tag, ADR-025 amendment) and applies overrides on top. "Effect
  presets", "style presets", "button presets", "card hover presets" are all
  this one table with a `scope`.
- "Save as template / preset" in the composer writes a `LayoutTemplate`
  (copy) or a `StylePreset` (linked) — two distinct verbs.
- **Page templates** = `LayoutTemplate{kind: PAGE}`; "Create page → Start
  from" picks one. Seed: Landing, Tool page, Legal page, Contact.
- **Section presets** (copy) = `LayoutTemplate{kind: SECTION}`; **reusable
  synced sections** (linked) = Phase 9's `Section` entity. Both exist; only
  one propagates edits. Name them differently on screen.
- **Block presets** = `LayoutTemplate{kind: BLOCK}` — ADR-023 §6 permits
  this if the UI says "copy from"; "Start from" satisfies that.
- **Layout presets**, **responsive presets**, **calculator UI presets**,
  **dashboard/widget presets** — not separate concepts: a layout preset is
  a SECTION template; a widget preset is a BLOCK template holding a
  configured widget node. Do **not** add tables for them.
- **Reusable inputs / buttons / tables / icons as admin-designed
  components** — correctly _not_ a CMS feature. `@repo/ui` is the reusable
  component library; admins pick variants and `StylePreset`s. Designing a
  new component is a code change with a contrast test (ADR-024
  §Consequences). Keep that line.
- Classification: presets-as-a-system is **[B]** today; `StylePreset` and
  `LayoutTemplate` are **[C]**, small, and should land in Phase 3 (they are
  what makes "design once" true for styling, not only cards). Phase 9
  `Section` stays as planned.

No duplication: linked things are rows referenced by id; copied things are
honest copies. Usage counts for both (§8.3) come from a `PageVersion`
layout scan, the same scan the card-template deletion guard needs.

## 5. Future features — the widget contract (add before Phase 2)

### 5.1 Why `data-widget` is not enough

`DataProvider.load(params, ctx) → T` describes read-only data. A calculator
is interactive: client state, pure computation on input, optional server
action, result states. The EA Trading Hub is a feature with its own routes,
auth and data. Neither is a `variant` of a data widget. If the only hook is
`data-widget.variant`, every tool edits `@repo/blocks` — a CMS change, which
the brief explicitly forbids.

### 5.2 Three registries, one injection point

| Registry                       | Answers                              | Lives                          | Injected into `renderTree` as |
| ------------------------------ | ------------------------------------ | ------------------------------ | ----------------------------- |
| `CollectionProvider` (ADR-022) | "list items of a content type"       | `@repo/core/src/cms/providers` | `ctx.providers`               |
| `DataProvider` (ADR-022)       | "load a dataset"                     | same                           | `ctx.providers`               |
| **`Widget`** (new)             | "render an interactive feature here" | a **feature package** per tool | `ctx.widgets`                 |

```ts
export interface WidgetDefinition<Config> {
  key: string;                       // "calc.pip" | "market.rates" | "ea.hub-teaser"
  labelKey: string;                  // catalog key
  category: "calculator" | "market" | "trading" | "form" | "other";
  version: number;  migrate?: …;     // same discipline as blocks
  configSchema: ZodType<Config>;     // admin-facing config — bounded, translatable props allowed
  defaults: Config;
  fields: EditorFieldMeta[];         // composer renders the settings panel from this
  needs?: (cfg: Config) => BlockDataNeed[];   // optional server data via DataProvider (two-pass, cached)
  visibility?: FeatureVisibility;    // floor; the node may only be stricter
  requiresFeature?: string;          // feature-flag key
  supports: { style?: …; motion?: boolean; width?: boolean };
}
export interface WidgetRuntime<Config, Data> {
  Render: (props: { config: Config; data?: Data; locale; subject }) => ReactNode;  // RSC; client leaf inside
  Skeleton: () => ReactNode;         // loading state — mandatory
  states?: { empty?, error? };       // mandatory when `needs` is set
}
```

- **One generic `widget` block** in `@repo/blocks`: `{ widgetKey, config }`.
  It validates `config` against the registry's schema, collects `needs`,
  and dispatches to `ctx.widgets[widgetKey].Render`. Unknown key →
  `FallbackBlock`. **This block never changes again.**
- **A feature ships:** a package (`packages/tools/<name>` or granular
  exports of one `@repo/tools`) exporting `definition` (no React DOM, no
  `@repo/ui` — importable by a native renderer later) and `runtime`; its
  server actions / API routes in `apps/web/app/api/<tool>/…` calling its
  own `@repo/core` service; its pure logic in `@repo/utils` (the three
  calculators already live there); its permissions seeded; a fixture and an
  axe entry (`check-block-fixtures` extended to widgets).
- **`apps/web` assembles the registry** (`widgetRegistry = { ...calculators,
...market }`) and passes it to `renderTree`. The composer reads the same
  registry's `definition`s to populate "Live data / Tools" and render each
  widget's settings panel. Adding a tool = new package + one line in the
  app's registry file. **Zero CMS change.**
- Widgets inherit the design system automatically because their `Render`
  is built from `@repo/ui` (`Field`, `Input`, `Select`, `Button`, `Card`,
  `Table`, `Tabs`). Admin control over a calculator's _appearance_ = the
  node's `style` / `StylePreset` / width + the widget's own bounded config
  (which inputs are shown, defaults, currency list, result layout variant,
  translatable labels and help text). Admin does **not** compose the
  individual inputs as blocks — that would put calculation wiring in
  layout JSON (§6).
- Live data inside a widget (rates ticker): initial render from a cached
  `DataProvider` need (`cacheLife` short, e.g. 60 s); refresh via a client
  leaf polling the tool's own API route. A widget in a **part** (a header
  ticker) obeys ADR-029: cached server data only, client refresh is the
  widget's business, never an uncached shell query.
- Access: `visibility` on the node (ADR-012) + `requiresFeature`. Premium
  tools depend on the entitlements module ADR-012 defers — the hook is in
  place, the semantics arrive with that module. Say so in the plan.

### 5.3 GT4 — the fourth golden test

Add to §12: **GT4 — Widget.** A Pip Calculator page is composed in the
builder and the entire diff is _a tool package + a registry line + a page
seed + a menu item_. If the diff touches `@repo/blocks`, the composer, or a
schema in `@repo/contracts/cms`, the widget contract is wrong. Place it in
Phase 7 alongside GT3 (it reuses the same phase's `DataProvider` work), but
**write the contract in Phase 2** so the `widget` block exists when the
block set is frozen.

### 5.4 The brief's list, tested

| Feature                                                                     | Fits as                                                                                                                                                                                                       | Extra beyond the contract                             | CMS change?                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Pip / Margin / Profit / Risk / Position-size / Fibonacci / Swap calculators | 7 widgets (or one widget with `kind` config) over `@repo/utils/calculators` (three already exist)                                                                                                             | none for most; Swap needs a rates/swap `DataProvider` | **No**                                                                                 |
| Live rates, currency converter                                              | widgets with `needs` → `market.rates` provider over `market.ts`                                                                                                                                               | none                                                  | **No**                                                                                 |
| Market hours                                                                | widget, static logic in utils                                                                                                                                                                                 | none                                                  | **No**                                                                                 |
| Volatility tracker                                                          | widget + a new `DataProvider` over a historical series (Module 13 deferred)                                                                                                                                   | provider + persistence                                | **No**                                                                                 |
| Economic calendar                                                           | `DataProvider` (page-level) and/or widget                                                                                                                                                                     | `EconomicEvent` model (Module 13)                     | **No**                                                                                 |
| EA Trading Hub                                                              | its own module: routes under an authenticated area, own services and permissions; the CMS hosts its marketing/landing pages and small widgets (EA list, stats, CTA); menu items via `LinkTarget{PAGE\|ROUTE}` | entitlements for PREMIUM                              | **No** — provided the hub's authenticated pages are ordinary app routes, not CMS pages |
| Future unknown feature                                                      | provider and/or widget                                                                                                                                                                                        | —                                                     | **No**                                                                                 |

## 6. Dynamic inputs and forms — who owns them

**Recommendation: both, with a hard line.**

- **Feature-specific (widget-owned):** every input that participates in a
  computation or a submission — calculator fields, converter selectors,
  EA filters. The widget renders them from `@repo/ui` primitives and
  exposes bounded config. Rationale: wiring inputs to logic through layout
  JSON makes pages unrenderable without the feature and makes validation an
  admin responsibility. security.md #6 (parse, don't spread) has to live in
  the feature's server action, not in a generic form block.
- **Generic CMS:** `tabs`, `accordion`/`faq`, `table` (static content
  table — **missing from §6.2, add**), `button`, `badge`. These carry no
  submission semantics.
- **Generic forms (contact, lead capture, feedback):** **[D]**, its own ADR
  when needed — `FormDefinition` + `FormSubmission` models, spam control
  (the newsletter form's honeypot + per-IP limit pattern already exists),
  `forms.submissions.view` permission, an admin submissions table. It is a
  _widget_ under §5 (`form.contact`), so nothing in the CMS waits for it.
  `newsletter-form` stays a block for now (its `TODO(newsletter)` already
  names the missing subscriber model).

## 7. Media management

| Requirement                                    | Status                                                | Add                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload once, reuse anywhere by id              | **[A]**                                               | `MediaAsset` + `storeImage()` (ADR-017).                                                                                                                                                                                                                                                                                                                                                  |
| Select from library inside the composer        | **[A]** (Phase 3 minimum picker)                      | —                                                                                                                                                                                                                                                                                                                                                                                         |
| Images                                         | **[A]**                                               | —                                                                                                                                                                                                                                                                                                                                                                                         |
| **Video / audio / documents**                  | **[C]**                                               | Generalise to `storeMedia()` with a per-kind allow-list (magic bytes: mp4/webm, mp3, pdf), per-kind size caps (a setting, e.g. 100 MB video), `/uploads/[file]` gains **Range** support for media playback, `MediaAsset` gains `kind: IMAGE\|VIDEO\|AUDIO\|DOCUMENT`, `durationMs?`, `posterAssetId?`. Storage driver seam (S3/presigned) unchanged — ADR-017 said transport is the seam. |
| Embedded video (YouTube/Vimeo)                 | **[B]**                                               | `video-embeds.ts` allow-list exists for articles. Expose it as the `video` block's `EMBED` source. Never as a _background_.                                                                                                                                                                                                                                                               |
| Search, folders, tags, title                   | **[C]** (Module 11 scope, restated as CMS dependency) | `MediaAsset.title`, `altText` (default), `tags String[]`-equivalent join, `folderId` (or a path string — simpler, adequate).                                                                                                                                                                                                                                                              |
| Replace media in place                         | **[C]**                                               | "Replace file" keeps the id and key, bumps `version`, invalidates every `page:{id}` that references it (needs usage tracking).                                                                                                                                                                                                                                                            |
| **Where is it used / prevent unsafe deletion** | **[C]**                                               | `MediaUsage { assetId, entityType, entityId, field }` maintained on every `PageVersion` write (scan the tree), article save, card template save, brand asset save. Delete refuses with the list — the guard ADR-023 assumes.                                                                                                                                                              |
| Icons                                          | **[A]**                                               | Allow-listed preset icon set in `@repo/ui` (ADR-028 §2) + `MediaAsset` for custom. Reuse that `IconRef` for `icon-card`, `process-step`, buttons.                                                                                                                                                                                                                                         |
| Focal point / crop for responsive images       | **[D]**                                               | `MediaAsset.focalX/Y` later.                                                                                                                                                                                                                                                                                                                                                              |

Sequencing: the Phase 3 minimum picker stays as planned; `storeMedia()`

- `kind` + `MediaUsage` should land **with** it, because the `video` block
  and the deletion guard both need them and adding `kind` after rows exist
  means a backfill.

## 8. Admin experience

### 8.1 Information architecture (`/admin/website`)

```
Website
├── Overview        dashboard (§8.3)
├── Pages           tabs: Pages · Designs (DETAIL) · Global (PART)
├── Templates       LayoutTemplate (page / section / block) — "Start from"
├── Styles          StylePreset — "Linked"
├── Cards           CardTemplate (ADR-023)
├── Media           library (Module 11 UI; picker is the same component)
├── Navigation      Module 08 menus, extended (ADR-028)
├── Redirects       Redirect model exists; no screen is planned — add one
└── Settings        cms.dataBudget, default parts, part cacheLife, preview width presets
```

### 8.2 Composer features — keep / add / skip

Keep (planned): add/remove/reorder/duplicate, settings panel with
General · Style · Motion · Visibility · SEO tabs, locale switcher, autosave

- optimistic lock, three-width preview, budget meter, publish-gate errors
  naming blocks.

Add (Phase 3, all composer-side unless noted):

- **Layers / tree panel** with search-in-page and jump-to-block.
- **Block picker** grouped by the four behaviour categories (§8.1 of the
  plan), with search, "recently used" (localStorage), and templates
  ("Start from") in the same picker.
- **Undo / redo**, **copy / paste** node, **hide** (`node.hidden`),
  **label** (`node.label`), **anchor**.
- **Responsive toggle** in the settings panel for responsive props, and
  **device-specific visibility** (`hiddenOn`).
- **Versions panel**: list, preview, restore-as-draft, note on publish.
- **Draft/published indicator** with "unpublished changes" state
  (`draft.revision > lastPublishedRevision`) and a "Discard draft" action.
- **Translations tab** (§3).
- **Data panel**: what this page shows and from where — the collected
  needs list rendered in admin words (the cost estimate ADR-029 §6 already
  specifies is the same list).
- **Shareable preview link** for non-admin reviewers: signed, expiring
  token accepted by `/api/preview` — **[D]** but cheap and frequently
  asked for by owners.

Skip (would be WordPress-cloning): per-block CSS, global "custom CSS",
A/B variants, revision diff UI, workflow approvals, block-level locking,
automatic screenshots. All are on §15's undated list already; keep them
there.

### 8.3 Overview and reports

All derivable from existing rows plus the two usage scans; none needs new
infrastructure:

- **Counts:** published / draft / unpublished-changes / scheduled (later)
  pages; parts overridden per page; redirects active.
- **Attention list:** pages with MISSING or OUTDATED translations in an
  active locale; pages over the budget **warn** threshold; pages whose
  draft has a gate failure (run gates on autosave, not only publish, and
  store the last result on the draft version); broken links (`LinkTarget`
  resolver misses); missing media (`MediaUsage` pointing at deleted
  assets); dangling card/style-preset references.
- **Usage:** card template → placements; style preset → placements;
  layout template → "started from" count (store `templateKey` on the
  version note); media → usages; widget → pages (from the tree scan); part
  → pages overriding it.
- **Activity:** per-page and site-wide feed from `AuditLog` (publish,
  rollback, unpublish, translation edits) — `recordAudit()` already writes
  every row; the screen is a filtered read.
- **Analytics:** out of the CMS's scope. Emit a stable `data-page-key`
  attribute and keep `Redirect.hitCount`; leave web analytics to the
  analytics tool.

### 8.4 Permissions — add

`cms.parts.publish` (a header publish is site-wide; separate it from
`cms.pages.publish`) · `cms.templates.manage` · `cms.styles.manage` ·
`cms.redirects.manage` · `media.*` already seeded — reuse for the library.
Keep DETAIL designs under `cms.pages.*`; content authors editing articles
never need them, which is the intended separation.

### 8.5 Page model additions (relational)

`Page.updatedById`, `Page.parentId?` (breadcrumbs + nested paths such as
`/tools/pip-calculator`; `path` derived from the ancestor chain per locale),
`Page.group?` (admin-only grouping label — optional), the three part
overrides (ADR-027), `PageVersion.updatedAt` + `revision`,
`PageVersion.gateResult Json?` (last gate run). A **`breadcrumb` block**
joins the content set once `parentId` exists. A `not-found` STATIC page by
reserved key (`key = "not-found"`) is a cheap, common ask — **[D]**.

## 9. Architecture test — "can we build this without changing the CMS?"

| Page                      | CMS controls                                                                          | Feature module controls                                   | Blocks                                                                                                  | Static / dynamic              | Connected via                           | Dev work?                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Static landing          | everything                                                                            | —                                                         | section, heading, paragraph, image, video, button, icon-card, stat-card, faq, cta-band, newsletter-form | all static                    | —                                       | **None**                                                                                                                                                                  |
| 2 News listing / detail   | listing composition, card design, filters, detail design                              | article data, visibility rule, slugs                      | collection*, content-*                                                                                  | dynamic via `news` provider   | provider (exists in Phase 4)            | **None** after Phase 5                                                                                                                                                    |
| 3 Course listing / detail | same                                                                                  | course data                                               | same                                                                                                    | dynamic via `course` provider | provider + descriptors + card + seeds   | **Backend only** (GT2)                                                                                                                                                    |
| 4 Calculator page         | hero, intro, placement, width, style preset, FAQ, related tools, CTA, SEO, menu entry | inputs, validation, computation, result rendering, states | content blocks + **`widget`**                                                                           | static + widget               | widget registry entry                   | **Backend/tool package only** — _only if §5 is adopted; otherwise `data-widget` must change (CMS change)_                                                                 |
| 5 Market-data page        | placement + composition                                                               | rates provider, refresh, caching                          | `widget` (+ `data-widget` for tables)                                                                   | dynamic via `DataProvider`    | provider + widget                       | **Backend only** (GT3/GT4)                                                                                                                                                |
| 6 Form page               | placement + surrounding content                                                       | fields, validation, storage, spam, notifications          | `widget` (`form.contact`)                                                                               | static + widget               | widget + its own ADR                    | **Backend only**; needs the forms ADR first                                                                                                                               |
| 7 Premium feature page    | page + block `visibility: PREMIUM`, gated CTA                                         | entitlement check inside its service/provider             | any                                                                                                     | either                        | `FeatureVisibility` + `requiresFeature` | **Backend only**, blocked on the entitlements module (ADR-012) — PREMIUM = staff-only until then; state this on the page's visibility control                             |
| 8 Unknown future feature  | placement                                                                             | everything else                                           | `widget` and/or `collection`                                                                            | either                        | registry                                | **Backend only**, as long as it is expressible as a provider or a widget. If it needs a new _layout_ primitive, that is a new block — a legitimate CMS change, versioned. |

Publishing is identical for all eight: draft → gates → version → pointer →
audit → tags. A fully static page renders with no feature code; adding a
widget later does not touch the rest of the page.

## 10. Long-horizon risks the plan does not name

1. **`widget` config drift.** Widgets carry `version` + `migrate` like
   blocks or old pages break on tool upgrades. Enforce in the contract.
2. **Feature package removal.** Deleting a tool package leaves nodes with
   an unknown `widgetKey` → `FallbackBlock` (nothing in production, warning
   in preview). Add a report row ("widgets with no registered runtime").
3. **Tree-scan cost** for usage tables at scale (thousands of versions).
   Scan on write, store rows, never scan on read. Only current draft +
   published versions count as "in use".
4. **`content` coarse tag** — already tracked; providers through one
   helper keeps the split contained.
5. **Native renderer.** Definitions subpaths (blocks and widgets) must stay
   free of `@repo/ui`; a lint boundary should enforce it from day one.
6. **Entitlements.** Three items in the brief (premium pages, premium
   tools, EA hub) wait on the module ADR-012 deferred. Nothing in the CMS
   needs to change when it lands, but the plan should say the dependency
   out loud so nobody builds a second gate.
7. **Build OOM** with more static params — already tracked; the catch-all
   should pre-generate only published STATIC paths, never DETAIL.

---

## 11. Final output

### A. Already supported

Page model, versions, draft/publish/unpublish/rollback, audit, tag
invalidation · static content blocks with translatable props · dynamic
collections with generic filters/search/sort/pagination bound by URL ·
card templates by reference · token-only styling with padding/radius/width
· hover + entrance motion enums · block and page visibility (audience) +
feature flags · three-width real-route preview · publish gates naming
blocks · data budget as a setting · global parts with per-page override,
presets as seeded versions, mega-menu panels with live collections · menus
with entity targets and dynamic children · SEO, sitemap, hreflang, JSON-LD
· image upload + picker (Phase 3) · reduced-motion and CSP posture · the
admin vocabulary rule · GT1/GT2/GT3.

### B. Partially supported / needs clarification

Nested layouts in a flat composer (needs a tree panel) · effect/style
presets (bundle of choices, not a builder) · loading states (renderer and
widget owned — say so) · version history (rows exist, no panel) · scheduled
publishing (pattern named, deferred) · translations (per-block only; needs a
translator view) · embedded video (allow-list exists, no block) · media
metadata (minimum picker only) · `DATA` page kind (redundant with STATIC +
widget unless redefined) · hard caps vs budgets (two places still say cap)
· premium semantics (hook exists, entitlements pending).

### C. Missing — add to the plan

1. **Widget registry + generic `widget` block + GT4** (§5) — contract in
   Phase 2, first widgets in Phase 7.
2. **`LinkTarget` contract shared by menus and block link props**, resolved
   as a collected need (§3.1) — Phase 2.
3. **Node schema additions:** `hidden`, `label`, `anchor`, `style.presetId`
   - `overrides`, `responsive` values for a bounded prop set, `hiddenOn`
     — Phase 2 (schema), Phase 3 (UI).
4. **Backgrounds:** gradient (token pair), image and video (`MediaAsset` +
   mandatory overlay + `on-image` tone + poster/reduced-motion) with a
   publish gate — Phase 2/3; contrast property test extended.
5. **`StylePreset` (linked) + `LayoutTemplate` (copy: page / section /
   block)**, with "Save as…" and "Start from…" verbs and usage counts —
   Phase 3. New frozen tag `style-preset:{id}`.
6. **Media:** `storeMedia()` for video/audio/document with Range support,
   `MediaAsset.kind/title/altText/posterAssetId`, `MediaUsage` + deletion
   guard, replace-in-place — with the Phase 3 picker.
7. **Blocks missing from §6.2:** `video` (MEDIA | EMBED), `table`, `tabs`,
   `breadcrumb`; `widget` (above).
8. **Composer essentials:** undo/redo, copy/paste, tree panel, versions
   panel, translations tab, unpublished-changes state, gates on autosave —
   Phase 3.
9. **`PageVersion.updatedAt` + `revision` (+ `gateResult`)**, `Page.updatedById`,
   `Page.parentId` and derived nested paths — Phase 1.
10. **Admin IA additions:** Overview dashboard with the attention list and
    usage views, Redirects screen, Templates and Styles screens — Phases 1
    (Redirects), 3 (rest).
11. **Permissions:** `cms.parts.publish`, `cms.templates.manage`,
    `cms.styles.manage`, `cms.redirects.manage`.
12. **Doc fixes** from §2 (#1–#13): budget vs cap wording, stale ADR ranges,
    ADR-020 header, embeds contradiction, alt-text location, `DATA` kind,
    reserved-path list, tabbed page list, definitions-subpath rule,
    Tailwind class-map rule.

### D. Optional / future

Shareable preview token · revision diff · `not-found` page as a STATIC
page · focal point on images · block locking · generic forms module
(`FormDefinition`/`FormSubmission`, own ADR) · `Page.group` · custom 404
per locale · analytics beyond `data-page-key` · Fibonacci/Swap tools
(need no CMS work, only tool packages) · a `DATA` route-param page kind if
`/rates/[pair]` is ever wanted.

### Recommended final architecture (one paragraph)

Keep v2's shape unchanged and add one registry and one contract. The CMS
owns presentation and composition: pages, parts, blocks, style presets,
layout templates, card templates, navigation, media placement, SEO and
publishing. Domain modules own data and behaviour and expose themselves to
the CMS through exactly three typed surfaces — `CollectionProvider` (list
things), `DataProvider` (load a dataset), `Widget` (render an interactive
feature) — all injected into a pure `renderTree` that collects needs,
resolves them cached and deduped, and renders. Links everywhere are
`LinkTarget`s resolved at render. Reuse is either _linked_ (card, style
preset, later section — one row, many placements) or _start from_ (layout
template — an honest copy), never a third thing. Adding a news category, a
course, a calculator, a rates table, a contact form or the EA hub is a
provider and/or a widget plus a page seed and a menu item; the day it needs
a new layout primitive, that is a versioned block, which is the one kind of
CMS change the architecture is designed to absorb.

### Recommended changes list — before implementation starts

| #   | Change                                                                                                                                                                                                                            | Where                                                       | When                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------ |
| 1   | ADR-030: Widget registry (`Widget` definition/runtime, generic `widget` block, injection via `ctx.widgets`, feature-package rule, GT4)                                                                                            | new ADR; plan §4, §6.1–6.3, §12                             | before Phase 2           |
| 2   | ADR-031: `LinkTarget` contract shared by menus and blocks, resolved as a need; extends ADR-028                                                                                                                                    | new ADR; plan §6, §7.1                                      | before Phase 2           |
| 3   | ADR-032: Node schema v1 — `hidden`, `label`, `anchor`, `style {presetId, overrides}`, bounded `ResponsiveValue`, `hiddenOn`; backgrounds (gradient/image/video + overlay gate); Tailwind class-map rule; definitions-subpath rule | new ADR (amends ADR-024 in part: header line)               | before Phase 2           |
| 4   | ADR-033: Reuse model — `StylePreset` (linked) + `LayoutTemplate` (copy), verbs, `style-preset:{id}` tag (amends ADR-025 header)                                                                                                   | new ADR; plan §5, §8, §15                                   | before Phase 3           |
| 5   | ADR-034: Media v2 — `storeMedia()`, `MediaAsset.kind/title/altText/poster`, `MediaUsage` + deletion guard, Range serving; supersedes the Phase 3 "minimum picker" wording, keeps ADR-017's driver seam                            | new ADR; plan §9 Media, §12 Phase 3                         | before Phase 3           |
| 6   | `PageVersion.updatedAt`/`revision`/`gateResult`, `Page.updatedById`/`parentId`, `cms.*` permission additions                                                                                                                      | ADR-021 amendment via ADR-032 or a note in ADR-030; plan §5 | Phase 1                  |
| 7   | Plan §6.2: add `video`, `table`, `tabs`, `breadcrumb`, `widget` blocks                                                                                                                                                            | plan                                                        | Phase 2                  |
| 8   | Plan §8: tree panel, undo/redo, copy/paste, versions panel, translations tab, unpublished-changes state, gates on autosave; §8.1 IA with Overview/Templates/Styles/Redirects/Settings                                             | plan                                                        | Phase 3                  |
| 9   | Plan §8.3 (new): Overview + reports list                                                                                                                                                                                          | plan                                                        | Phase 3                  |
| 10  | Plan §12: GT4; Phase 7 gains the first widgets (calculators, rates); §14 risks: widget drift, package removal, entitlements dependency                                                                                            | plan                                                        | now                      |
| 11  | Doc fixes §2 #1–#13                                                                                                                                                                                                               | plan, ADR-020 header, plan.md, SKILL.md, reconciliation §9  | now                      |
| 12  | DEVLOG entry recording this review's disposition (which items accepted, which deferred)                                                                                                                                           | `docs/logs/DEVLOG.md`                                       | when the plan is amended |
