# ADR-096: The sweep is due-checked — a scheduler ticks, the interval decides, and a person can force it

**Status:** Accepted
**Date:** 2026-09-14
**Module:** 13 (market layer), 09 (admin shell)
**Supersedes:** ADR-087 #11's account of `/api/cron/market-sync` as a route
that sweeps on every authorised call. The route's auth, its failure mode and
its "nothing depends on it running" guarantee are unchanged.
**Superseded by:** —

## Context

ADR-087 shipped `syncDailyBars()` and a route to call it, and stopped there.
Three things were missing, and the owner hit all three within an hour of
getting a working API key.

**There was no way to run a sweep.** Not from the admin, not without a
scheduler, not even by hand — `CRON_SECRET` is unset on a fresh instance, and
the route fails closed. A working provider, 28 active instruments and zero
stored bars is a platform that looks broken and is in fact merely unstarted.
"Test connection" proves the credential and writes nothing, which is correct
for a test and useless as a first run.

**`refreshSeconds` was read by nothing.** It is stored, seeded, typed,
admin-editable and rendered as a form control. Its only consumer,
`createMarketService()`'s `ttlSeconds`, is called nowhere in the app: the live
Redis rate path exists as a seam with no callers, because ADR-087 #7 decided
that tools read a cached snapshot of stored bars instead. So an admin could
change the refresh interval, see a success toast, and change nothing —
precisely what code-style.md #28 was written to forbid, in the module that
shipped after it.

**There was nowhere to read how to run the thing.** Three cron routes now
exist (`publish-due`, `housekeeping`, `market-sync`), they share one secret and
one shape, and the repo documents none of them outside the routes' own
comments.

The naive fix for the first problem — put the schedule in the deployment and
let the interval setting die — was rejected. It makes the admin's own screen
lie about a number it shows, and it puts a cadence the owner tunes behind a
redeploy.

## Decision

**1. The scheduler ticks; the provider row decides whether a tick sweeps.**
`/api/cron/market-sync` now calls `getSyncDueState()` before spending anything.
If `lastSyncAt + refreshSeconds` is still in the future the route returns
**200** with `{ swept: false, reason: "not_due", nextDueAt }` and makes no
provider request. This is a 200 and not a 429 or a 204: the call succeeded and
the system is in the state the operator asked for, and a scheduler that logs
non-2xx should not page anyone because the interval has not elapsed.

The consequence that makes this worth doing: **the external schedule stops
being a configuration of the cadence.** Point any scheduler at the route as
often as you like — every five minutes is fine — and the admin's setting is
what actually governs how often the provider is called. Changing the cadence
becomes a dropdown, not a redeploy, which is what an admin-managed interval was
always supposed to mean.

**2. `refreshSeconds` is that interval, and it is now load-bearing.** No new
column. The field already meant "how long before we go back to the provider",
which is the same question a sweep asks; a second, nearly identical
`syncIntervalSeconds` would be two sources of truth about one cadence, and the
one nobody reads is the one that drifts. Its label becomes **"Sync interval"**
and its hint says what it now does. If the live-rate path in
`createMarketService()` is ever wired up, this stays its TTL — one number, one
meaning: how often we are willing to call the provider.

This resolves code-style.md #28 in the direction that rule prefers — wire it,
do not remove it.

**3. A person can force a sweep, and two doors do it.**
`?force=1` on the route skips the due check for an operator with the secret.
A **Sync now** button on `/admin/market/provider` does the same for an admin
holding `market.providers.manage`, through a server action rather than the
route — it has a subject, so it audits as that subject (`market.sync.manual`)
rather than as `userId: null`. The route's unattended sweep keeps its null
actor, because inventing a system user to satisfy security.md #1 would put a
fictional person in the audit trail.

Forcing does **not** reset the interval's phase: a forced run writes
`lastSyncAt` like any other, so the next scheduled tick is measured from it.
That is the honest meaning of "we last called the provider then".

**4. The button reports what the sweep did, including partial failure.** It
renders attempted / synced / bars written / skipped, and names the failing
symbols. A free tier that runs out of requests mid-sweep is the expected case,
not an exception — ADR-087 #9's staleness rotation is what makes it
self-correcting, and it is only reassuring if you can see it happening.

**5. `CRON_SECRET` joins `.env.example` with the rest, and
`docs/ops/cron.md` is where the runbook lives.** One page covering all three
cron routes, local and production, because they share a secret and a shape and
documenting them separately would triple the places to get it wrong.

## Consequences

- ADR-087 #11 still holds: nothing depends on the sweep running. A `not_due`
  response and a never-configured scheduler are the same thing to a page — the
  last good bars, labelled, with an "as of" time.
- The route now reads the provider row on every call, including calls that
  sweep nothing. That is one indexed primary-key read against a table with one
  row, and it is what buys the admin-owned cadence.
- A deployment that schedules the route _less_ often than the admin's interval
  gets the deployment's cadence. The setting is a floor on the gap between
  provider calls, not a guarantee of one — the screen's hint says so, because
  an admin who sets 1 hour and is scheduled daily should not be told they are
  syncing hourly.
- `getSyncDueState()` is exported from `@repo/core` and read by the route and
  the provider screen both, so the "next due" the admin sees is computed by the
  same function that gates the sweep.
