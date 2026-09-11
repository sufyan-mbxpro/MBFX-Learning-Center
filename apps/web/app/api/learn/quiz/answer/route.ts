import { type NextRequest, type NextResponse } from "next/server";
import { quizAnswerSchema } from "@repo/contracts";
import {
  AttemptAlreadySubmittedError,
  AttemptNotFoundError,
  QuizNotAccessibleError,
  recordQuizAnswer,
} from "@repo/core";
import { guardQuizRequest, quizJson, readJson } from "../_lib/guard.ts";

// Record and grade one answer (ADR-058 #3, #4).
//
// The response carries `correct` ONLY when `showAnswersAfter` allows it, and
// that decision is made in `@repo/core` rather than here — a route that
// remembered to check the setting would be a route that could forget. Under
// `NEVER` the answer is still graded and stored; the learner simply is not told
// yet, and the final score is unaffected.
//
// The correct ANSWER is never in this response under any setting. `correct` is
// a boolean about what the learner chose; revealing the right option is the
// review's job, and the review has its own gate.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await guardQuizRequest(request);
  if (!gate.ok) return gate.response;

  const parsed = quizAnswerSchema.safeParse(await readJson(request));
  if (!parsed.success) return quizJson({ error: "Invalid body" }, { status: 400 });

  try {
    const result = await recordQuizAnswer(
      gate.caller.userId,
      parsed.data.attemptId,
      parsed.data.questionId,
      parsed.data.answer,
    );
    return quizJson(result);
  } catch (error) {
    // An attempt belonging to someone else, an unknown id, and a question that
    // is not in this quiz all land here and all answer the same way.
    if (error instanceof AttemptNotFoundError || error instanceof QuizNotAccessibleError) {
      return quizJson({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof AttemptAlreadySubmittedError) {
      return quizJson({ error: "This attempt is already submitted" }, { status: 409 });
    }
    throw error;
  }
}
