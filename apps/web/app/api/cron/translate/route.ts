import { NextResponse, type NextRequest } from "next/server";
import { drainTranslationQueue } from "@repo/core";
import { cronAuthFailure } from "../_lib/cron-auth.ts";

// The translation queue's second runner (ADR-162 #7) — `publish-due`'s
// sibling, with the same shared-secret shape and the same fail-closed 503.
// Called every 5 minutes (`docs/ops/cron.md`).
//
// A save translates its own article inline in `after()`; this drains
// everything else: backfills when a language is switched on (ADR-162 #9),
// retries whose backoff is due, and work a quota or budget pause deferred.
// It keeps draining for up to 240 seconds (ADR-163 #7), inside the 300-second
// proxy and client timeouts, and stops early when the queue is empty or a
// batch pauses.
//
// **Optional in the way `publish-due` is, not the way `housekeeping` is.**
// If this never runs, nothing is lost and nothing leaks: a saved article is
// still translated inline, and a new language's pages show their "not yet
// translated" notice until something drains the backfill. The dashboard's
// progress bar is where that is visible.
//
// **Auth is a shared secret, not `requirePermission()`** — there is no
// subject. No audit row either: every job is metered in `TranslateUsage`, and
// the actions that CAUSE work (activation, Sync, Retry) are audited where a
// person pressed them.
//
// **No `export const dynamic`** — incompatible with `cacheComponents`
// (ADR-004); see `housekeeping/route.ts`.

export async function POST(request: NextRequest): Promise<NextResponse> {
  // The shared bearer check (`_lib/cron-auth.ts`): 503 with no secret, 401
  // for anything but the right token.
  const refused = cronAuthFailure(request);
  if (refused) return refused;

  const startedAt = new Date();
  const summary = await drainTranslationQueue();

  return NextResponse.json(
    { startedAt: startedAt.toISOString(), ...summary },
    { headers: { "cache-control": "no-store" } },
  );
}
