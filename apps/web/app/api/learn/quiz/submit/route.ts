import { type NextRequest, type NextResponse } from "next/server";
import { quizSubmitSchema } from "@repo/contracts";
import { AttemptNotFoundError, QuizNotAccessibleError, submitQuizAttempt } from "@repo/core";
import { guardQuizRequest, quizJson, readJson } from "../_lib/guard.ts";

// Finalise an attempt (ADR-058 #3).
//
// **The body is an attempt id and a locale. There is nowhere to put a score.**
// That is the difference between "a forged score is ignored" and "a forged
// score is unrepresentable", and it is why the schema is worth reading before
// this handler.
//
// The score comes from the grades `@repo/core` wrote one answer at a time, and
// passing has side effects there — a `QUIZ_PASS` lesson gets the same
// `LessonProgress` row a manual completion writes, and a course using this as
// its final quiz gets a completion recount (ADR-058 #6).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await guardQuizRequest(request);
  if (!gate.ok) return gate.response;

  const parsed = quizSubmitSchema.safeParse(await readJson(request));
  if (!parsed.success) return quizJson({ error: "Invalid body" }, { status: 400 });

  try {
    const result = await submitQuizAttempt(
      gate.caller.userId,
      parsed.data.attemptId,
      parsed.data.locale,
    );
    return quizJson(result);
  } catch (error) {
    if (error instanceof AttemptNotFoundError || error instanceof QuizNotAccessibleError) {
      return quizJson({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}
