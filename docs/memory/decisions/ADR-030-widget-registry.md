# ADR-030: Interactive features reach CMS pages through a Widget registry — one generic `widget` block, feature-owned runtimes, injected like providers

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS) — contract for every future feature module (calculators, market tools, forms, trading tools)
**Supersedes:** ADR-022 **in part** (the `data-widget` block row: retired before it is built; `DataProvider` itself stands) · ADR-021 **in part** (`PageKind.DATA` is redefined, §5 below) · ADR-020 **in part** (feature widget packages are not CMS packages and do not need to supersede ADR-020)
**Superseded by:** —

## Context

Plan v2's only hook for a non-content feature is the `data-widget` block:
`{ provider: DataProviderKey, params, variant }`. That shape describes a
read-only dataset rendered by one of a fixed set of variants. It cannot
describe the things the owner has named as first-year requirements
(`docs/changes/dynamic-site-plan-v2-review.md` §5): a Pip / Margin /
Profit / Risk / Position-size / Fibonacci / Swap calculator, a currency
converter, a market-hours widget, a contact form, a premium tool, an EA
Trading Hub teaser. Every one of those is **interactive** — client state,
computation on input, sometimes a submission — and every one would have to
be added as a new `variant` of `data-widget`, i.e. a change inside
`@repo/blocks`. That is the "NewsPageBuilder" failure ADR-022 removed for
content, reappearing for tools.

The owner's rule for the module is explicit:

> CMS = presentation + composition + publishing. Feature modules = data,
> calculations, submissions, business logic. Future modules expose
> configurable blocks/widgets that can be placed into CMS-designed pages
> **without modifying the CMS**.

The repo already has the seams this needs: `@repo/utils/calculators.ts`
(pip value, position size, margin — pure functions with tests),
`@repo/core/market.ts` (rates service with a provider abstraction), the
two-pass need resolution of ADR-029, and the injection pattern of ADR-020
(providers reach `renderTree` through context, never through imports).

## Decision

### 1. A third registry: `Widget`

Alongside `CollectionProvider` and `DataProvider` (ADR-022), a **widget**
answers "render an interactive feature here". It is split into a
**definition** (metadata, no React DOM, no `@repo/ui`) and a **runtime**
(React, built from `@repo/ui`):

```ts
// @repo/contracts/src/cms/widgets.ts — the shapes
export interface WidgetDefinition<Config> {
  key: string; // "calc.pip" | "market.rates-table" | "form.contact"
  labelKey: string; // catalog key — never a literal
  category: "calculator" | "market" | "trading" | "form" | "other";
  version: number; // bumped with a migrate entry, as blocks do
  migrate?: Record<number, (old: unknown) => unknown>;
  configSchema: ZodType<Config>; // admin-facing config: bounded enums, ids, translatable props
  defaults: Config;
  fields: EditorFieldMeta[]; // the composer renders the settings panel from this
  needs?: (config: Config, ctx: RenderContext) => BlockDataNeed[]; // optional server data (ADR-029)
  actions?: Record<string, ZodType>; // named mutations the runtime may call; input contracts only
  visibility?: FeatureVisibility; // floor — a node may only be stricter (ADR-012)
  requiresFeature?: string; // feature-flag key, as MenuItem/Page already use
  supports: { style?: StyleKey[]; motion?: boolean; width?: boolean };
}

export interface WidgetRuntime<Config, Data> {
  Render: (p: {
    config: Config;
    data?: Data;
    locale: string;
    subject: Subject;
    actions: BoundActions;
  }) => ReactNode; // RSC root; client leaf inside
  Skeleton: () => ReactNode; // loading state — mandatory
  Empty?: () => ReactNode; // mandatory when `needs` is set
  Error?: (p: { retry?: boolean }) => ReactNode; // mandatory when `needs` or `actions` is set
}
```

### 2. One generic `widget` block, and it never changes again

`@repo/blocks` ships **one** block, `widget`, with props
`{ widgetKey: string; config: unknown }`. At render it:

