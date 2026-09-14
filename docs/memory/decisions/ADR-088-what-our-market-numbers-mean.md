# ADR-088: What our correlation and risk-sentiment numbers mean, and what they are not

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 13 (market layer), 12 (public site)
**Supersedes:** —
**Superseded by:** —

## Context

Two of the eight tools (ADR-086) print a number that is not a measurement of
anything a reader can check. A correlation cell says "EUR/USD and GBP/USD are
at +0.87"; a meter says "risk-on, 72". Both are the output of a choice — which
statistic, over which window, of which series — and the reference discloses
neither. Its risk-sentiment formula is proprietary.

We cannot reproduce an undisclosed formula, and we should not pretend to. What
we can do is state ours, in the reader's words, on the page that prints the
number. A number a reader cannot interrogate is worse than no number.

There is a second, quieter difference. The reference recalculates while markets
are open. Ours moves once per daily sweep (ADR-087 §9). Copy that says
"real-time" would be false in a way no disclaimer repairs.

## Decision

**1. Correlation is Pearson's _r_ over log returns of daily closes.** Not over
prices: price-level correlation reports two trending series as correlated when
their day-to-day moves are unrelated, which is the exact misreading the tool
exists to prevent. Log returns are `ln(close_t / close_t-1)`, and the
coefficient is computed over the window's returns, so a 30d window uses 30
returns from 31 closes.

**2. The windows are 5d, 10d, 30d, 60d, 90d, 180d and 250d, and the default is
30d** — the view the reference opens on. The list is admin-editable; the
statistic is not.

**3. Below the minimum sample, a cell renders "—", never a number.** Pearson is
defined on two points and meaningless on them. The minimum is the window's own
length: a 30d window with 12 returns available reports nothing rather than
reporting a coefficient computed from 12. `pearson` and `correlationMatrix`
return `null` rather than a number, so the decision is made in the maths and
not in eight render sites.

**4. The risk-sentiment score is a weighted mean of per-component percentile
ranks, signed by direction, on a 0–100 scale.** For each component instrument
in the admin-configured basket: take its return over the lookback, take that
value's **percentile rank** within its own history over the lookback, flip it
(`100 - rank`) if the component's configured direction is `risk-off`, and take
the weighted mean of what is left. Bands at **35 and 65**: below 35 is
risk-off, above 65 is risk-on, between is neutral.

Percentile rank rather than a z-score, because a return distribution has fat
tails and a z-score turns one 2008-shaped day into a score of 100 for a week.
Percentile rank is bounded by construction and says something a reader can
restate: "today's move is in the top decile of the last 60 days".

**5. A component that cannot report is excluded and counted, never
zero-filled.** A zero-filled component is a claim that the market was neutral;
an excluded one is the truth, which is that we do not know. The widget prints
how many of the basket reported. If none do, the meter renders "—" and says so.

**6. Weights are admin-editable and are normalised, never assumed to sum to
anything.** Weights summing to zero are refused at the contract, not at render
— a division by zero that reaches a component is a bug that has already
travelled too far.

**7. What these numbers are not, stated on the page.** Both tools carry a
collapsed methodology panel restating §1–§6 in the reader's words, and both
carry the site's risk disclaimer. Specifically:

- **Not a forecast.** Every figure describes a window that has already closed.
- **Not the reference's number.** Ours is defined here; theirs is not published.
  The two will disagree and neither is wrong.
- **Not a recommendation.** A correlation of +0.9 is not advice to trade one
  pair instead of another.
- **Not real-time, and not live.** **No copy on either page may use either
  word.** The score moves once per daily sweep; the "as of" line and the
  methodology panel carry that cadence honestly.

## Consequences

- The maths lives in `@repo/utils/statistics.ts`, pure and property-tested
  (Pearson is symmetric, self-correlates at 1, stays in [−1, 1] for any input;
  the score is monotone in a component's rank and unchanged by scaling every
  weight). It is testable without a database precisely because the decisions
  above were made in it.
- Changing the statistic is an ADR, not a form. Changing the basket, the
  weights, the directions, the lookback, the two thresholds and the window list
  is a form — this is ADR-086 #1's line, drawn through a number instead of
  through a page.
- "Real-time" and "live" are a copy rule that nothing static enforces. It is
  written here, and the review checklist for any future market surface is this
  section.
- A fresh instance with no bars renders "—" on both tools and explains why. That
  is the correct first-run state, not an error.
