# ADR-087: The market data platform — bars not closes, a sealed provider key, and a sweep ordered by staleness

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 13 (market layer), 01 (db), 09 (admin shell)
**Supersedes:** `resolveProvider(env)`'s env-only key selection in
`packages/core/src/market.ts` (Module 13 scaffold). Extends ADR-078 #3
(the sealed database secret) with its second and last instance.
**Superseded by:** —

## Context

Three of the eight tools (ADR-086) need data the repo does not store: a
currency converter needs a rate, the pivot calculator needs OHLC, and
correlation and the risk meter need roughly 250 daily bars per instrument.

What existed was a seam and nothing behind it. `packages/core/src/market.ts`
had a `MarketDataProvider` interface, an AlphaVantage implementation, a
Redis-shaped cache contract and a degrade-to-stale path — with no consumers, no
models, and a key read from `ALPHAVANTAGE_API_KEY`. Module 13's original spec
also said "market data never goes into Prisma as a source of truth", which is
right about ticks and wrong about history: a correlation window is history by
definition, and re-fetching 250 bars per instrument per page view is not a
cache strategy, it is a rate-limit incident.

The owner's instruction was that the API key belongs in settings, admin-managed
— not in a deploy.

## Decision

**1. Three models: `MarketProvider`, `MarketInstrument`, `MarketDailyBar`.**
The provider is a singleton row (`id = "default"`). An instrument is one table
with a `kind` (`CURRENCY | PAIR | CRYPTO | METAL | INDEX | COMMODITY`) — not
two tables, because a second `MarketCurrency` would need its own admin screen
to say the same thing. A bar is a day, unique on `(instrumentId, date)`.

**2. Bars, not closes.** `getOhlc` has to answer "what was the week's high?",
and a high cannot be derived from closing prices: the week's true high almost
never lands on a close, so a range assembled out of closes understates the real
one, and every pivot level computed from that range is wrong by the same
amount. AlphaVantage's `FX_DAILY` returns open, high, low and close in one
response, so storing four columns costs no extra request and no extra call.

Nothing but the pivot calculator reads them. Correlation, the risk meter, the
rate snapshot and every instrument read take a bar's `close` and only its
`close`.

**3. `Decimal`, not `Float`.** A close is money-shaped and gets subtracted from
its neighbour to make a return. Binary floating point is the wrong store for a
value a human will reconcile against a broker statement.

**4. The aggregation rule, stated once.** An interval bar is the **first day's
`open`, the maximum of the days' `high`, the minimum of the days' `low`, and
the last day's `close`.** 1W, 1M and 1Y each fold daily bars that way; 1D is
the stored bar itself. Every consumer folds through `getOhlc`, so there is one
implementation of this sentence.

**5. The second sealed database secret, and why it is gated more loosely than
the first.** `MarketProvider.apiKeyCipher` holds the provider key sealed with
AES-256-GCM under `MARKET_SECRET_KEY`, which stays in the environment.
Write-only in the UI; `loadProviderDriver()` is its only reader;
`MarketProviderView` has no key property at all — not omitted, **absent**.

ADR-078's SMTP transport is super_admin-only because the _host_ is an
escalation path: repointing delivery captures the next password-reset link,
around `canAssignRole`'s strict `<`. **This key is not that.** It buys read-only
market quotes; nothing is delivered TO a user through this host, and an attacker
who repoints it gets to lie about the price of EUR/USD on a page that already
carries a disclaimer. So it is gated on the already-seeded
`market.providers.manage` rather than on super_admin — the narrower harm gets
the narrower gate, and stating the difference is what stops "sealed secret"
from becoming a pattern applied by resemblance.

**This is the second and last without a further ADR.** A third would have to
show, in its own ADR, that the secret (a) cannot live in env because a
non-deploying admin must rotate it, (b) has exactly one reader, and (c) has a
stated blast radius that justifies its chosen gate.

**6. `@repo/secrets`.** A new package, no dependencies, holding the
AES-256-GCM seal `packages/email/src/secret.ts` has today, parameterised by
env-var name. `@repo/email` keeps `EMAIL_SECRET_KEY` and its own error types
and delegates; `@repo/core` seals the provider key under `MARKET_SECRET_KEY`.

The alternative — `@repo/core` importing `@repo/email/secret`, which
architecture.md #8 already permits — was rejected because "the email package
holds the market key's cipher" is a sentence nobody should have to read twice.
Duplicating a crypto primitive was rejected outright: two copies of a seal
drift, and the one that drifts is the one nobody is looking at.

**7. One rate snapshot per page, not an endpoint per keystroke.**
`getRateSnapshot()` reads every active instrument's latest rate once, `"use
cache"` + `cacheTag("market")` + `cacheLife({ revalidate: 300 })`, and the
server passes it to the island. Conversion is client-side arithmetic against a
USD base with cross-rates. The reference posts back on every "Calculate"; we do
not need to, and it keeps the widgets working while the provider is down.

The snapshot carries latest rates, never bars.

**8. `market` is a new frozen cache tag** (architecture.md #12). It is
deliberately separate from `content`: market data churns on a daily sweep and
content churns on editorial action, and tagging both the same would have every
article publish drop the rate cache.

**9. The sweep is ordered by staleness, and there is no cursor.**
`syncDailyBars()` walks instruments **oldest-stored-bar first, never-synced
ones ahead of everything**, and stops when the request budget runs out.
Resumption is implicit: the next run's ordering puts whatever was skipped at
the front. A cursor column would be a second source of truth about the same
fact, and the fact is already in the data.

**10. Full history on an instrument's first sync, the tail thereafter.** An
instrument with no stored bars is fetched `outputsize=full` and backfilled in
one go; one that has bars is fetched compact and only the tail is upserted.
Correlation at 250d and the meter's percentile ranks need roughly 250 bars, and
an incremental-only sweep would leave both rendering "—" for the better part of
a year. Backfill is still one request per instrument, so a first run fits the
same budget as any other.

**11. Nothing depends on the sweep running.** `/api/cron/market-sync` is
`publish-due`'s twin — `CRON_SECRET`, `timingSafeEqual`, fails closed on an
absent secret, audits with `userId: null`. A sweep that never runs does not
break a page: every rate-backed surface degrades to its last good value and
**says so in words**. A stale rate is labelled, never hidden, and every surface
showing a number derived from a rate shows its "as of" time.

The `MANUAL` driver exists so the whole platform is testable and demonstrable
with no key at all.

## Consequences

- Module 13's "never persist market data" becomes "never persist per-tick".
  Daily bars are history, and history is the thing worth storing; the Redis
  rate cache keeps its original job.
- `@repo/email`'s `secret.test.ts` passes untouched after the move, which is
  the proof the extraction is behaviour-preserving.
- The admin's instrument list shows per-instrument freshness, which is what
  makes the staleness rotation visible rather than mysterious when a free tier
  runs out of requests mid-sweep.
- `MARKET_SECRET_KEY` joins `.env.example` (names only). An instance without it
  can still run every tool that needs no rates, and the admin says why the rest
  are unavailable rather than failing.
- A provider failure writes `lastSyncError` and leaves yesterday's bars. The
  screen that shows the error is the screen that can fix it.
