# SKILL — Module 13: the market platform and the tools on top of it

Module 13 is two things that arrived together (changes-25, ADR-086/087/088):

1. **the market data platform** — a provider row, instruments, daily bars and
   a nightly sweep; and
2. **the trading tools** at `/tools/*` — eight from changes-25, three more from
   changes-41 (ADR-135).

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

## The tools area has no section bar (changes-33, ADR-112)

`tools/layout.tsx` renders no `SectionNav`. Eight tool names do not fit at
1440px, so the bar scrolled sideways under the header and its only information
was which tool the reader had just chosen.

**ADR-076 §1 is narrowed, not repealed.** A section bar is for surfaces that
are DIFFERENT KINDS of thing, which a reader moves between while doing one
task — four learning surfaces qualify, eight calculators used one at a time do
not. The eight are already listed in the Tools mega panel (grouped by what a
reader is trying to do), on `/tools`, and in `RelatedStrip` at the foot of
each tool page.

The layout survives **only** for its `<main>` landmark: without it the index
and the eight tool pages open none, which axe reports as a MODERATE `region`
violation and so slips under the serious/critical gate the suite runs.

`tools-area.test.ts` asserts the inverse of the test it replaces — it is
there for the revert, not for a deliberate re-add.

## A tool page reads beside its calculator (changes-34, ADR-114)

The band order is still one file (`tool-shell.tsx`) and it is now: masthead →
**(widget | explainer)** → highlights → related → read-next → disclaimer.

**The explainer moved beside the widget, not into it.** `--grid-3-2` at `lg`,
widget first in the DOM, and `intro` / `body` / `faq` in an `<aside>`. Stacked,
"what is a pip?" sat below the fold at exactly the moment it was wanted —
while a reader looks at a field labelled "Trade size (units)".

**`WidgetLayout` splits on a `@container` query, never on the viewport.**
`lg:grid-cols-2` was right while the widget was the page's full measure; at
1024px inside a three-fifths column the inputs track comes out ~290px, which
does not hold a combobox next to a result panel. "Do two columns fit here" is
a question about the element. `news/_components/article-list.tsx` is the
precedent.

### `ToolTranslation.highlights`

A JSON array of `{ icon, title, text }`, at most six, validated by
`toolHighlightSchema`. ADR-086 #1 again: the band is code, every word is data.

- **The glyph is the one thing an admin cannot type.**
  `TOOL_HIGHLIGHT_ICONS` is closed, resolved to components in
  `app/_lib/tool-highlight-icons.ts` (shared, because both surfaces render it
  — architecture.md #5 is honoured by shared code in a shared place, not by an
  admin panel reaching into `app/(public)`). An unrecognised name renders
  nothing, so `parseHighlights` drops that entry and keeps the rest.
- **Plain text, not rich.** `tools-highlights.test.ts` fails on a tag or an
  entity in either field, which is what makes printing it as text correct.
- **The seed fills it, for all eight tools, in the same change as the gate.**
  Empty ⇒ absent (ADR-047 §2 rule 1) is the rule that produced `ABOUT_FACTS`
  and `SUPPORT_CHANNELS`. The rule stays; the data ships with it.
