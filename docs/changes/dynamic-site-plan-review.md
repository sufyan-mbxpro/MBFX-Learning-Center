# Review — "MBX Learning Center CMS & Website Builder, Consolidated Execution Plan v1.0"

**Reviewed:** 2026-09-04
**Subject:** `docs/MBX-Dynamic-Site-Controle-Plan.md` (v1.0, 4 Sep 2026)
**Second input:** `docs/changes/review-dynamic-site-paln.md` (the "design
once, publish many" critique + the CMS flow walkthrough)
**Verified against:** this repository at commit `49377f4`, ADR-001…019,
`docs/plan.md`, `docs/memory/stack.md`, `.claude/rules/*`
**Outcome:** v1 is **superseded** by
`docs/MBX-Dynamic-Site-Control-Plan-v2.md` + ADR-020…ADR-026.

---

## Verdict in one paragraph

v1 is a good plan for a repository that does not exist. Its architecture
instincts are right — hybrid relational/JSON, a closed block registry,
context-bound content templates, dynamic blocks over existing domain
queries — and its Section 2 conflict log shows real judgement. But it was
written blind (its own §3: "I cannot see your repository"), and it therefore
proposes **eight new packages, twelve new models and a two-app topology**,
most of which duplicate or contradict systems this repo already shipped and
locked in ADRs 003–019. The critique document, meanwhile, argues for a
separation of "design" from "content" that v1 **already has** — its genuine
contribution is five specific gaps, listed in §2 below. The correct move is
not to execute v1 or to re-argue the critique, but to rewrite the plan
against the real codebase, keep its good bones, delete its duplicates, and
close the critique's five gaps. That is v2.

---

## 1. What v1 gets right (keep, unchanged)

1. **Hybrid model.** Relational for anything routed/filtered/joined; a
   validated JSON block tree for layout. §5.7's rule is stated well enough
   to survive verbatim into v2.
2. **Closed block registry with per-block `version` + `migrate`.** This is
   the difference between a CMS that can evolve and one that fossilises on
   the first schema change. Kept, with fixture tests per historic version.
3. **Static / dynamic / context-bound block taxonomy** (§6.2) — the exact
   mechanism the critique asks for.
4. **Module integration contract** (§6.3): a new content type plugs in by
   providing a query layer, an adapter, components and block definitions,
   with no builder changes. Kept and sharpened in ADR-022.
5. **Hybrid routing** (§7.2): catch-all for CMS pages and listings, explicit
   route files for content detail pages. Correct for SEO and static params.
6. **Renderer determinism** (§7.1): validate → migrate → resolve → merge
   locale → access → render, with a fallback block for unknown types.
7. **Wrap the editor so it is replaceable** (§1, §19). Right instinct about
   a pre-1.0 dependency; v2 goes one step further (ADR-026).
8. **"Never let an admin inject executable JavaScript"** (§20.7) and
   server-side sanitisation. Non-negotiable, and consistent with
   security.md.

## 2. The critique document — what actually survives review

**The critique's headline ("separate Design from Content — the most
important change to the previous plan") is already v1's model.** §6.2, §5.2
(`TemplateKind = PAGE | CONTENT | PART` + `contentType`), §7.1's context
injection and §7.2's routing describe precisely "design once → publish many
→ render automatically". Adopting the critique as written would mostly
restate the plan it critiques. Where it lands, it lands hard:

| #   | Gap the critique exposes                                                                       | v1's state                                                                                                                                                                  | Resolution in v2                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Card templates as references** — "change the card once → every place using it updates" (§14) | Only `CmsBlockPreset` = a _copy_ of props; synced sections deferred to V2                                                                                                   | `CardTemplate` model, referenced by id from every collection-shaped block. **MVP, not V2** — ADR-023                                  |
| 2   | **Data providers ≠ content adapters** — rates, calendar, converter, chart (§9, §12, §13)       | `content-adapters` normalises everything to one card shape; no `DATA` page kind                                                                                             | Two interfaces, `CollectionProvider` and `DataProvider`, plus a `DATA` page kind — ADR-022                                            |
| 3   | **Filters / search / sort / pagination are designable components** (§6)                        | Specified only as `news-filter-bar`, `news-pagination` in the _News_ block set (§6.4) — the "NewsPageBuilder" mistake the critique names in §16                             | Generic provider-bound blocks: `collection-filter`, `collection-search`, `collection-sort`, `collection-pagination` — ADR-022         |
| 4   | **Collection↔filter binding** — how a filter block addresses the grid it filters               | **Not specified anywhere in v1**                                                                                                                                            | A page-level query context keyed by the collection block's id; URL search params are the single source of truth — ADR-022 §Decision 4 |
| 5   | **Page-type taxonomy** (§11, §12)                                                              | `PageKind = STANDARD\|LISTING\|SYSTEM` on pages _and_ `TemplateKind = PAGE\|CONTENT\|PART` on templates _and_ `contentType` as a free string — three overlapping dimensions | One dimension: `STATIC \| COLLECTION \| DETAIL \| DATA`, driven by a typed content-type registry — ADR-021                            |

Two more of the critique's asks are accepted with a narrower shape:
**related content as a configured relationship** (same category / same tags
/ manual) becomes a generic `related-content` block with a strategy enum
rather than a News-only block; **filter preservation on back-navigation**
becomes a concrete URL-params + scroll-restoration requirement instead of a
`navigationConfig` JSON blob whose semantics v1 never defines.

## 3. Where v1 collides with this repository

Full evidence in `docs/cms/00-reconciliation.md`. Summary — each row is a
v1 instruction that would break a locked decision if executed:

| v1 says                                                                   | Repo reality                                                          | Breaks                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/admin` + `apps/web` (§4.1)                                          | one app, two route groups                                             | **ADR-006**                                                  |
| New `packages/theme` + `CmsThemeSettings` (§5.5)                          | `@repo/theme` + `Theme`/`BrandAsset`/`Setting` shipped                | ADR-003, and v1's own "do not create a parallel theme store" |
| New `packages/media` + `Media`/`MediaFolder` (§5.3, §12)                  | `storeImage()`, `MediaAsset`, `StorageDriver`, `/uploads/[file]`      | **ADR-017**                                                  |
| New `packages/access` + `AccessRule` (§14)                                | rbac + `FeatureVisibility` + `isPremium`                              | **ADR-012**, security.md #1–2                                |
| `packages/cms` holds "Prisma models access" (§4.2)                        | `@repo/core` is the only code that touches db                         | architecture.md #8                                           |
| `CmsAuditLog`, `CmsRedirect` (§5.6)                                       | `AuditLog` + `recordAudit()`, `Redirect`                              | ADR-011, ADR-015 #1                                          |
| `CmsMenu`/`CmsMenuItem` + menu builder (Phase 8)                          | Module 08 shipped all of it                                           | — (pure duplication)                                         |
| ISR, `export const revalidate = 3600` (§7.2, walkthrough)                 | Cache Components only                                                 | **ADR-004**                                                  |
| Tags `articles`, `article:{id}`, `category:{id}` "existing (keep)" (§7.3) | **those tags do not exist**; everything uses `content`                | architecture.md #12 (frozen vocabulary)                      |
| Per-block custom light/dark hex pickers (§8.2, §9.2)                      | hex outside `@repo/theme` fails lint; interactive colours are derived | **ADR-003**, code-style.md #1, the contrast contract test    |
| Hand-emitted `--color-primary-hover` (§9.1)                               | derived by the engine                                                 | **ADR-003**                                                  |
| `CmsEffectPreset` table + preset builder (§5.2, §9.3)                     | CSS-first motion, shipped `Reveal`/`Counter`/`Marquee` components     | **ADR-018**                                                  |
| snake_case tables, "adapt to the convention found in audit" (§5)          | PascalCase models, `cuid()` ids                                       | db conventions                                               |
| Phase 6: refactor News UI, convert `/news` to a CMS page                  | Module 15 shipped and locked                                          | **ADR-015**                                                  |
| Phase 0 = 12-part blind audit before any code                             | ~85% answerable from the repo today                                   | wasted phase                                                 |

Also worth stating plainly: **`Page`/`PageTranslation` is already a named
gap** in `plan.md` A7. v1 invents `CmsPage` beside it. v2 fills the gap
that was already scheduled instead of forking it.

## 4. The two risks v1 under-prices

**4.1 The builder can defeat every quality gate this repo has.** Contrast
contracts, axe, Lighthouse budgets, logical-property lint and catalog
completeness all run against _source code_. An admin composing a page at
runtime is outside all of them. v1 answers this with §18 bullets ("visual
regression", "accessibility") but no gate. A drag-and-drop builder plus a
locked design system is only coherent if the builder is **constrained
composition** — approved blocks, token-only styling, bounded motion — and
if the gates are extended to render authored fixtures. That is ADR-024, and
it is a phase deliverable in v2, not a hardening bullet.

**4.2 Scope.** v1 is twelve phases, eight packages and a pre-1.0 editor,
proposed for a project where Modules 09–15 are all "core complete, E2E
deferred", the media library UI and the Tiptap editor are deferred, Module
14 (launch gate) is unfinished, and the web production build currently OOMs
on the owner's machine. v1's own risk table names "scope creep toward
WordPress clone" and answers it with "MVP boundary = Phases 0–6" — but its
Phase 0–6 _is_ the WordPress clone. v2 cuts MVP to the renderer, the page
model, one new package, and a form-based composer, and defers the visual
canvas behind a spike gate. The reduction is from **8 new packages to 1**
and from **12 new models to 4**.

## 5. Disposition

- `docs/MBX-Dynamic-Site-Controle-Plan.md` (v1) — **superseded**, kept for
  history. Its §5.7, §6.1–6.3, §7.1 and §16 survive into v2 in edited form.
- `docs/changes/review-dynamic-site-paln.md` (critique) — **accepted in
  part**: five gaps closed (§2 above); its framing of "design vs content"
  confirmed as already-the-plan.
- New source of truth: `docs/MBX-Dynamic-Site-Control-Plan-v2.md`, binding
  decisions in **ADR-020 … ADR-026**, repo facts in
  `docs/cms/00-reconciliation.md`, module standards in
  `.claude/skills/website-builder/SKILL.md`.
