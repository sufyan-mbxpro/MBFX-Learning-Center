# ADR-136: Live rates, volatility and market news — two boards and a band, not three tools

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 13 (market layer), 12 (public site), 08 (navigation)
**Supersedes:** —
**Superseded by:** —

## Context

The owner asked for three reference pages "with the same presentation", as
independent pages that need no admin control:

- `mbfx.co/trading/analysis` — a "Top Providers - Live Market News" card
  holding TradingView's Timeline widget.
- `mbfx.co/tools/live-rates` — group tabs (Major / Minor / Exotic /
  Commodities), a card with a pulsing "Live" marker over a Bid / Ask / Spread /
  Change / High-Low table, then three cards: Market Hours, Spread Information,
  Risk Warning.
- `mbfx.co/tools/volatility` — group tabs plus Daily / Weekly / Monthly
  timeframe tabs, a grid of per-pair cards (Current, Average, Trend, a risk
  level, three ranges), then "Understanding Volatility" (Low 0–0.5%, Medium
  0.5–1%, High 1–2%, Extreme 2%+) and "Trading with Volatility".

The page chunks were read rather than assumed, and **two of the three show
invented numbers.** Live rates starts from a hard-coded array (gold at
2025.45) and adds `(Math.random() - .5) * .001` to every bid every three
seconds. Volatility is a hard-coded array whose risk levels are typed in, not
derived. Copying the data would put fabricated prices on a learning site whose
market pages exist to be trusted — exactly what ADR-088 was written against.

## Decision

### 1. The presentation is copied; the data is not

Each page keeps the reference's band order, controls and card shapes, built
from our design system (ADR-107's one radius scale, tokens, logical
properties). None of the reference's numbers is reproduced.

### 2. Live rates are TradingView's, framed the ADR-050 way

We store daily bars, not ticks, so a live board has to be a vendor's. The
TradingView loaders (`s3.tradingview.com/external-embedding/embed-widget-*.js`)
were read. Each one does one thing: it creates an `<iframe>` at
`https://www.tradingview-widget.com/embed-widget/<id>/?locale=<l>`, with the
settings JSON URL-encoded in the fragment. So, exactly as ADR-050 §2:

- **We render the iframe ourselves.** No vendor script enters our document,
  `script-src` is untouched, and the third party stays inside a cross-origin
  frame.
- **The URL is built by a pure function in `@repo/utils`**
  (`tradingViewWidgetUrl`), which owns the origin constant, a closed set of
  widget ids and the locale mapping. The app passes a widget id and settings,
  never a URL (security.md #9).
- **CSP gains one `frame-src` origin,** `https://www.tradingview-widget.com`.

The board uses the **Market Quotes** widget, one symbol group at a time,
behind our own group chips. **It has no bid, ask or spread columns.** Only a
broker's own feed carries those, so the columns are absent rather than
invented, and the Spread card says spreads are set by a broker, not shown
here.

### 3. Volatility is OURS, computed from stored bars

`MarketDailyBar` has high and low, so this needs no vendor.

- **Range % of a session** = (high − low) ÷ close × 100.
- **Current** = the mean range % over the timeframe's window: Daily = the
  last session, Weekly = the last 5, Monthly = the last 22. These are trading
  sessions, not calendar days, because a forex bar does not exist on a
  Saturday.
- **Average** = the mean over a 66-session baseline (about three months),
  the same for every timeframe, so "Trend" (current − average, in percentage
  points) always compares against one ruler.
- **Risk level** uses the reference's published bands on Current: below 0.5
  Low, below 1 Medium, below 2 High, otherwise Extreme.
- **Ranges** are the absolute high − low over the last 1 / 5 / 22 sessions,
  in the instrument's own decimals.
- **Below a window's own length, the figure is "—", never a number**
  (ADR-088 #3). An instrument with no bars is excluded and counted, never
  zero-filled (ADR-088 #5).

The maths lives in `@repo/utils/statistics.ts` and the read in
`@repo/core/market-analytics.ts` (`getVolatilityBoard`, tag `market`). This
page is ADR-088 territory: **no copy on it says "live" or "real-time"**, and it
prints its "as of" date and a methodology panel.

### 4. The groups are a code registry

`MARKET_BOARD_GROUPS` in `@repo/contracts` maps each group to symbols and
their TradingView tickers. It is code for the ADR-042 reason. Which pairs
count as "major" is page composition, not content, and the owner asked for
no admin control. Instruments are still data. The volatility board reads the
`MarketInstrument` rows whose symbols the registry names, so a group with no
active, reporting instrument shows its empty state. Three exotic pairs
(USD/TRY, USD/ZAR, USD/MXN) are added to the seeded instruments so the Exotic
group has rows to fill once a provider is configured.

### 5. Independent pages, not `TOOLS` members

`/tools/live-rates` and `/tools/volatility` are coded route folders beside
`[tool]`, like `/economic-calendar` (ADR-115 #2). Neither has a `Tool` row,
config schema or editor, because both are fixed compositions with no
admin-editable prose. Their route keys are `live-rates` and `volatility`,
deliberately without the `tool-` prefix, which `contracts/tools.test.ts`
reserves for registered tools.

- **Live rates** is gated by `market_data` ("Live market data"). The flag
  has been seeded since Module 01 and read by nothing (code-style.md #28);
  it now has a reader.
- **Volatility** is gated by `calculators`, the Tools area's flag.

Both are children of the seeded Tools tree (Rates column), rows in
`footer_tools`, cards on `/tools` appended by the page, and sitemap entries
behind their flags.

### 6. Market news is a band on `/analysis`, not a page

A reader on `/analysis` wants what the reference's card offers. A separate page
would split one topic across two URLs. The band sits after our own analysis
listing and taxonomy: our editorial comes first, and the vendor's feed is the
supplement. It uses the Timeline widget through the same URL builder. The
vendor forces that widget's language to English, and the builder mirrors
that.

### 7. The frame follows the reader's mode

TradingView takes `colorTheme: "light" | "dark"`. The server builds both URLs,
and a small client island picks one from `useTheme().resolvedTheme`. The
iframe is keyed by the mode, because changing only a URL fragment does not
reload a frame. Before hydration the frame is a sized placeholder, so the
page does not shift.

## Consequences

- **The vendor's consequences from ADR-050 apply again.** Quotes and headlines
  are not in our HTML and carry no SEO value. There is no degraded mode, so if
  TradingView is down the card is empty and our chrome still reads. TradingView
  quotes may be delayed by the venue; the page says "may be delayed" rather
  than promising a tick.
- **"Live" appears on the live-rates page and nowhere else.** It is accurate
  there because the vendor's widget streams. The ADR-088 guard is extended to
  the volatility namespace, where it is not accurate.
- **The exotic pairs join the instrument list,** so they also appear in the
  pip and position calculators' pickers. That matches the reference, whose
  exotic tab exists for them.
- **Exit.** A broker quote feed with bid and ask replaces the Market Quotes
  frame behind the same URL, flag and menu row. That work supersedes §2; it
  does not amend it.