1. looks up `ctx.widgets[widgetKey]`; unknown key → `FallbackBlock`
   (nothing in production, a named warning in preview) — a removed feature
   package never breaks a page;
2. runs the widget's `migrate` chain and validates `config` against
   `configSchema`; invalid → `FallbackBlock` + log;
3. contributes `definition.needs(config)` to **pass 1** (ADR-029) so widget
   data is collected, deduped, cached and budgeted exactly like a
   collection's;
4. in pass 3 renders `runtime.Render` with the resolved data inside a
   `Suspense` boundary whose fallback is `runtime.Skeleton`.

`data-widget` (ADR-022 table, plan §6.2) is **not built**. A rates table is
`widget { widgetKey: "market.rates-table" }` whose `needs` names the
`market.rates` `DataProvider`. `DataProvider` remains the data seam;
the widget is the presentation seam.

### 3. Where a widget lives, and what it may import

- **Definitions and runtimes live in feature packages**, never in
  `@repo/blocks` and never in `apps/web`. The first one is
  `packages/widgets` (`@repo/widgets`) with **granular subpath exports**
  per feature (`@repo/widgets/calculators`, `@repo/widgets/market`) and a
  `/definition` subpath per feature that is free of React DOM and
  `@repo/ui` — so the admin composer and a future native renderer can read
  definitions without pulling runtimes (the same split ADR-020 rule 4 gives
  blocks). A feature with heavy or isolated dependencies (the EA hub) may
  ship its own `packages/widgets-<name>`; the registry does not care.
- A widget package may import `@repo/ui`, `@repo/contracts`, `@repo/i18n`,
  `@repo/utils`, `@repo/theme`. **It never imports `@repo/db`, and never
  `@repo/core`** — data arrives through `needs` (resolved by injected
  providers) and mutations through bound `actions`. This is ADR-020's rule
  for `@repo/blocks`, applied to every widget package, and it is what keeps
  `import-x/no-cycle` and "the renderer runs with no database" true.
