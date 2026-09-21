# ADR-137 — The economic calendar is TradingView's, with our own filters

- **Status:** Accepted
- **Date:** 2026-09-18
- **Module:** 13 (Market layer), 12 (Public site)
- **Supersedes:** ADR-050's vendor choice only. Everything else ADR-050
  decided — that the calendar is an EMBEDDED third-party widget rather than
  synced models, that the DB-backed calendar in the Module 13 spec is
  **deferred and not replaced**, and that what we own is the chrome around the
  frame — stands unchanged.
- **Related:** ADR-136 (TradingView framed, never scripted), ADR-115 (the
  calendar is in the Tools menu and is not a `TOOLS` member), ADR-117 (a
  masthead shows its photograph), ADR-042 (composition is code).

## Context

The owner asked for the calendar page to be rebuilt on the reference
(`mbfx.co/trading/calendar`): TradingView's calendar widget, a filter row above
it "same like the top level filters", and instructions.

The page has been an MQL5/Tradays frame since ADR-050, and that frame has two
properties the rest of the site has since grown out of:

1. **It renders light-only.** ADR-050 recorded that as a known consequence and
   the page compensated with `[color-scheme:light]` on the iframe — a light
   rectangle sitting in the middle of a dark page.
2. **It takes no settings we can drive.** Its filters are inside the frame. A
   reader can use them; we cannot offer them, link to a filtered view, or
   present them in our own chrome.

Meanwhile ADR-136 put TradingView in `frame-src` for the two market boards and
the headline feed, and built `tradingViewWidgetUrl` — a pure URL builder with a
closed widget list, so no vendor script ever enters the document.

## Decision

### 1. The calendar is TradingView's `events` widget, framed the ADR-136 way

`TRADINGVIEW_WIDGETS` gains `"events"`. The page frames it through the same
`TradingViewFrame` island the boards use, so it follows the reader's colour
mode and is keyed by its whole URL (every setting lives in the fragment, so a
filter change is otherwise a same-document navigation the frame ignores).

`@repo/utils`' `economic-calendar.ts` is **deleted**, `tradays.com` leaves the
CSP, and one vendor is one vendor's worth of policy rather than two.

### 2. `countryFilter` is omitted, never sent empty

The widget reads an empty `countryFilter` as "no country passes" and renders a
calendar with nothing in it. `CALENDAR_REGIONS.all` is therefore `[]` and the
builder drops the key entirely, which is the widget's own "everywhere".

### 3. The filter row is OURS, from closed lists, and it is not the
   reference's tabs

The reference shows three tabs — Economic events, Earnings, Dividends. Those
are TradingView's navigation on `tradingview.com`; the embeddable widget has no
such setting. A tab promising earnings would open a calendar that never shows
any, so we do not draw one.

What the widget really has is two filters, and those are what the chips drive:
**impact** (the vendor's `-1 / 0 / 1`) and **region**. Both live in
`_content/calendar-filters.ts` as code registries — which countries count as
"Europe" is page composition (ADR-042), and it is also what keeps the URL
assembled from constants and never from input (security.md #9).

The chips are client state, not links, for ADR-136 §2's reason: a filter is a
view of this page, not a page of its own. The URL is built in the island, which
is safe precisely because neither half of it comes from the reader.

### 4. The instructions sit beside the calendar

"How to use an economic calendar" — sorting, searching, filtering, opening an
event, reading the flags — renders inside the same `Section` as the widget,
below it. The page's existing "plan the week before it starts" callout is a
different thing (trading around releases, not operating the control) and keeps
its place further down.

### 5. The masthead is compact, with a photograph

Like every tool page since ADR-114 and every masthead since ADR-117. It was a
full-height `brand` band with a 4:3 picture in a column beside the words — a
section FRONT's shape on a page a reader opens to look at this week's releases,
which put the widget below the fold on a laptop. `CALENDAR_MEDIA.hero` becomes
`banner`, rendered full-bleed by a new `CalendarBackdrop` (`NewsBackdrop`'s
sibling), and the second action takes `Button variant="inverted"` instead of
the class string it had spelled out by hand.

## Consequences

- One vendor for every framed market surface. `frame-src` shrinks by an origin.
- The calendar follows dark mode, which it never has.
- **The vendor's tab set is not reachable from here.** A reader who wants
  earnings or dividends follows the "open in a new tab" link to TradingView's
  own calendar. That is an honest limit rather than a broken promise.
- Copy that described MQL5's controls (a clock control in its header, a
  settings icon) is rewritten: TradingView converts to the reader's own
  timezone with no control to press.
- `economicCalendarWidgetUrl`, `economicCalendarLang` and
  `ECONOMIC_CALENDAR_ATTRIBUTION_URL` are gone from `@repo/utils`, with their
  tests. Nothing else imported them.
- Still owed to Module 14: axe on the rebuilt page and an E2E that switches a
  filter and asserts the frame's `src` changed.
