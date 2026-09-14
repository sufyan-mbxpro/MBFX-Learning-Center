// `writing_assistant` — the five toolbar actions (B1).
//
// **Plain text, both directions** (ADR-097). Tiptap's vocabulary here is
// class-based on purpose: `editor-extensions.ts` says colour, family, size and
// alignment are hand-written class marks BECAUSE the stock extensions emit
// inline styles the sanitizer strips (ADR-046). A model asked for HTML emits
// exactly those stripped shapes, so the admin would see formatting in the
// editor that silently disappears on save. Text in, text out, formatting by the
// admin.
import type { AiPayload } from "@repo/contracts";

import { asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";

const BASE =
  "You are an editorial assistant for a forex and trading education website. You write clear, accurate, plain prose for adult learners. You never give personalised financial advice, never promise returns, and never invent statistics, quotations, or sources.";

const FORMAT =
  "Return PLAIN TEXT only. No HTML, no Markdown syntax, no headings markup, no code fences. Paragraphs separated by a blank line.";

const ACTION_INSTRUCTIONS: Record<string, string> = {
  draft:
    "Draft the passage the writer has asked for. Match the voice and reading level of any surrounding text you are given.",
  expand:
    "Expand the supplied passage with substance — explanation, a concrete example, a consequence. Do not pad it with restatement, and keep every claim it already makes.",
  change_tone:
    "Rewrite the supplied passage in the requested tone. The meaning, the facts and the figures must survive the rewrite unchanged.",
  summarize:
    "Summarise the supplied passage. Compression, not invention: every sentence you write must be supported by the passage.",
  fix_grammar:
    "Correct grammar, spelling, punctuation and obvious typos in the supplied passage. Change nothing else — not the wording, not the tone, not the structure, not a single fact.",
};

const TONE_WORDS: Record<string, string> = {
  professional: "professional and measured",
  friendly: "friendly and direct, addressing the reader as 'you'",
  concise: "as concise as the meaning allows",
  plain: "plain, using everyday words in place of jargon wherever a plain word exists",
};

export function buildWritingAssistantPrompt(
  payload: AiPayload<"writing_assistant">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const action = ACTION_INSTRUCTIONS[payload.action] ?? ACTION_INSTRUCTIONS.draft!;
  const language = localeName(payload.locale);

  const system = buildSystem(
    [BASE, action, FORMAT, `Write in ${language}.`].join(" "),
    extraInstructions,
  );

  const parts: string[] = [];
  if (payload.action === "change_tone" && payload.tone) {
    parts.push(`Requested tone: ${TONE_WORDS[payload.tone] ?? payload.tone}.`);
  }
  if (payload.instruction) {
    // The writer's own brief. Delimited like everything else a human typed: a
    // brief is an input, and the instruction that governs the task is above.
    parts.push(asData("what the writer asked for", payload.instruction));
  }
  if (payload.context) {
    parts.push(asData("surrounding document text, for voice and context only", payload.context));
  }
  if (payload.selection) {
    parts.push(asData("the passage to work on", payload.selection));
  }
  if (parts.length === 0) {
    parts.push("Draft an opening passage for a new article on this site.");
  }

  return { system, messages: [{ role: "user", content: parts.join("\n\n") }] };
}
