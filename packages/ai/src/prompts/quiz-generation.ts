// `quiz_generation` — draft questions from a published lesson (B6).
//
// This is the feature where "AI never writes to the database" (ADR-097 #4) is a
// design constraint rather than a description: a quiz is a parent row plus N
// questions plus M options, and "just write it as a draft" is exactly the
// shortcut the invariant forbids. The builder's job is to return something the
// EXISTING quiz schemas accept, so that an over-long stem fails identically
// wherever it came from.
import type { AiPayload } from "@repo/contracts";

import { JSON_ONLY, asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";

export function buildQuizGenerationPrompt(
  payload: AiPayload<"quiz_generation">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const language = localeName(payload.locale);
  const difficulty = payload.difficulty ?? "BEGINNER";

  const system = buildSystem(
    [
      "You write multiple-choice comprehension questions from a lesson on a forex and trading education website.",
      "Every question must be answerable from the lesson alone. Never test something the lesson does not state.",
      "Wrong options must be plausible to someone who half-read the lesson, and unambiguously wrong to someone who read it properly. Never use 'all of the above', 'none of the above', or a joke option.",
      `Pitch the questions at ${difficulty.toLowerCase()} level. Write in ${language}.`,
      "",
      "Return this JSON shape:",
      "{",
      '  "questions": [',
      '    { "prompt": string (max 500 chars),',
      '      "options": string[] (3 or 4 entries, each max 300 chars),',
      '      "correctIndex": number (0-based, and it MUST index one of the options above),',
      '      "explanation": string (max 600 chars, one or two sentences citing the lesson) }',
      "  ]",
      "}",
      "",
      // The one failure mode a generated quiz has that a hand-written one does
      // not, so it is stated twice: here, and as a refinement on the schema.
      "A question whose correctIndex does not point at one of its own options is rejected outright, and the whole set is discarded with it.",
      JSON_ONLY,
    ].join("\n"),
    extraInstructions,
  );

  return {
    system,
    messages: [
      {
        role: "user",
        content: [
          `Write exactly ${payload.questionCount} question(s) from this lesson.`,
          asData("lesson title", payload.lessonTitle),
          asData("lesson body", payload.content),
        ].join("\n\n"),
      },
    ],
  };
}