- The source hash covers title and text of every entry (ADR-069's rule), not
  the icon — swapping a glyph is nothing a translator has to re-read.

### `/tools/market-hours`

The 24-hour timeline is GONE. The page leads with a ticking clock
(`useClientSecond`, held by `LiveClock` alone so the session arithmetic stays
on the minute) and `sessionOverlaps()` — pairwise intersections over the
viewer's own day, DST-correct, pairs only.

**It says how LONG a window is, never how volatile.** "Highest volatility, all
major pairs active" is a claim about the market; the count and the duration
are arithmetic. ADR-088 reaching the one tool that had escaped it by carrying
no market data at all. The guard reads the catalog through `code()` — the
comment explaining the rule uses the word and failed the rule it described.

## The economic calendar is in the Tools menu and is not a tool (changes-34, ADR-115)

`/economic-calendar` keeps its URL, its flag and ADR-050's vendor widget. It
is a ninth child of the seeded Tools tree (Timing column) and a ninth card on
`/tools`, appended by the PAGE rather than by `getEnabledTools`, which reads
the `Tool` table.

**It is not a `TOOLS` member, deliberately.** A `Tool` row would mean a config
schema for a thing with no configuration and an editor screen whose every
field is blank, and `contracts/tools.test.ts` would start lying about what a
tool is. A menu is a list of destinations; nothing about appearing in a panel
requires being in the registry.

The flat `Calendar` header row is deleted by the seed, scoped to
`[mainMenu, "economic-calendar", parentId: null]` — this routeKey still
resolves in `ROUTE_PATHS` (unlike ADR-109's), and the footer row and the new
Tools child both share it.

## Margin, profit and risk (changes-41, ADR-135)

Three more registry members: `margin`, `profit-loss`, `risk-reward`, all
`needs: "rates"` and all answering in the pair's own currency with no provider.
The maths is `accountMargin` / `tradeProfit` / `riskReward` / `riskLevel` in
`@repo/utils`.

- **Margin is measured in the BASE currency** (units ÷ leverage), so USD/JPY on
  a USD account needs no rate. Free margin and margin level are measured
  against the BALANCE, because no position is open yet, and the note under the
  level says so.
- **Risk/reward reads the side from the stop.** A take profit on the losing
  side is `targetOnWrongSide`, never a negative ratio. Thresholds
  (`conservativeMaxPercent`, `moderateMaxPercent`, `minRecommendedRatio`) are
  config. The level renders as a word, and the badge tone only repeats it.
- **Pip distances are rounded to 1e-6 pips** (`pipsBetween`). Without it, a
  1 : 2 trade computed as 1.9999…, printed "1 : 2.00", and triggered the
  below-minimum note beside it.
- **Overlap is deliberate.** `gain-loss` is an account in percentages;
  `profit-loss` is one position between two prices. `position-size` takes pips;
  `risk-reward` takes prices and adds the reward.
- Price fields start a round number of pips around the stored price, and start
  EMPTY when no price is stored. A made-up 1.1000 would read as a quote.
  Changing the pair resets them (`_components/price-defaults.ts`).

**Presentation, in `tool-shell.tsx` for every tool:** the widget enters with
`Reveal start` and the explainer with `Reveal end`, the highlights stagger
through `RevealGroup` (kept a list with `role="list"`), and a masthead with no
Cover carries the chart `AmbientMotif`. `tools/[tool]/loading.tsx` reserves only
the masthead and the widget|explainer split.

**The reviews band** (`[locale]/_components/reviews-band.tsx`) sits between
highlights and related, and at the foot of `/support`. It is a plain anchor
styled with `buttonVariants`, not `Button render={<a>}`, whose `role="button"`
misdescribes an off-site link. It is not Trustpilot's script widget either,
which would need a public CSP exception. `site.reviewsUrl` empty ⇒ the band is
absent.

## Two market boards that are not tools (changes-42, ADR-136)

`/tools/live-rates` and `/tools/volatility` are coded pages under `/tools`
with no `Tool` row — the calendar's position (ADR-115 #2), for the same
reason: no config, no island registry entry, no editor. Their route keys are
`live-rates` and `volatility`, deliberately without the `tool-` prefix that
`contracts/tools.test.ts` reserves for registered tools.

**The reference pages they copy show invented numbers.** Live rates nudges a
hard-coded array with `Math.random()` every three seconds; volatility's risk
levels are typed in, not derived. The LAYOUT is copied and none of the data
is. That is the rule for any further page taken from that site.

- **Live rates is the vendor's**, behind the `market_data` flag — seeded since
  Module 01 and read by nothing until ADR-136. It frames TradingView's Market
  Quotes widget, one group at a time. **No bid, ask or spread column**: the
  widget has none and only a broker's feed would.
- **Volatility is ours**, from stored bars. `volatilityProfile`
  (`@repo/utils/statistics.ts`) and `getVolatilityBoard` (`@repo/core`). Range
  % is (high − low) ÷ close × 100; Current means 1 / 5 / 22 **sessions**,
  Average a 66-session baseline shared by all three so Trend has one ruler.
  ADR-088 governs it in full: a dash below the window, a named exclusion
  rather than a zero, a methodology panel, an "as of" line, and **never
  "live" or "real-time"** — `market-boards.test.ts` scans the `volatility`
  namespace for both.
- **`tradingViewWidgetUrl` (`@repo/utils`) is the only way a vendor frame is
  built**, ADR-050's pattern a second time: no vendor script, one `frame-src`
  origin, a closed widget list and a fixed origin.
- **A frame is keyed by its whole URL.** Every widget setting rides in the URL
  FRAGMENT, so changing only the fragment is a same-document navigation and the
  frame keeps what it is already showing. That was a real bug: the group chips
  changed the src and the board did not move.
- `MARKET_BOARD_GROUPS` (`@repo/contracts`) decides which symbols are major,
  minor, exotic or a commodity — composition, so code (ADR-042). It carries our
  `MarketInstrument.symbol` and the vendor's ticker side by side.
