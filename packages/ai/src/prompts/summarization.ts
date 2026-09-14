// `summarization` — the excerpt and the key-takeaways list (B4).
//
// One call can fill either or both, because an editor who wants both should not
// pay for two round trips of the same article body.
import type { AiPayload } from "@repo/contracts";

import { JSON_ONLY, asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";

export function buildSummarizationPrompt(
  payload: AiPayload<"summarization">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const language = localeName(payload.locale);
  const wantExcerpt = payload.want.includes("excerpt");
  const wantTakeaways = payload.want.includes("takeaways");

  const shape: string[] = [];
  if (wantExcerpt) {
    shape.push('  "excerpt": string, at most 300 characters, one or two sentences,');
  }
  if (wantTakeaways) {
    shape.push('  "keyTakeaways": string[], exactly 3 to 5 entries, each at most 160 characters');
  }

  const system = buildSystem(
    [
      "You summarise articles for a forex and trading education website.",
      "Compression, not invention: every sentence you write must be supported by the article. If the article does not settle something, leave it out rather than hedging about it.",
      "No marketing language, no questions, no calls to action.",
      `Write in ${language}.`,
      "",
      "Return this JSON shape:",
      "{",
      ...shape,
      "}",
      "Length limits are hard: an entry one character over is rejected and the whole suggestion is discarded.",
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
          asData("article title", payload.title),
          asData("article body", payload.content),
        ].join("\n\n"),
      },
    ],
  };
}
