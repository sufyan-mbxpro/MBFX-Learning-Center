import { type NextRequest, type NextResponse } from "next/server";
import { quizStartSchema } from "@repo/contracts";
import { AttemptLimitReachedError, QuizNotAccessibleError, startQuizAttempt } from "@repo/core";
import { guardQuizRequest, quizJson, readJson } from "../_lib/guard.ts";

// Begin an attempt, or resume the one already open (ADR-058 #3).
//
// **The attempt is created server-side and the id is the only handle the
// client gets.** Every later call names that id, and `@repo/core` scopes it to
// the session user, so an attempt id belonging to someone else is not "denied"
// — it does not resolve.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await guardQuizRequest(request);
  if (!gate.ok) return gate.response;

  const parsed = quizStartSchema.safeParse(await readJson(request));
  if (!parsed.success) return quizJson({ error: "Invalid body" }, { status: 400 });

  try {
    return quizJson(await startQuizAttempt(gate.caller.userId, parsed.data.quizId));
  } catch (error) {
    if (error instanceof QuizNotAccessibleError) {
      return quizJson({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof AttemptLimitReachedError) {
      // 409, not 403: the learner is permitted to take this quiz, they have
      // simply used the attempts it allows. The distinction matters to the
      // runner, which shows "no attempts left" rather than "not allowed".
      return quizJson({ error: "No attempts remaining" }, { status: 409 });
    }
    throw error;
  }
}
