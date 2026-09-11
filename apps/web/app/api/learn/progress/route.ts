import { NextResponse, type NextRequest } from "next/server";
import { auth, rateLimit } from "@repo/auth";
import { progressQuerySchema, progressWriteSchema } from "@repo/contracts";
import {
  CourseNotAccessibleError,
  LessonNotAccessibleError,
  getCourseProgress,
  getLearnerDashboard,
  markLessonComplete,
  markLessonIncomplete,
  touchLesson,
} from "@repo/core";
import { isFeatureVisible } from "@repo/settings";
import { clientIp } from "../../../_lib/client-ip.ts";

// **This route is the authorization boundary for learner progress**
// (ADR-056 #1). The course and lesson pages are not — they are cached, they
// read no session, and they render every lesson "not started" for everybody.
// Everything per-learner enters and leaves through here.
//
// Four checks run before any progress is read or written, in this order:
//
//   1. **Session.** No session, no progress — 401. The caller never names a
//      user; `progressWriteSchema` has no `userId` field and the session is
//      the only source of one.
//   2. **Flags.** `courses` must be visible at all, and `progress_tracking`
//      must be visible TO THIS SUBJECT. The latter is seeded `AUTHENTICATED`,
//      which is precisely ADR-056 #3's "guests read everything, progress needs
//      an account" — so the policy is enforced by the flag rather than
//      restated in code.
//   3. **Rate limit** (security.md #13). Keyed by session id, not IP: this is
//      an authenticated endpoint, so the account is the honest budget holder,
//      and one office behind one NAT should not share a bucket.
//   4. **Parse** through `@repo/contracts` (security.md #6).
//
// Visibility of the CONTENT is enforced one level down: `@repo/core`'s
// `locateLesson()`/`requirePublicCourse()` resolve through the same public
// rule the cached loaders use, and a hidden lesson comes back as
// `LessonNotAccessibleError` → 404, never 403 (security.md #7).

/** Generous: a lesson page fires one touch, a completion, and re-reads. */
const WRITE_LIMIT = 60;
const READ_LIMIT = 120;
const WINDOW_SECONDS = 60;

interface Allowed {
  userId: string;
  userType: "LEARNER" | "STAFF";
}

type Guard = { ok: true; subject: Allowed } | { ok: false; response: NextResponse };

async function guard(request: NextRequest, limit: number): Promise<Guard> {
  const session = await auth();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in to track your progress" }, { status: 401 }),
    };
  }

  const subject = { id: session.user.id, userType: session.user.userType };
  const [coursesVisible, progressVisible] = await Promise.all([
    isFeatureVisible("courses", subject),
    isFeatureVisible("progress_tracking", subject),
  ]);
  // 404 rather than 403: with the feature off, this endpoint does not exist as
  // far as a caller is concerned — the same answer `/learn` itself gives.
  if (!coursesVisible || !progressVisible) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  // The IP is a secondary bucket, not the primary one — see clientIp().
  const bucket = `learn:progress:${session.user.id}:${clientIp(request.headers) ?? "-"}`;
  const limited = await rateLimit(bucket, limit, WINDOW_SECONDS);
  if (!limited.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      ),
    };
  }

  return { ok: true, subject: { userId: session.user.id, userType: subject.userType } };
}

/** A hidden or missing resource is indistinguishable from the outside. */
function notFoundIfHidden(error: unknown): NextResponse {
  if (error instanceof LessonNotAccessibleError || error instanceof CourseNotAccessibleError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  throw error;
}

/**
 * `?course=<id>` → that course's per-lesson detail.
 * No parameter → the learner's enrollment summaries for the `/learn` shelf.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await guard(request, READ_LIMIT);
  if (!gate.ok) return gate.response;

  const parsed = progressQuerySchema.safeParse({
    course: request.nextUrl.searchParams.get("course") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    if (parsed.data.course === undefined) {
      const enrollments = await getLearnerDashboard(gate.subject.userId);
      return jsonNoStore({ enrollments });
    }
    const view = await getCourseProgress(gate.subject.userId, parsed.data.course);
    return jsonNoStore(view);
  } catch (error) {
    return notFoundIfHidden(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await guard(request, WRITE_LIMIT);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = progressWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { lessonId, action } = parsed.data;
  try {
    const view =
      action === "complete"
        ? await markLessonComplete(gate.subject.userId, lessonId)
        : action === "incomplete"
          ? await markLessonIncomplete(gate.subject.userId, lessonId)
          : await touchLesson(gate.subject.userId, lessonId);
    return jsonNoStore(view);
  } catch (error) {
    return notFoundIfHidden(error);
  }
}

/**
 * Per-learner data must never sit in a shared cache. `private, no-store` is
 * belt and braces next to the fact that nothing between the browser and this
 * handler is configured to cache a JSON POST — but the one time it matters is
 * the time a CDN is added in front and nobody rechecks this file.
 */
function jsonNoStore(payload: unknown): NextResponse {
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
