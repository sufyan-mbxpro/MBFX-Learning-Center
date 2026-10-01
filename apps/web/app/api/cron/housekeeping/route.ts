import { NextResponse, type NextRequest } from "next/server";
import {
  purgeAiUsage,
  purgeAnnouncementRecipients,
  purgeEmailDeliveries,
  purgeExpiredPending,
  purgeTranslationRows,
} from "@repo/core";
import { cronAuthFailure } from "../_lib/cron-auth.ts";

// Retention sweeps (ADR-078 #10, ADR-080 #1, ADR-097 #7) — `publish-due`'s
// sibling, and deliberately its near-copy: the same shared-secret shape, the same
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
// ADR-097 adds the third sweep, and it is PII on the same clock: an `AiUsage`
// row carries `userId` — who spent what. The DAILY ROLLUPS carry no person and
// are kept forever, which is what lets spend history outlive the retention
// window and keeps a twelve-month chart from scanning a year of raw rows.
//
// ADR-162 #10 adds the fourth: finished translation jobs after 7 days and
// per-request `TranslateUsage` rows after 90 — the latter carry `userId` for an
// editor's prefill, the same PII-on-a-clock as `AiUsage`. The monthly totals
// (`TranslateUsagePeriod`) carry no person and are kept.
//
// ADR-171 adds the fifth: an announcement's recipient rows 90 days after the
// campaign finished — a list of addresses, on the delivery log's clock. The
// campaign and its counters stay, and so does every suppression: deleting a
// suppression would re-enrol someone who asked to stop.
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // The shared bearer check (`_lib/cron-auth.ts`): 503 with no secret, 401
  // for anything but the right token.
  const refused = cronAuthFailure(request);
  if (refused) return refused;

  const now = new Date();
  const [pendingSubscribers, deliveries, aiUsage, translation, announcementRecipients] =
    await Promise.all([
      purgeExpiredPending(now),
      purgeEmailDeliveries(now),
      purgeAiUsage(),
      purgeTranslationRows(now),
      purgeAnnouncementRecipients(now),
    ]);

  return NextResponse.json(
    {
      sweptAt: now.toISOString(),
      pendingSubscribers,
      deliveries,
      aiUsage,
      translationJobs: translation.jobs,
      translateUsage: translation.usage,
      announcementRecipients,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
