import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { MARKET_CACHE_TAG, getSyncDueState, syncDailyBars } from "@repo/core";
import { recordAudit } from "@repo/core";

// The nightly market sweep (ADR-087 #9/#11) — `publish-due`'s twin, and
// deliberately the same shape rather than a second convention.
//
// **Nothing depends on this route running.** A sweep that never fires does not
// break a page: every rate-backed surface degrades to its last good value and
// LABELS it, with an "as of" time and, when the newest bar is past the
// provider's stale window, the word "stale" in the copy. What a run buys is
// fresher numbers, not a working site.
//
// **Resumption is implicit, so there is no cursor.** `syncDailyBars` walks
// instruments oldest-stored-bar first, never-synced ones ahead of everything,
// and stops when the request budget runs out. The next run's ordering puts
// whatever was skipped at the front — a cursor column would be a second source
// of truth about a fact the data already states, and the one that drifts.
//
// **Auth is a shared secret, not `requirePermission()`.** There is no subject
// here; security.md #1 governs mutations made BY someone, and inventing a
// system user to satisfy it would put a fictional actor in the audit trail.
// The sweep audits with `userId: null`, the convention `publishDueArticles`
// set for exactly this case.
//
// **The scheduler ticks; the provider row decides** (ADR-096 #1). Before
// spending anything this asks `getSyncDueState()` whether
// `lastSyncAt + refreshSeconds` has elapsed, and answers 200 with
// `swept: false` if it has not. So the external schedule is not the cadence —
// point a scheduler here every five minutes and the admin's "Sync interval"
// setting is what governs how often the provider is actually called. It is a
// 200 because the call succeeded and the system is in the asked-for state; a
// scheduler that alerts on non-2xx should not page anyone for "not yet".
//
// `?force=1` skips the check for an operator holding the secret. The admin's
// "Sync now" button does NOT come through here — it has a subject and goes
// through `runMarketSync()`, which audits as that admin.
//
// **No `export const dynamic`**: a route-level segment config is INCOMPATIBLE
// with `cacheComponents` (ADR-004) and stops the file COMPILING — which is how
// `publish-due` came to answer 500 to every caller. It is also unnecessary: a
// route handler reading `process.env` and the request headers is dynamic
// already.

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  // Absent secret FAILS CLOSED. An unset variable must never mean "anyone may
  // spend the provider's request budget" — 503 says the endpoint is not
  // configured, which is true, and leaves the product correct because of the
  // degrade rule above.
  if (!secret) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Compare SHA-256 digests, not the strings. `timingSafeEqual` THROWS on a
  // length mismatch, so feeding it raw secrets of different lengths would
  // force an early return that leaks the length through timing. Digests are
  // always 32 bytes, so the comparison is constant-width for every input.
  const digest = (v: string) => createHash("sha256").update(v).digest();
  if (!timingSafeEqual(digest(presented), digest(secret))) return unauthorized();

  const startedAt = new Date();

  // A forced run is an operator saying "now", which is the same thing the
  // admin's button says — the interval governs the SCHEDULER, not people.
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force) {
    const state = await getSyncDueState(startedAt);
    if (!state.due) {
      return NextResponse.json(
        {
          swept: false,
          reason: "not_due",
          lastSyncAt: state.lastSyncAt?.toISOString() ?? null,
          nextDueAt: state.nextDueAt?.toISOString() ?? null,
          intervalSeconds: state.intervalSeconds,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }
  }

  const result = await syncDailyBars({ now: startedAt });

  // Only drop the cache when something actually changed. A sweep that wrote no
  // bars — the provider was down, or every instrument was already current —
  // has no reason to evict a snapshot that is still the best available answer.
  if (result.barsWritten > 0) revalidateTag(MARKET_CACHE_TAG, { expire: 0 });

  await recordAudit({
    userId: null,
    action: "market.sync",
    entityType: "MarketProvider",
    entityId: "default",
    changes: {
      after: {
        attempted: result.attempted,
        synced: result.synced,
        barsWritten: result.barsWritten,
        skipped: result.skipped,
        unsupported: result.unsupported.length,
        failures: result.failures.length,
      },
    },
  });

  return NextResponse.json(
    { swept: true, forced: force, sweptAt: startedAt.toISOString(), ...result },
    { headers: { "cache-control": "no-store" } },
  );
}
