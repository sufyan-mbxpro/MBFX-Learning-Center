# ADR-020: The website builder lands inside the existing package graph — one new package, not eight

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS) — new module, spec'd by
`docs/MBX-Dynamic-Site-Control-Plan-v2.md`
**Supersedes:** — (constrains how `docs/MBX-Dynamic-Site-Controle-Plan.md`
v1 is executed; v1 §4.2 is void)
**Superseded by:** ADR-027 (in part — header/footer/menus enter the builder as `PART` pages), ADR-030 (in part — feature widget packages are not CMS packages)

## Context

`docs/MBX-Dynamic-Site-Controle-Plan.md` (v1) §4.2 defines eight new
packages — `cms`, `blocks`, `renderer`, `page-builder`, `theme`, `media`,
`access`, `content-adapters` — and a two-app topology. It was written
without access to this repository (its §3 says so outright). Measured
against the code (`docs/cms/00-reconciliation.md`):

- `packages/theme` **already exists** (Module 02, ADR-003).
- `packages/media`'s entire job — validated receipt into a storage driver —
  **already exists** as `storeImage()` + `StorageDriver` + `MediaAsset` +
  `GET /uploads/[file]` (ADR-017).
- `packages/access`'s job is covered by `@repo/rbac` plus the
  `FeatureVisibility` enum whose `PREMIUM` semantics ADR-012 froze.
- `packages/cms` is described as holding "Prisma models access", which
  architecture.md #8 reserves for `@repo/core`.
- `packages/content-adapters` is described as wrapping "domain modules"
  that do not exist as separate packages — every domain service is already
  in `@repo/core`.
- `packages/page-builder` would put a **pre-1.0 client dependency into the
  shared package graph**, when the established precedent for admin-only
  client dependencies (Tiptap, TanStack Table, recharts) is that they live
  in `apps/web` behind the `(public)`/`(admin)` import boundary.

Eight packages of which six are duplicates is not a boundary problem, it is
an inventory problem.

## Decision

**One new package: `@repo/blocks`.** Everything else extends what exists.

```
packages/blocks/            NEW — the only new package
  src/registry.ts           defineBlock(), the closed registry, versions/migrations
  src/schema.ts             Zod schemas for the layout tree + block nodes
  src/render.tsx            renderTree() — validate → migrate → merge locale →
                            access → resolve providers → render; FallbackBlock
  src/<block>/index.tsx     server render (RSC) per block, presentational only
  src/<block>/definition.ts schema, defaults, version, supports, translatable
```

Rules for `@repo/blocks`:

1. **It never imports `@repo/db`.** Data reaches a dynamic block only
   through the provider functions injected into `renderTree`'s context
   (ADR-022). This is what keeps architecture.md #8 true and makes the
   whole renderer unit-testable without a database.
2. It may import `@repo/ui`, `@repo/contracts`, `@repo/i18n`, `@repo/theme`.
   Block renderers are **compositions of existing `@repo/ui` components**,
   not new UI.
3. It carries **no `"use client"` at the block root**; interactivity is a
   small client leaf inside a block, as `@repo/ui` already does.
4. It exports the editor-facing field metadata (`definition.ts`) through a
   separate subpath from the renderers, so the admin can read schemas
   without pulling render trees and the public bundle never pulls editor
   metadata.

Everything else extends an existing home:

| Concern                                               | Home                                                 | Note                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Page/version/template services, publish, revalidation | `@repo/core/src/cms/*`                               | the only code that touches db                                           |
| Collection & data providers                           | `@repo/core/src/cms/providers/*`                     | wraps existing `public-articles.ts`, `public-content.ts`, `market.ts`   |
| Media                                                 | `@repo/core` `storeImage()` + `MediaAsset` (ADR-017) | library **UI** is Module 11 deferred work, scheduled as a v2 dependency |
| Access/visibility                                     | `@repo/rbac` + `FeatureVisibility` + ADR-012         | no `AccessRule` model, no second policy engine                          |
| Theme & tokens                                        | `@repo/theme` (ADR-003)                              | no `CmsThemeSettings`; block styling is token-only (ADR-024)            |
| Motion/effects                                        | `@repo/ui` + ADR-018                                 | no `CmsEffectPreset` table; effects are bounded enum props              |
| Audit                                                 | `recordAudit()` (ADR-011)                            | no `CmsAuditLog`                                                        |
| Redirects                                             | `Redirect` + `getRedirect()` (ADR-015 #1)            | no `CmsRedirect`                                                        |
| Menus, header, footer                                 | Module 08 (`Menu`/`MenuItem` + settings)             | out of builder MVP scope                                                |
| Editor client code                                    | `apps/web/app/(admin)/admin/website/_builder/*`      | same precedent as Tiptap (ADR-009/015)                                  |
| Zod schemas shared across surfaces                    | `@repo/contracts`                                    | layout tree, block props, provider queries                              |

## Consequences

- **`@repo/core` grows.** It already holds every domain service; a `cms/`
  subdirectory with its own barrel keeps it navigable, and the alternative
  (a second db-touching package) costs a rule this repo enforces.
- **The renderer cannot fetch its own data.** Every dynamic block declares
  what it needs and the renderer resolves it through injected providers.
  This is more indirection than v1's "data fetching happens inside block
  renders", and it is the price of `@repo/blocks` having no db dependency.
  It buys: renderer tests with no Testcontainers, and one place where query
  limits, caching and the frozen article-visibility rule are enforced.
- **The editor is not portable to `apps/mobile`.** Accepted: a visual
  canvas is web-and-admin-only by nature, exactly like the Tiptap editor
  that already lives in `apps/web`. The _data_ (layout JSON) and the
  _renderers_ stay in packages, so a native app can render CMS pages later
  by shipping a `blocks-native` renderer against the same schemas.
- **`check-phantom-deps` and `import-x/no-cycle` apply immediately** to the
  new package; `@repo/blocks` importing `@repo/core` would create a cycle
  (core → blocks for render, blocks → core for data) — the injected-provider
  design is what prevents it, and the lint rule is what proves it.

## Alternatives considered

- **Execute v1 §4.2 as written.** Rejected: six of the eight packages
  duplicate shipped systems, and `packages/cms` violates architecture.md #8
  on its first line.
- **Put blocks inside `@repo/ui`.** Rejected: `@repo/ui` is a component
  library with granular exports and a strict no-business-logic posture;
  block definitions carry schemas, versions and migrations, which is a
  different job with a different test suite.
- **Put the renderer in `@repo/core` and keep only definitions in blocks.**
  Rejected: it would make every renderer test require the db package, and
  it puts JSX inside the service layer.
- **Keep `packages/page-builder` for the editor.** Rejected: a pre-1.0
  editor in the shared graph is a supply-chain and upgrade liability, and
  `minimumReleaseAge` plus the admin-only-dependency precedent already
  point at `apps/web`.

## Compliance

- `pnpm check:phantom-deps` — `@repo/blocks` declares everything it imports.
- `import-x/no-cycle` — fails if `blocks` imports `core`.
- A unit test in `@repo/blocks` renders the full fixture set **with no
  database available**; if `@repo/db` ever enters the import graph, it fails.
- Review checklist: any PR adding a top-level `packages/*` directory for
  the CMS must cite an ADR superseding this one.
