import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { publishDueArticles, publishDueContent } from "@repo/core";

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
export const dynamic = "force-dynamic";

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  // Absent secret FAILS CLOSED. An unset variable must never mean "anyone may
  // publish content" — 503 says the endpoint is not configured, which is true,
  // and leaves the product correct because of the query-side rule above.
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
  // force an early return that leaks the length through timing — the exact
  // thing the function exists to prevent. Digests are always 32 bytes, so the
  // comparison is constant-width and constant-time for every input.
  const digest = (v: string) => createHash("sha256").update(v).digest();
  if (!timingSafeEqual(digest(presented), digest(secret))) return unauthorized();

  const now = new Date();
  const [articles, content] = await Promise.all([publishDueArticles(now), publishDueContent(now)]);

  return NextResponse.json(
    { sweptAt: now.toISOString(), articles, content },
    { headers: { "cache-control": "no-store" } },
  );
}
