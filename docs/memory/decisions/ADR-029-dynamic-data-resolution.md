# ADR-029: Dynamic data is resolved centrally — collect, group, cache, then render; limits are budgets, not architecture

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** ADR-027 **in part** (the hard "one collection block per
panel, `limit ≤ 6`" publish gate becomes a configurable budget, default 2) ·
ADR-025 **in part** (adds the `part-data:{key}` tag and changes what global
part data is tagged with) · ADR-024 **in part** (its §4 "Query cost" row —
fixed renderer caps — becomes the configurable budget in §5 below; every
other gate in ADR-024 stands unchanged)
**Superseded by:** —

## Context

ADR-027 put a hard gate on mega-menu panels: at most one collection block,
`limit ≤ 6`. The reasoning was sound — a panel with a live collection puts a
query in the site shell on every page — but the remedy was wrong. It encodes
a performance limit as a **design limit**, so the composer would have to
tell an admin "you cannot put Featured Courses here because there is already
a Latest News," which is not a sentence a generic website platform should
ever produce. The owner named this correctly: the limit belongs in policy,
the capability belongs in architecture.

The underlying question ADR-022 left open is _when_ dynamic data is
resolved. It says blocks declare needs and providers are injected, but the
naive reading is "each dynamic block awaits its own provider call during
render" — which produces exactly the failure mode to avoid:

```text
Page request → query News → query Courses → query News again → query Events…
```

And the header is the acute case: on `/about`, `/contact`, `/glossary` and
every other route, the shell must not be doing fresh content queries.

There is also a real tension to resolve honestly rather than paper over.
Per-need caching (one entry per query) and batching (one round trip for many
queries) pull in opposite directions: you cannot check N cache entries and
then fold the misses into a single provider call across a `"use cache"`
boundary — the cache lives _behind_ the function. Under Next 16's Cache
Components (ADR-004), the choice has to be made per situation, and stated.

## Decision

### 1. Rendering is two-pass: collect → resolve → render

`renderTree` no longer lets blocks fetch during render. Every dynamic block
declares a `BlockDataNeed`; the renderer walks the tree first, collects every
need, resolves them all, then renders with data in hand.

```text
layout tree
   ↓  walk
collect needs        [{provider, query, bindingId, scope}]
   ↓  normalise + dedupe   (identical provider+query+tier resolves ONCE)
resolve              grouped or per-need (see §2), cached, in parallel
   ↓
render               blocks receive resolved data as props
```

Deduplication is part of the contract: three blocks asking for "latest 6
news, en, public" cost one resolution, not three. This alone makes the
owner's News + Courses panel cheaper than today's single-collection rule
implies.

### 2. Two resolution modes, chosen by scope — not by preference

| Scope                                                                                                        | Mode                                                                                                                                 | Cache unit                              | Tag                   | Why                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Site parts** (header, footer, panels, announcement) and any need whose query does not vary with URL params | **Grouped** — _all_ of the part's needs resolve inside **one** cached function, which issues **one batched provider call** on a miss | one entry per `(partKey, locale, tier)` | `part-data:{partKey}` | The shell is the same on every page: one entry serves the whole site, and a cold miss is a single round trip regardless of how many collections the panel holds |
| **Page collections** driven by `searchParams` (listings, filtered grids)                                     | **Per-need** — each need cached separately, keyed by its normalised query                                                            | one entry per `(provider, query, tier)` | `content`             | Filter/page combinations vary independently; grouping would multiply the key space                                                                              |

Batching is available to a provider through an optional
`listMany(queries[])`, which may satisfy N queries in one database round
trip; the default implementation is `Promise.all` over `list()`. The
conformance suite (ADR-022) asserts both paths return identical results, so
a provider can add `listMany` later as a pure optimisation.

**Where batching and caching conflict, caching wins.** The steady state is a
cache hit; batching only pays on a cold render. That is why parts are
grouped (one entry, one batched miss) and param-driven page collections are
not.

### 3. Global parts are never invalidated by ordinary content churn

Part data is tagged **`part-data:{partKey}` and deliberately _not_
`content`**, with an explicit `cacheLife({ revalidate: 300 })`.

Consequence, stated plainly: **publishing an article does not flush the site
shell.** The header's news column refreshes within its revalidate window
(default 5 minutes, configurable per part), the same
freshness contract ADR-015 #6 already accepted for scheduled articles. In
exchange, ordinary content editing never invalidates a cache entry that
every page on the site depends on — which is precisely the
over-invalidation trap ADR-025 warns about, appearing in its worst possible
location.

An admin who needs the shell updated immediately gets it: republishing the
part, or an explicit "refresh now" action, calls
`revalidateTag("part-data:{key}", { expire: 0 })`. The part editor states
the staleness window in the UI rather than leaving it to be discovered.

### 4. **A global part must never issue an uncached query.** This is testable

Rendering any non-CMS route (`/about`, `/glossary`) with a warm cache must
produce **zero provider calls from the shell**. The test injects a counting
provider, renders twice, and asserts the second render's count is zero. If a
future change makes the header read per-request, that test fails — which is
the only way this property stays true a year from now.

### 5. Limits become budgets: policy in settings, capability in the code

No cap is encoded in the layout schema, the database, or the block
definitions. The layout can express any number of collections. What exists
is a **data budget**, evaluated at publish, stored as settings:

```ts
cms.dataBudget = {
  page: { collections: { warn: 6, block: 10 }, items: { warn: 36, block: 72 } },
  part: { collections: { warn: 2, block: 4 }, items: { warn: 12, block: 24 } },
};
```

Phase-6 defaults are conservative — **a panel may hold two collections of
six**, which is exactly the owner's News + Courses example — and they are
raised by measurement, not opinion: a change to these numbers cites a
Lighthouse run in the DEVLOG.

Warn and block are different: exceeding `warn` shows the advisory in the
composer and permits publish; exceeding `block` refuses it, naming the
blocks. This mirrors `validateTheme`'s existing blocking-vs-advisory split
(Module 02), so the pattern is already familiar in this codebase.

The composer shows the budget as the owner sketched it:

```text
Performance
Dynamic collections     2 / 6
Dynamic items          12 / 36
Global sources          1 / 2
Estimated cost        Medium     ✓ within recommended limits
```

### 6. Costs are estimated from the plan, not guessed

The collected need list _is_ the estimate: number of distinct resolutions
after dedupe, items requested, and whether each is grouped or per-need. The
composer renders that; no heuristics, no scoring model.

## Consequences

- **Blocks lose the ability to fetch during render.** Every dynamic block
  must express what it wants declaratively, which is a real constraint on
  block authors — a block cannot decide what to fetch based on what it just
  fetched. Accepted: two-stage needs are a design smell in a page block, and
  the escape hatch (a provider that composes both reads internally) keeps
  the door open without opening it in the renderer.
- **The header's news can be up to 5 minutes stale.** Deliberate, stated in
  the admin UI, and adjustable per part. The alternative — tagging part data
  `content` — means every article edit invalidates the shell for every page,
  which is strictly worse.
- **Two cache modes are two things to reason about.** Mitigated by making
  the mode a function of scope rather than a choice: parts group, param-driven
  page collections don't. The renderer decides; block authors never pick.
- **`part-data:{key}` joins the frozen tag vocabulary** (architecture.md
  #12), and ADR-025's rule "provider reads are tagged `content`" now has one
  documented exception, which is this ADR.
- **The budget is a setting, so it can be misconfigured.** Bounds are
  validated (`block ≥ warn`, both > 0) and the defaults are seeded; raising
  them still requires a person to write a number and, by rule, a measurement
  to justify it.
- **`/news` and the homepage get simpler, not harder.** The homepage's
  Latest News + Featured Courses + Upcoming Events composition the owner
  sketched is three needs, deduped, resolved in parallel, each cached — well
  inside the page budget, with no special-casing.

## Alternatives considered

- **Keep ADR-027's hard cap (1 collection per panel).** Rejected: it encodes
  a performance policy as a design constraint, and the composer would have
  to refuse a legitimate design. The owner rejected it for the right reason.
- **Let each block fetch during render (the naive reading of ADR-022).**
  Rejected: N queries per page, no dedupe, no batching, and the shell
  querying on every route.
- **Tag part data `content` so it is always fresh.** Rejected: an article
  publish would invalidate the site shell for every page — maximum blast
  radius for minimum benefit.
- **A request-scoped DataLoader inside the cached functions.** Rejected: it
  does not compose across a `"use cache"` boundary, and it would produce
  cache entries whose contents depend on what else happened to be in the
  same request.
- **No limits at all, rely on Lighthouse to catch regressions.** Rejected:
  CI does not run when an admin publishes at 2am; the budget has to be where
  the action is (ADR-024's reasoning, unchanged).
- **Precompute the shell's data into a materialised row on content publish.**
  Rejected for now: it is a denormalisation with an invalidation obligation
  on every write path, and grouped caching already achieves the same read
  cost. Reconsider only if measurement shows cold-miss latency in the shell
  actually matters.

## Compliance

- **Zero-query shell test** (§4): warm-cache render of a non-CMS route makes
  no provider calls from header/footer.
- **Dedupe test:** three blocks with an identical need produce exactly one
  provider call.
- **Grouped-resolution test:** a part with two collections produces **one**
  cache entry and, on a cold miss, one `listMany` call where the provider
  implements it.
- **Isolation test:** publishing an article invalidates `content` but **not**
  `part-data:*`; republishing the part does invalidate it.
- **Budget tests:** `warn` publishes with an advisory; `block` refuses and
  names the offending blocks; budget bounds validated on write.
- **Parity test:** `listMany` and `Promise.all(list)` return identical
  results for the same query set (ADR-022 conformance suite).
- Lighthouse budget still includes a route whose header panel carries
  collections — the guardrail moved, it did not disappear.
