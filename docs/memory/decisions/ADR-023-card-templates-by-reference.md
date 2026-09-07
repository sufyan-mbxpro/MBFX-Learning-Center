# ADR-023: Card designs are templates referenced by id, not presets copied into pages

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** — (replaces v1 §5.2's `CmsBlockPreset` for the card case)
**Superseded by:** ADR-033 (in part — §6: a copy-semantics template is built under the honest name "Start from")

## Context

`docs/changes/review-dynamic-site-paln.md` §14 states the requirement
precisely:

> News Grid → uses "Modern News Card"; Homepage → uses "Modern News Card";
> Related News → uses "Modern News Card". Change the card design once →
> every place using it updates.

v1 offers two mechanisms and neither delivers that. `CmsBlockPreset` stores
"saved props" that are **copied** into a block when applied — three
placements produce three independent copies, and editing the preset changes
nothing already placed. `CmsSection.synced` (a true reference) exists in the
schema but is explicitly deferred to V2 in v1 §1 and §5.2, and a section is
page-level furniture, not a per-item card anyway.

A card is also the single most-repeated piece of design on a content site.
Getting it wrong means the "design once" promise fails at exactly the place
an editor will notice first.

## Decision

**`CardTemplate` is a first-class model, referenced by id, and it ships in
MVP.**

```prisma
model CardTemplate {
  id           String   @id @default(cuid())
  key          String   @unique          // "modern-news-card"
  name         String
  contentType  String?                   // null = works for any CollectionItem
  variant      String                    // maps to a @repo/ui card composition
  config       Json                      // Zod-validated: which fields show, in
                                         // what order, image ratio, badge set,
                                         // meta row, excerpt length, CTA
  isSystem     Boolean  @default(false)  // seeded; clone-only, cannot be deleted
  previewImageId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

1. Every collection-shaped block (`collection`, `related-content`, and the
   homepage's latest-* sections once migrated) takes a **`cardTemplateId`**,
   not an inline card config. Blocks store the reference; the renderer
   resolves it once per page render.
2. **Editing a card template updates every placement**, because there is
   only one copy. Invalidation is by tag: `card-template:{id}` (ADR-025).
3. `config` is validated by a Zod schema in `@repo/contracts` and can only
   express choices the underlying `@repo/ui` card composition supports —
   field visibility and order, image aspect ratio, badge set, meta fields,
   excerpt truncation, CTA label key. **It cannot express colours, spacing
   scales or arbitrary classes** (ADR-024).
4. `contentType: null` means the template works against any
   `CollectionItem`; a non-null value restricts it and lets the editor hide
   irrelevant fields. A template whose `contentType` does not match the
   block's is not offered.
5. **Seeded system templates** (`isSystem: true`) cover the shapes already
   in the code today — `standard`, `featured`, `compact`, `horizontal` from
   `article-list.tsx`. They are clone-only, matching the system-role
   convention (ADR-016). Deleting a template referenced by any published
   page version is refused with the usage list, the same guard the media
   library uses.
6. **`BlockPreset` is not built.** Where an admin wants "this block, styled
   like that one", the answer in MVP is duplicate-the-block. A preset that
   copies props is a support burden (why didn't my change propagate?) for a
   convenience; if it is ever added, it must be named "copy from" in the UI
   so the semantics are honest.

## Consequences

- **A card edit is a site-wide visual change with no per-page preview.**
  Mitigated: the card editor previews against real items of the chosen
  content type, and shows a usage count ("used by 4 blocks on 3 pages")
  before save.
- **Resolution cost per render**: one extra read per distinct
  `cardTemplateId` on a page, cached under its own tag. Negligible, and it
  means a card edit does not invalidate every page's data, only the
  card-template tag those pages also depend on.
- **A missing or deleted reference must not break a page.** The renderer
  falls back to the content type's seeded system template and logs; a page
  never 500s because a card template vanished.
- **Migration coupling**: when a `@repo/ui` card composition changes shape,
  `config` may reference a field that no longer exists. Handled by the same
  versioned-migration mechanism blocks use — `CardTemplate.config` carries a
  `version` and a migration map.

## Alternatives considered

- **v1's `CmsBlockPreset` (copy-on-apply).** Rejected: it cannot satisfy the
  stated requirement, and its failure mode is silent divergence.
- **Synced sections only (v1's V2 plan).** Rejected: page-level granularity;
  cannot express "the card inside a dynamic grid", which is the actual ask.
- **Card design as props on each block.** Rejected: this is today's problem
  restated — three placements, three edits, drift.
- **A file-based card registry (code, not data).** Rejected: it makes card
  design a developer task, which is the thing the whole module exists to
  end. The `variant` field keeps a code-owned floor under the data.

## Compliance

- Deletion guard test: a template referenced by a published version cannot
  be deleted; the error names the usages.
- Fallback test: a block referencing a missing `cardTemplateId` renders the
  seeded system template, not an error boundary.
- Propagation test (integration): edit a card template → both a listing
  page and the homepage render the change after `card-template:{id}`
  invalidation, in one request cycle.
- Seed idempotency: system templates re-seed without clobbering
  admin-edited clones (Module 01's rule).
