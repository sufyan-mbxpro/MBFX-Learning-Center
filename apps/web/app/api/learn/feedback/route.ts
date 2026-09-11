import { NextResponse, type NextRequest } from "next/server";
import { auth, rateLimit } from "@repo/auth";
import { lessonFeedbackSchema } from "@repo/contracts";
import { LessonFeedbackNotAccessibleError, recordLessonFeedback } from "@repo/core";
import { isFeatureVisible } from "@repo/settings";
import { clientIp } from "../../../_lib/client-ip.ts";

// "Was this lesson helpful?" (PR 5.5, ADR-056 #8).
//
// **This endpoint accepts ANONYMOUS writes**, which makes it the most exposed
// surface in the learning area and the reason the rate limit here is tighter
// than the progress endpoint's. Gating the prompt behind sign-in would collect
// almost nothing — the reference asks before sign-in for exactly that reason —
// so the cost of being open is paid with a limit rather than a login.
//
// Three properties keep that safe:
//
//   1. **The payload cannot name a user.** `lessonFeedbackSchema` is
//      `{ lessonId, helpful }`. A signed-in vote is attributed from the
//      session; an anonymous one is stored with a null userId.
//   2. **The lesson is resolved through the public rule** in `@repo/core`, so
//      a vote cannot probe for unpublished content — a hidden lesson answers
//      404, identically to one that never existed.
//   3. **The write is bounded.** Per IP, because there is no account to bound
//      it by; a signed-in learner is additionally bounded by the unique
//      constraint, which makes repeat votes an update rather than growth.
//
// Browser-level dedup lives in the client component's `localStorage` and is
// deliberately NOT relied on here. It stops a reader voting twice by accident;
// it stops nothing else, and this route is written as though it did not exist.

/** Deliberately tight: a reader votes once per lesson, not fifteen times a minute. */
const LIMIT = 10;
const WINDOW_SECONDS = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const subject = session ? { id: session.user.id, userType: session.user.userType } : null;

  // Gated on `courses` alone, not `progress_tracking`: feedback is not
  // progress, and an anonymous reader — who by definition fails an
  // AUTHENTICATED flag — is exactly who this is here to hear from.
  if (!(await isFeatureVisible("courses", subject))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // An unidentifiable caller falls into one shared bucket. That is the
  // conservative direction: it throttles the anonymous-and-header-less case
  // harder than a normal visitor, rather than exempting it.
  const bucket = `learn:feedback:${session?.user.id ?? clientIp(request.headers) ?? "anonymous"}`;
  const limited = await rateLimit(bucket, LIMIT, WINDOW_SECONDS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = lessonFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    await recordLessonFeedback({
      lessonId: parsed.data.lessonId,
      userId: session?.user.id ?? null,
      helpful: parsed.data.helpful,
    });
  } catch (error) {
    if (error instanceof LessonFeedbackNotAccessibleError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  // No tally comes back. The counts are an editorial signal (Phase 9), and
  // telling a reader "3 of 47 found this helpful" tells them to skip the
  // lesson — the opposite of what asking was for.
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