- **Business logic stays where it already belongs**: pure computation in
  `@repo/utils`, services in `@repo/core`, mutations behind
  `requirePermission()` / rate limits in `apps/web` server actions or
  route handlers that call `@repo/core` (architecture.md #2, security.md
  #1). The widget's `actions` map declares the input contracts; `apps/web`
  binds the implementations at assembly time.

### 4. Assembly in the app, once

`apps/web/app/_cms/registry.ts` (a private, non-routed module) builds
`widgets = { ...calculatorWidgets, ...marketWidgets }` with bound actions
and passes it to `renderTree` as `ctx.widgets`; the admin composer imports
the same file's **definitions** to populate the "Live data / Tools" block
category and render each widget's settings panel from `fields`.

**Adding a feature = a widget package (or export) + one line in the
registry file + a page seed + a menu item.** No change in `@repo/blocks`,
`@repo/contracts/cms`, the composer or the services. If a feature needs a
new _layout_ primitive, that is a new block, versioned — the one kind of CMS
change this design is meant to absorb, and it is a code change through
review, not a variant added to a switch.

### 5. `PageKind.DATA` is redefined, not used by tools

Calculators, converters and rates tables live on **STATIC** pages as
widgets. `DATA` is retained in the enum with a narrower meaning: _a page
whose route parameter feeds a `DataProvider`_ (`/rates/[pair]`), the
`DATA` analogue of `DETAIL`. Nothing in MVP creates one; the catch-all
does not route it. If a param-driven data route is wanted later, it lands
with its own route file and no enum change.

### 6. Widgets obey every existing rule

- **Design system:** a runtime is composed from `@repo/ui` (`Field`,
  `Input`, `Select`, `Button`, `Card`, `Table`, `Tabs`, `Skeleton`); the
  node's `style` / `StylePreset` (ADR-032/033) and `width` are the admin's
  presentation controls. Admins **do not** compose a calculator's inputs as
  individual blocks — inputs that participate in a computation or
  submission belong to the widget (review §6), or calculation wiring ends
  up in layout JSON.
- **Access:** `visibility` and `requiresFeature` on the node, floor from
  the definition; `PREMIUM` keeps ADR-012's staff-only semantics until the
  entitlements module lands. Premium widgets need no CMS change then —
  the hook is the enum.
- **Budget:** widget `needs` count toward `cms.dataBudget` (ADR-029 §5)
  exactly as collections do.
- **Parts:** a widget placed in a global part (a header ticker) resolves
  its `needs` in the part's grouped cached call, tagged `part-data:{key}`;
  any live refresh is a client leaf polling the feature's own API route.
  ADR-029 §4 ("a global part never issues an uncached query") is unchanged.
- **Gates:** `check-block-fixtures` is extended to widgets — every
  registered widget ships a fixture and appears in the axe page; light and
  dark render tests; a `version` bump requires a `migrate`.
- **Text:** every user-facing string in a widget is a catalog key or a
  translatable config prop (ADR-024 §3).

### 7. Golden test 4

**GT4 — Widget.** A Pip Calculator page is composed in the builder and the
entire diff to get there is _a widget package/export + one registry line +
a page seed + a menu item_. If that diff touches `@repo/blocks`, the
composer, or any schema under `@repo/contracts/cms`, the widget contract is
wrong and it is fixed before Phase 8. Scheduled in Phase 7 next to GT3;
the contract and the `widget` block land in **Phase 2** so the block set is
frozen with it.

## Consequences

- **A fourth thing to register, and a fourth thing to fixture.** Accepted:
  the alternative is a `variant` switch that grows with every tool.
- **Widget runtimes are web-only** (they use `@repo/ui`). A native renderer
  ships `widgets-native` runtimes against the same definitions — the
  definition subpath rule exists for this.
- **Bound actions are an indirection.** A widget cannot import the server
  action it needs; the app binds it. This is the cost of packages never
  importing from apps and never touching Prisma, and it is one map per
  feature in one file.
- **Removing a feature package leaves orphan nodes.** They render nothing
  in production and warn in preview; the Overview's attention list reports
  "widgets with no registered runtime" (plan §8.3).
- **Config drift** is the same problem blocks have, solved the same way:
  `version` + `migrate`, fixtures per historic version.

## Alternatives considered

- **Grow `data-widget.variant` per tool.** Rejected: every feature becomes
  a CMS change, the thing the owner's rule forbids.
- **One widget package inside `@repo/blocks`.** Rejected: it couples the
  block registry to every feature's dependencies and makes "add a tool"
  touch the CMS package by definition.
- **Widgets as ordinary blocks registered from feature packages.**
  Rejected: blocks are presentational and fixture-tested as a closed set;
  letting feature packages add to that set dissolves the closed registry
  and its gates. A single dispatch block keeps the set closed.
- **Let the admin compose inputs, dropdowns and result cards as blocks
  wired by ids (a visual form builder).** Rejected: validation and
  computation become admin responsibilities, `security.md` #6 cannot be
  enforced, and a page becomes unrenderable without the feature. Generic
  forms, if ever needed, are a widget under this ADR with their own ADR for
  the `FormDefinition`/`FormSubmission` models.
- **Widgets import `@repo/core` directly for convenience.** Rejected:
  breaks ADR-020's no-db rule for the render graph and makes the renderer
  suite need Testcontainers.

## Compliance

- `import-x/no-cycle` + `check-phantom-deps` cover every widget package; a
  test renders the full widget fixture set with no `@repo/db` in the import
  graph.
- A test asserts each `/definition` subpath imports neither `react-dom` nor
  `@repo/ui`.
- Unit tests on the `widget` block: unknown key → `FallbackBlock`; invalid
  config → `FallbackBlock` + log; `needs` appear in the pass-1 collection;
  Skeleton renders inside the Suspense fallback.
- `scripts/check-block-fixtures.mjs` extended: every registered widget has
  a fixture and an axe-page entry.
- GT4 acceptance is a named criterion in plan §12 Phase 7; the DEVLOG entry
  for that phase lists the files in the diff.
- Review checklist: a PR that adds a `variant`-style switch over feature
  keys anywhere in `@repo/blocks` is sent back to this ADR.
