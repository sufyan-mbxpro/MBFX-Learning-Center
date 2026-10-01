import { NextResponse, type NextRequest } from "next/server";
import { publishDueArticles, publishDueContent } from "@repo/core";
import { cronAuthFailure } from "../_lib/cron-auth.ts";

// The scheduled-publishing sweep (ADR-071 #3) — this repo's first scheduled-job
// seam, and deliberately the thinnest one that works.
//
// **Nothing depends on this route running.** ADR-071 #1 puts scheduled
// visibility in the QUERY: `publicArticleWhere` and the five learn
// where-helpers all match `PUBLISHED, or SCHEDULED and due`, so a row goes
// live at its minute whether or not a sweep ever fires. What this adds is
// bookkeeping — it flips a due row's `status` to PUBLISHED and stamps
// `publishedAt` with the time the row was PROMISED rather than the time the
// sweep happened to run, which is what keeps "published at" honest after a
// sweep that ran late or not at all.
//
// That is why there is no queue, no worker and no `node-cron` dependency: the
// caller is whatever the deployment already has — a platform cron, a systemd
// timer, an uptime pinger. An in-process `setInterval` would be the wrong
// answer twice over, running N times across N instances or never at all in a
// serverless one.
//
// **Auth is a shared secret, not `requirePermission()`.** There is no subject
// here; security.md #1 governs mutations made BY someone, and inventing a
// system user to satisfy it would put a fictional actor in the audit trail.
// The sweeps audit with `userId: null`, the convention `publishDueArticles`
// set for exactly this case.
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
  const [articles, content] = await Promise.all([publishDueArticles(now), publishDueContent(now)]);

  return NextResponse.json(
    { sweptAt: now.toISOString(), articles, content },
    { headers: { "cache-control": "no-store" } },
  );
}
