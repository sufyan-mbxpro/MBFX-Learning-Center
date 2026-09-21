// Seeded "why use this" cards, one set per tool (ADR-114 #3).
//
// Its own module, like `seed-articles.ts`, and for the same two reasons: it is
// starting CONTENT rather than seeding machinery, and a module can be imported
// by a test while a 5,000-line script cannot. `tools-highlights.test.ts` reads
// it directly and fails on a tool with no cards, a glyph outside
// `TOOL_HIGHLIGHT_ICONS`, or markup in a field the renderer prints as text.
//
// Typed with a plain string `icon` rather than `ToolHighlightIcon`, because
// `@repo/db` does not depend on `@repo/contracts` and does not acquire the
// dependency for a list of twelve names — the same call the HOME_PAGE_LAYOUT
// note in `seed.ts` makes. The test is what joins the two.

// Every word is admin-editable the moment the seed has run — this is starting
// content, like the prose in `TOOL_SEEDS` beside it.
//
// Two rules the copy keeps, both from `/support`'s FAQ (ADR-113): it says
// what the CALCULATOR does and never what a broker charges, executes or pays
// out; and it claims nothing about what the market will do next. `icon` is a
// `TOOL_HIGHLIGHT_ICONS` member — a name outside that list is DROPPED by
// `parseHighlights` rather than rendered as a gap in a row of four.
export const TOOL_HIGHLIGHTS: Record<string, { icon: string; title: string; text: string }[]> = {
  "position-size": [
    {
      icon: "target",
      title: "Risk first, size second",
      text: "Decide what a losing trade may cost you, and let the position size follow from that number rather than from a round lot.",
    },
    {
      icon: "globe",
      title: "Any account currency",
      text: "When your account is not held in the pair's quote currency the pip value is converted, and the conversion is shown rather than folded away.",
    },
    {
      icon: "shield",
      title: "Stops that mean something",
      text: "A stop distance in pips becomes a position size, so the stop you place is one the account can actually carry.",
    },
    {
      icon: "book-open",
      title: "It shows its working",
      text: "Amount at risk, pip value, units: each step is printed, so you can check the arithmetic instead of trusting it.",
    },
  ],
  "pip-value": [
    {
      icon: "coins",
      title: "Pips in your own currency",
      text: "One pip on the same position is worth a different amount to a dollar account and a euro one. This is the figure you actually bank.",
    },
    {
      icon: "globe",
      title: "Majors, crosses and yen pairs",
      text: "Yen pairs are quoted to two decimal places, so a pip there is 0.01 rather than 0.0001. That is handled for you.",
    },
    {
      icon: "calculator",
      title: "Any trade size",
      text: "Units rather than whole lots, so a 3,500-unit position is as easy to price as a round one.",
    },
    {
      icon: "target",
      title: "The number sizing rests on",
      text: "Pip value is what both the position size and the stop-loss decision are built from, which is why it gets a page of its own.",
    },
  ],
  // changes-41 (ADR-135). The profit cards are the reference page's own four,
  // with "Real-Time Results" renamed: ADR-088 keeps "real-time" off every
  // rate-backed tool, because the rates move once per daily sweep.
  margin: [
    {
      icon: "layers",
      title: "Any leverage",
      text: "Compare the deposit at 1:50, 1:100 or 1:500 on the same position, and see how much of your balance each one leaves free.",
    },
    {
      icon: "globe",
      title: "Your account currency",
      text: "The deposit is worked out in the pair's base currency and converted into the currency your account is held in.",
    },
    {
      icon: "shield",
      title: "Margin level before you trade",
      text: "See how far a new position would take your margin level before you open it, instead of after.",
    },
    {
      icon: "info",
      title: "A deposit, not a loss",
      text: "The figure is what a trade ties up, not what it can lose. The explainer beside the calculator shows the difference.",
    },
  ],
  "profit-loss": [
    {
      icon: "calculator",
      title: "Accurate Calculations",
      text: "Calculate exact profit and loss for any trade with precise pip values and lot sizes.",
    },
    {
      icon: "layers",
      title: "Multiple Trade Types",
      text: "Support for both buy and sell positions across all major currency pairs.",
    },
    {
      icon: "zap",
      title: "Instant Results",
      text: "Instant profit/loss calculations in your account currency for better planning.",
    },
    {
      icon: "shield",
      title: "Risk Assessment",
      text: "Understand potential outcomes before entering trades for better risk management.",
    },
  ],
  "risk-reward": [
    {
      icon: "shield",
      title: "2% Rule",
      text: "Never risk more than 2% per trade. The risk level beside your percentage shows where your choice sits.",
    },
    {
      icon: "target",
      title: "Risk:Reward",
      text: "Aim for a minimum 1:2 ratio. The ratio appears as soon as a take profit is set.",
    },
    {
      icon: "calculator",
      title: "Position Size",
      text: "Adjust based on stop loss distance. A wider stop means a smaller position for the same risk.",
    },
    {
      icon: "check",
      title: "Consistency",
      text: "Use the same risk % for all trades, so no single result decides how the account does.",
    },
  ],
  "gain-loss": [
    {
      icon: "calculator",
      title: "One figure in, the rest out",
      text: "Give the starting balance and any one of the amount, the percentage or the closing balance. The other two are filled in.",
    },
    {
      icon: "trending-up",
      title: "The recovery number",
      text: "A 50% loss needs a 100% gain to undo it. That figure is shown beside the loss rather than left to be discovered later.",
    },
    {
      icon: "zap",
      title: "Nothing to wait for",
      text: "It is arithmetic on the numbers you type, so no price feed is involved and the answer is the same every time.",
    },
    {
      icon: "book-open",
      title: "Useful after the trade too",
      text: "Work back from a closing balance to see what a month of results actually cost or returned in percentage terms.",
    },
  ],
  "pivot-points": [
    {
      icon: "layers",
      title: "Five methods, one table",
      text: "Classic, Fibonacci, Woodie, Camarilla and DeMark, computed side by side from the same period so the differences are visible.",
    },
    {
      icon: "clock",
      title: "The last completed period",
      text: "Daily, weekly, monthly or yearly, and always a period that has finished: a level taken from an unfinished bar moves under you.",
    },
    {
      icon: "calculator",
      title: "Or your own high, low and close",
      text: "Type the three figures yourself when you want levels for a period or a market this page does not carry.",
    },
    {
      icon: "info",
      title: "Levels, not signals",
      text: "Pivot points describe where price has already been. They are not a forecast and not a recommendation to trade.",
    },
  ],
  "market-hours": [
    {
      icon: "clock",
      title: "Your timezone, not ours",
      text: "Every session time is shown where you are, with daylight saving applied at the moment you are asking about rather than from a stored offset.",
    },
    {
      icon: "globe",
      title: "Four sessions at a glance",
      text: "Sydney, Tokyo, London and New York, with what is open now and when the next one starts.",
    },
    {
      icon: "zap",
      title: "The overlaps, by the clock",
      text: "The windows in which two sessions are open at once, worked out from the session times rather than quoted from memory.",
    },
    {
      icon: "shield",
      title: "The weekend gap is respected",
      text: "The market is shut between the New York Friday close and the Sydney Sunday open, whatever an individual city's clock says.",
    },
  ],
  "currency-converter": [
    {
      icon: "globe",
      title: "The currencies you deal in",
      text: "Convert between the currencies your account, your deposits and your trades are actually denominated in.",
    },
    {
      icon: "coins",
      title: "What a markup really costs",
      text: "Add the margin your provider applies and see the converted amount beside the mid-market one, in money rather than in percent.",
    },
    {
      icon: "clock",
      title: "Dated, never implied",
      text: "Every rate carries the time it was taken, and one that has gone stale says so instead of being quietly presented as current.",
    },
    {
      icon: "calculator",
      title: "Both directions",
      text: "Swap the pair without retyping anything, so a conversion can be checked from the other end.",
    },
  ],
  correlation: [
    {
      icon: "layers",
      title: "Which pairs move together",
      text: "A matrix over the window you choose, so two positions that are really one position are visible before the second one is opened.",
    },
    {
      icon: "shield",
      title: "Diversification, checked",
      text: "Spreading the same risk across correlated markets concentrates it. The grid is where that shows up.",
    },
    {
      icon: "clock",
      title: "Windows you pick",
      text: "A relationship over thirty days and a relationship over a year are two different facts, and both are here.",
    },
    {
      icon: "info",
      title: "It describes the past",
      text: "A correlation measures what has already happened. It can break without warning and it is not a forecast.",
    },
  ],
  "risk-sentiment": [
    {
      icon: "trending-up",
      title: "One score, plainly built",
      text: "A weighted read across risk-on and risk-off markets, with every component and its weight shown rather than summarised away.",
    },
    {
      icon: "shield",
      title: "Gaps stay gaps",
      text: "A market with too little history is left out and counted, never filled in with a zero. A zero would be a claim we cannot make.",
    },
    {
      icon: "clock",
      title: "Rebuilt daily, and dated",
      text: "The score is recomputed once a day and always prints the date it was built from.",
    },
    {
      icon: "info",
      title: "It describes the past",
      text: "It measures moves that have already happened. It is not a forecast and not a recommendation to do anything.",
    },
  ],
};
