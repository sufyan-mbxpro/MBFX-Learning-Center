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

import {
  EDITORIAL_BASE as BASE,
  PLAIN_TEXT_FORMAT as FORMAT,
  asData,
  buildSystem,
  localeName,
  type BuiltPrompt,
} from "./shared.ts";
import { AUDIENCE_WORDS } from "./form-fill.ts";
import { TONE_WORDS } from "./writing-studio.ts";

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

const DRAFT_LENGTH_WORDS: Record<NonNullable<AssistantPayload["length"]>, string> = {
  brief: "Keep it short: one or two paragraphs.",
  standard: "Aim for a few solid paragraphs.",
  in_depth:
    "Go in depth: a thorough section with explanation and a clearly hypothetical worked example.",
};

const DRAFT_FORMAT_WORDS: Record<NonNullable<AssistantPayload["format"]>, string> = {
  paragraphs: "Use paragraphs separated by a blank line.",
  bullets: "Use a list: one point per line, each line starting with a hyphen and a space.",
  single_line: "Write a single line with no line breaks.",
};

type AssistantPayload = AiPayload<"writing_assistant">;

export function buildWritingAssistantPrompt(
  payload: AiPayload<"writing_assistant">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const action = ACTION_INSTRUCTIONS[payload.action] ?? ACTION_INSTRUCTIONS.draft!;
  // Grammar correction never changes language — a locale there would ask it to
  // translate, which contradicts "change nothing else". An edit sent without a
  // locale keeps the passage's own language; a draft has no passage, so it
  // falls back to the site default.
  const keepPassageLanguage =
    payload.selection !== undefined && (payload.action === "fix_grammar" || !payload.locale);
  const languageRule = keepPassageLanguage
    ? "Write in the same language as the supplied passage."
    : `Write in ${localeName(payload.locale)}.`;

  const system = buildSystem([BASE, action, FORMAT, languageRule].join(" "), extraInstructions);

  const parts: string[] = [];
  if ((payload.action === "change_tone" || payload.action === "draft") && payload.tone) {
    parts.push(`Requested tone: ${TONE_WORDS[payload.tone]}.`);
  }
  // The draft dialog's steering. Other actions work on a passage whose reader
  // and length are already set, so these would contradict their instruction.
  if (payload.action === "draft") {
    if (payload.audience) parts.push(`Write for ${AUDIENCE_WORDS[payload.audience]}.`);
    if (payload.wordCount) {
      parts.push(
        `Length: about ${payload.wordCount} words — stay within ten percent of that, and never pad to reach it.`,
      );
    } else if (payload.length) {
      parts.push(DRAFT_LENGTH_WORDS[payload.length]);
    }
    if (payload.format) parts.push(DRAFT_FORMAT_WORDS[payload.format]);
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
