# ADR-100: Cost is the provider's tokens against our price table, frozen at write time

**Status:** Accepted
**Date:** 2026-09-14
**Module:** 18 (AI platform), 09 (admin shell)
**Supersedes:** —
**Extends:** ADR-087 #3 (money-shaped values are `Decimal`), ADR-088 (what our
numbers claim), ADR-097 #7 (what the usage log holds)
**Superseded by:** —

## Context

The usage dashboard has to answer "what has this cost, by feature, by model,
by person, against the cap" — and the cap has to refuse work **before** a call
rather than report the overspend afterwards. Three sources of truth were
available: our own token count, the provider's reported usage, and the
provider's billing API.

This repo has already decided what happens when a number's provenance is
vague. ADR-088 keeps the words "real-time" and "live" off the market figures
because the data is a daily sweep, and ADR-096 found a setting that was
stored, typed, admin-editable and read by nothing. A spend figure is the same
class of claim: a wrong one is worse than an absent one, because it gets
believed and budgeted against.

## Decision

**1. Tokens come from the provider's own response, never from a local
tokenizer.** Every response carries a `usage` block; a streamed one carries it
on the final message, and an aborted stream carries what was billed up to the
abort. A local tokenizer is a third-party guess at a first-party fact, and it
is wrong for exactly the cases that cost the most — cache reads, images,
thinking tokens.

**2. Pre-flight estimates over-estimate, on purpose.** The budget check before
a call uses the provider's own `countTokens` for the input and the request's
full `max_tokens` as the output worst case. **A budget check that
under-estimates is not a budget.**

**3. Prices are data.** `AiModel` rows carry `inputPricePerMTok`,
`outputPricePerMTok` and `cachedInputPricePerMTok`, seeded from the published
rates and editable with a `pricedAt` date shown on screen. `Decimal`, not
`Float` (ADR-087 #3): these are money-shaped values a human reconciles against
an invoice.

A `PRICES` constant in code was rejected because a price correction would be a
deploy — but ADR-096's lesson is that the opposite failure is worse, so the
models screen shows each row's last change and **the dashboard prints "prices
last updated <date>" beside the spend figure**. A stale price table is visible
rather than silent.

**4. The dollar figure is frozen at write time.** `AiUsage.costUsd` and both
rollups store the number computed from the price in force when the call
happened. Computing cost at read time by joining today's price would make every
historical chart change shape when an admin fixes a typo.

**5. The provider's billing API is not the source, and the ADR says why.** It
is per-organisation, not per-feature, per-model or per-person, so it cannot
answer a single question this dashboard exists for; it lags; and it needs a
second credential with a different scope, which would be a **fourth** sealed
secret (ADR-098 #8). It remains available as a future _reconciliation_ view,
and naming that here is what stops a later reader interpreting "estimated" as
"we could not be bothered".

**6. The word "estimated" stays on every figure.** ADR-088's discipline in a
new domain: rounding, per-request minimums, provider-side discounts and
promotional credits mean our arithmetic is close, not authoritative. Nothing in
the UI calls it "spend" without qualification, and nothing implies it is the
invoice.

**7. Two consequences of #2 are documented, not treated as defects.**

- **The last few dollars of a period are effectively unusable.** A 700-token
  SEO call is estimated at its ceiling, not its likely 200, so near the cap
  calls are refused that would in fact have fit. This is the conservative
  direction by design; the limits screen therefore shows **"available to
  spend"**, not only "spent", so the gap is visible rather than surprising.
- **A capped platform still writes `REFUSED` rows.** Affordances disappear
  when capped (ADR-097 #6), so the remaining callers are stale tabs, retries
  and scripts — bounded by the per-user hourly window. The rows keep "why did
  nothing happen" answerable. If volume ever proves otherwise, the fix is to
  stop counting refusals into `AiBudgetPeriod.calls` — they already cost
  $0 — not to stop writing them.

**8. The period's cap is copied, not read live.** `AiBudgetPeriod.budgetUsd`
holds the cap in force when the period started, so raising the cap mid-month
is an explicit act through the limits screen rather than a silent retroactive
one. The screen says so above the field.

**9. Rollups are the dashboard's source; raw rows are the audit trail.**
`AiUsageDaily` is upserted with atomic increments in the same transaction as
the `AiUsage` row. Raw rows purge at 90 days (ADR-097 #7); rollups are kept, so
spend history outlives the PII in the rows that produced it, and a 12-month
chart never scans raw usage.

## Consequences

- **Our figure will differ from the invoice**, by a little. Stated on screen,
  and the reconciliation view is named as future work rather than promised.
- **A price change is a form**, which means a price can also be entered
  wrongly. Mitigated by the visible `pricedAt` and by the audit row every
  models-screen write leaves.
- **Cache-token pricing needs a per-model column** that some providers do not
  report separately; `null` there means "price them as input", which is the
  honest default rather than a silent zero.
- **A feature cannot be metered per-request more finely than the provider
  reports.** Batched or multi-turn features — none exist today — would need
  their own aggregation rule stated before they ship.

## Alternatives rejected

- **A local tokenizer (`tiktoken` or similar).** A new dependency whose output
  is a guess, wrong on the expensive cases, and immediately stale against
  model changes.
- **Cost computed at read time from current prices.** Rewrites history on a
  typo fix.
- **The provider's usage/billing API as the primary source.** See #5.
- **No pre-flight check, refunding overspend afterwards.** There is no
  "afterwards" for money already spent; the cap would become a report.
- **A single lifetime budget instead of a monthly period.** A cap nobody can
  reach again is a cap that gets deleted.

## Compliance

- `packages/ai/src/pricing.test.ts` — cost over input, output and cached
  tokens; a **fast-check property** that cost is monotonic in every token count
  and never negative; `Decimal` at the boundaries.
- `packages/ai/src/budget.integration.test.ts` — the cap flips **on** the
  boundary, not past it, confirmed in the failing direction by relaxing `>=` to
  `>` (ADR-096's lesson); `NOTIFY_ONLY` keeps serving; a new UTC month resets;
  the notification fires exactly once per period.
- `packages/ai/src/usage.integration.test.ts` — the row, the daily rollup and
  the period counter move together under two concurrent calls; a re-priced
  model does not change a historical row.
- The dashboard renders "estimated" and the `pricedAt` date — asserted in the
  usage screen's test.
