// `alt_text` — one sentence for a screen-reader user (B5).
//
// The bytes arrive from `@repo/core`'s `readStoredFile`, never from a URL: this
// package never touches storage and never fetches anything, and the model is
// never handed a URL to fetch. That is security.md #9 restated for a client
// that would happily follow one.
import type { AiPayload } from "@repo/contracts";

import { JSON_ONLY, asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";

export function buildAltTextPrompt(
  payload: AiPayload<"alt_text">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const language = localeName(payload.locale);

  const system = buildSystem(
    [
      "You write alternative text for images on a forex and trading education website.",
      "One sentence, under 125 characters, describing what a sighted reader sees and why it is on the page.",
      'Never begin with "image of", "picture of", "a screenshot showing" or any equivalent — a screen reader already says it is an image.',
      "Never invent text, numbers, or values you cannot actually read in the image. If the image contains readable text that carries its meaning, quote it briefly instead of describing it.",
      `Write in ${language}.`,
      "",
      'Return this JSON shape: { "altText": string, at most 160 characters }',
      JSON_ONLY,
    ].join("\n"),
    extraInstructions,
  );

  // The filename is often the only hint about what the picture is FOR, and it
  // is also author-controlled text, so it is delimited like any other input.
  const hint = payload.filename
    ? asData("file name, as a hint only — it may be wrong or meaningless", payload.filename)
    : "No file name is available.";

  return {
    system,
    messages: [{ role: "user", content: ["Describe this image.", hint].join("\n\n") }],
  };
}
