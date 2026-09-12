# SKILL — Module 13: the market platform and the tools on top of it

Module 13 is two things that arrived together (changes-25, ADR-086/087/088):

1. **the market data platform** — a provider row, instruments, daily bars and
   a nightly sweep; and
2. **the eight trading tools** at `/tools/*`, five of which need no data at all.

Read ADR-086 (what is code and what is data), ADR-087 (the store, the sealed
key, the sweep) and ADR-088 (what our correlation and risk numbers mean) before
touching anything here. ADR-050 still governs `/economic-calendar`, which is a
vendor widget and is not part of this platform.

## The line, stated once

**The set of tools is code. Everything a tool says is data.** `TOOLS` in
`@repo/contracts` decides which tools exist, their URL segments, their inputs
and their maths. A `Tool` row decides every word, default, limit, instrument
list, related item and whether it is live. There is no admin surface that can
change what a calculator computes, and that is deliberate (ADR-086 #1).

## How to add a tool

Five edits and no migration:

1. `TOOL_KEYS` + `TOOLS` in `packages/contracts/src/tools.ts` — the key, its
   `routeKey`, its `needs` (`none` | `rates` | `history`), its icon name and
   its default related count.
2. `TOOL_CONFIG_SCHEMAS[key]` — the Zod schema its `config` column is validated
   against, in all three places (form, action, service).
3. A literal `ROUTE_PATHS` entry (`"tool-<key>": "/tools/<key>"`) plus its
   `TOOL_ROUTE_KEYS` binding in `packages/contracts/src/navigation.ts`. Spelled
   out, never computed — a computed key widens `RouteKey` to `string` and takes
   the menu row's compile-time check with it.
4. A seed row in `prisma/seed.ts` (create-only, like every seeded content row).
5. The island under `app/(public)/[locale]/tools/_widgets/`, plus its catalog
   keys in the **public** `tools` namespace (complete for every enforced
   locale — ADR-043 #1).

`packages/contracts/src/tools.test.ts` fails in both directions and names
whichever of 1–3 you forgot.

## How to add an instrument

A row in `/admin/market`. No code. `kind` decides who reads it: `CURRENCY` for
the converter, `PAIR` for the pip and position calculators, everything else for
correlation and the meter. A new `kind` is the only part that is code.

## Invariants

- **Bars, not closes.** A high cannot be derived from closes, so every pivot
  level folded out of a close-only range is wrong (ADR-087 #2). An interval bar
  is the first day's open, the highest high, the lowest low, the last close —
  folded in `getOhlc` and nowhere else.
- **`Decimal`, never `Float`,** for anything a human reconciles against a
  broker statement.
- **The provider key has exactly one reader**, `loadProviderDriver()`.
  `MarketProviderView` has no key property — absent, not omitted. A blank key
  field means unchanged, never erase.
- **Gate:** `market.providers.manage` for the provider,
  `market.instruments.manage` for instruments, `tools.update` /
  `tools.publish` for tool content. No new keys were added for instruments —
  the market keys have been seeded since Module 01 (ADR-086 #7).
- **Nothing depends on the sweep running.** Every rate-backed surface degrades
  to its last good value and labels it in words with an "as of" time. A stale
  rate is labelled, never hidden.
- **The sweep is ordered by staleness**, never-synced instruments first, and
  stops when the budget runs out. Resumption is implicit; there is no cursor.
- **Never "real-time", never "live"** in any copy on the correlation or risk
  pages (ADR-088 #7). The score moves once per daily sweep.
- **A tool with too few bars renders "—", never a number** computed from a
  sample below the window's own length.
- Calculators stay PURE in `@repo/utils` — no I/O, no rate fetching, 90% floor.
  The account-currency leg takes rates as an argument.
- Live rates stay in the Redis-shaped cache with a TTL matching the provider
  refresh. Per-tick data is still never persisted; daily bars are history, which
  is a different thing.

## Required tests

Calculator and statistics tables against hand-computed values plus fast-check
properties (Pearson symmetric / self-1 / in [−1, 1]; Floor pivots ordered;
`gainLoss` round-trips from each entry point; the meter monotone in a rank and
scale-invariant in its weights). Provider adapter contract tests incl. the
"200 + Note means rate-limited" trap and malformed payloads. Testcontainers for
the sweep: idempotent within a day, full history on first sync and tail after,
stalest-first ordering, a provider failure preserving yesterday's bars. Every
admin action denied at the DB for a subject without its key. axe and a blocking
Lighthouse budget on `/tools` and `/tools/[tool]`.
