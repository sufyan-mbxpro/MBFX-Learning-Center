import { NextResponse, type NextRequest } from "next/server";
import { drainAnnouncementQueue } from "@repo/core";
import { cronAuthFailure } from "../_lib/cron-auth.ts";

// The announcement queue's second runner (ADR-171 #1, changes-54 §8.3) —
// the translate route's sibling, with the same shared-secret shape and the
// same fail-closed 503. Called EVERY MINUTE (`docs/ops/cron.md`).
//
// The Send action kicks the queue in `after()`, so the first batches leave
// within seconds; this drains the rest, starts scheduled campaigns whose time
// (or whose course, ADR-171 #7) has come, retries whose backoff is due, and
// expires dead leases. It keeps draining for up to 240 seconds, inside the
// 300-second proxy and client timeouts; the atomic claim means two overlapping
// calls cannot send one row twice.
//
// **Not optional the way `publish-due` is.** A scheduled announcement starts
// ONLY here, and a large one finishes only here. If this never runs, nothing
// leaks, but a campaign sits at "Sending" with its rows pending.
//
// No audit row: the person who pressed Send was audited then, and every
// message is its own delivery-log row.
//
// **No `export const dynamic`** — incompatible with `cacheComponents`
// (ADR-004); see `housekeeping/route.ts`.

export async function POST(request: NextRequest): Promise<NextResponse> {
  const refused = cronAuthFailure(request);
  if (refused) return refused;

  const startedAt = new Date();
  const summary = await drainAnnouncementQueue({ budgetMs: 240_000 });

  return NextResponse.json(
    { startedAt: startedAt.toISOString(), ...summary },
    { headers: { "cache-control": "no-store" } },
  );
}
