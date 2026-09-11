import { NextResponse, type NextRequest } from "next/server";
import { auth, rateLimit } from "@repo/auth";
import { isFeatureVisible } from "@repo/settings";
import { clientIp } from "../../../../_lib/client-ip.ts";

// The shared front door for every quiz-attempt endpoint (ADR-058 #3, #7).
//
// Three of the four checks are the same as `/api/learn/progress`'s, and they
// are shared here rather than repeated because the failure mode of repeating
// them is one route that quietly forgot the flag.
//
// The fourth is the difference: **`quizzes` must be visible TO THIS SUBJECT.**
// The flag is seeded `AUTHENTICATED`, so an anonymous caller fails it before
// any quiz exists as far as they are concerned — which is ADR-058 #7's policy
// enforced by the flag rather than restated as an `if` in three files.
//
// Note what is NOT here: the quiz's own visibility. `@repo/core` resolves every
// quiz through `publicQuizWhere()`, so a draft or gated quiz produces
// `QuizNotAccessibleError` → 404 at the call site, indistinguishable from one
// that never existed (security.md #7).

const WINDOW_SECONDS = 60;

/** An answer per question plus retries; a runner should never come near this. */
export const ATTEMPT_LIMIT = 90;

export interface QuizCaller {
  userId: string;
}

export type QuizGuard = { ok: true; caller: QuizCaller } | { ok: false; response: NextResponse };

export async function guardQuizRequest(
  request: NextRequest,
  limit: number = ATTEMPT_LIMIT,
): Promise<QuizGuard> {
  const session = await auth();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in to take a quiz" }, { status: 401 }),
    };
  }

  const subject = { id: session.user.id, userType: session.user.userType };
  const [coursesVisible, quizzesVisible] = await Promise.all([
    isFeatureVisible("courses", subject),
    isFeatureVisible("quizzes", subject),
  ]);
  if (!coursesVisible || !quizzesVisible) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const bucket = `learn:quiz:${session.user.id}:${clientIp(request.headers) ?? "-"}`;
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

  return { ok: true, caller: { userId: session.user.id } };
}

/** Per-learner attempt state is never shared cache material. */
export function quizJson(payload: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(payload, {
    ...init,
    headers: { ...init?.headers, "Cache-Control": "private, no-store" },
  });
}

export async function readJson(request: NextRequest): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
