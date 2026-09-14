import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { purgeEmailDeliveries, purgeExpiredPending } from "@repo/core";

// Retention sweeps (ADR-078 #10, ADR-080 #1) — `publish-due`'s sibling, and
// deliberately its near-copy: the same shared-secret shape, the same
// fail-closed 503, the same "no queue, no worker, no `node-cron`" answer.
//
// **Unlike `publish-due`, this one is NOT optional.** Scheduled publishing is
// decided in the query, so a sweep that never runs only leaves `status`
// stale. Retention has no query-side equivalent: if this never runs, delivery
// rows accumulate past 90 days and unconfirmed addresses sit in the table
// forever. Both are PII, so "nobody called the endpoint" is a privacy
// regression rather than untidy bookkeeping. That is worth saying out loud
// because the two routes look identical.
//
// **Auth is a shared secret, not `requirePermission()`** — there is no
// subject, and inventing a system user to satisfy security.md #1 would put a
// fictional actor in the audit trail. Neither sweep audits: both delete rows
// by age with no actor and no judgment, and an audit row per purge would be a
// second copy of the retention clock.
//
// **No `export const dynamic`**: a route-level segment config is INCOMPATIBLE with
// `cacheComponents` (ADR-004), and Next refuses to compile the file — which is
// how `publish-due` came to answer 500 to every caller rather than running the
// sweep. It is also unnecessary: a route handler reading `process.env` and the
// request headers is dynamic already. architecture.md #12 bars the sibling
// `export const revalidate` for the same reason.

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  // An absent secret FAILS CLOSED. Here that means retention does not run,
  // which is the safe direction: the alternative is letting an unauthenticated
  // caller delete rows.
  if (!secret) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Digests, not the strings: `timingSafeEqual` THROWS on a length mismatch,
  // so comparing raw secrets of different lengths would leak the length
  // through timing. Digests are always 32 bytes.
  const digest = (v: string) => createHash("sha256").update(v).digest();
  if (!timingSafeEqual(digest(presented), digest(secret))) return unauthorized();

  const now = new Date();
  const [pendingSubscribers, deliveries] = await Promise.all([
    purgeExpiredPending(now),
    purgeEmailDeliveries(now),
  ]);

  return NextResponse.json(
    { sweptAt: now.toISOString(), pendingSubscribers, deliveries },
    { headers: { "cache-control": "no-store" } },
  );
}
