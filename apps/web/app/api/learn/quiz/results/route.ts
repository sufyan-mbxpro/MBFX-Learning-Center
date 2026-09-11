import { type NextRequest, type NextResponse } from "next/server";
import type { QuizProgressView } from "@repo/contracts";
import { getQuizProgressForUser } from "@repo/core";
import { guardQuizRequest, quizJson } from "../_lib/guard.ts";

// The learner's quiz history, for the quiz index's per-card progress bars
// (design pass 2026-09-09).
//
// **A GET, and the only read among the quiz endpoints.** The other three
// (`start`, `answer`, `submit`) advance an attempt; this one advances nothing
// and answers the question the index card asks: "have I done this, and how did
// it go?"
//
// It sits behind the same `guardQuizRequest` as the writes, which gives it the
// three behaviours the island depends on for free:
//
//   401 — a guest. The island renders the quiz's own pass mark and stops; the
//         sign-in prompt above the shelf is what makes the offer (ADR-058 #7).
//   404 — `courses` or `quizzes` is not visible to this subject. Distinct from
//         401 for the same reason `ProgressProvider`'s `off` is: inviting
//         someone to sign in for a switched-off feature is a broken promise.
//   429 — the shared attempt bucket. A page load costs one token against the
//         same allowance a runner spends, which is correct: they are the same
//         learner hitting the same subsystem.
//
// `quizJson` marks the response `private, no-store`. Per-learner state is
// never shared cache material, and this route is the reason the PAGE can stay
// cached — the numbers arrive after paint rather than being baked into it
// (ADR-056 #1).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await guardQuizRequest(request);
  if (!gate.ok) return gate.response;

  const results = await getQuizProgressForUser(gate.caller.userId);
  return quizJson({ results } satisfies QuizProgressView);
}
