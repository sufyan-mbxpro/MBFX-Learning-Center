// `seo_generation` — the SEO section of every editor that has one (B2): articles,
// courses, lessons, video topics, glossary terms and topics, tools.
//
// The limits named in the prompt are the COLUMN's limits, and the response is
// parsed by `seoSuggestionSchema` with those same numbers. Over-length is a
// parse failure, not a truncation: a truncated meta description is a worse
// artefact than an honest retry (plan §14.2).
import type { AiPayload } from "@repo/contracts";

import { JSON_ONLY, asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";

export function buildSeoGenerationPrompt(
  payload: AiPayload<"seo_generation">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const language = localeName(payload.locale);

  const system = buildSystem(
    [
      "You write search metadata for a forex and trading education website.",
      "You describe what the page actually contains. You never promise returns, never use clickbait, and never invent a claim the page does not make.",
      `Write in ${language}.`,
      "",
      "Return this JSON shape:",
      "{",
      '  "seoTitle": string, at most 70 characters,',
      '  "seoDescription": string, at most 180 characters,',
      '  "ogTitle": string, at most 120 characters,',
      '  "ogDescription": string, at most 300 characters,',
      '  "focusKeywords": string[], at most 5 entries, each at most 60 characters',
      "}",
      "",
      "Every length limit is hard: a field one character over is rejected outright and the whole suggestion is discarded.",
      // The image field is deliberately absent, and the prompt says so, because
      // a model inventing an image URL is exactly the SSRF-shaped input
      // security.md #9 exists to refuse.
      "Never return an image, a URL, or a file path of any kind.",
      JSON_ONLY,
    ].join("\n"),
    extraInstructions,
  );

  const parts = [asData("page title", payload.title)];
  if (payload.excerpt) parts.push(asData("page excerpt", payload.excerpt));
  parts.push(asData("page body", payload.content));

  return { system, messages: [{ role: "user", content: parts.join("\n\n") }] };
}
