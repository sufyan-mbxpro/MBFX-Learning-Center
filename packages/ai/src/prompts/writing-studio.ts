// `writing_studio` — the panel on every admin page (ADR-129).
//
// The assistant's rules (`EDITORIAL_BASE`, plain text) plus the three things
// the studio adds: more actions, a longer closed list of tones, and a length
// the admin chose. The length is phrased as a ceiling the model should come in
// under, because a model overshoots a character count far more often than it
// undershoots one, and the screen measures the result anyway (§3).
import type { AiPayload } from "@repo/contracts";

import {
  EDITORIAL_BASE,
  PLAIN_TEXT_FORMAT,
  asData,
  buildSystem,
  localeName,
  type BuiltPrompt,
} from "./shared.ts";

type StudioPayload = AiPayload<"writing_studio">;

const ACTION_INSTRUCTIONS: Record<StudioPayload["action"], string> = {
  draft:
    "Write a new passage on the topic or brief supplied. Stay on that topic, and say only what a careful editor could stand behind.",
  headlines:
    "Write exactly three alternative headlines for the topic or passage supplied, one per line, with no numbering, bullets or quotation marks.",
  rewrite:
    "Rewrite the supplied passage so it reads better: clearer structure, smoother sentences. Keep every fact, figure and claim it makes, and add none.",
  paraphrase:
    "Paraphrase the supplied passage: say the same thing in substantially different words and sentence shapes. The meaning, facts and figures must survive unchanged.",
  fix_grammar:
    "Correct grammar, spelling, punctuation and obvious typos in the supplied passage. Change nothing else — not the wording, not the tone, not the structure, not a single fact.",
  expand:
    "Expand the supplied passage with substance — explanation, a concrete example, a consequence. Do not pad it with restatement, and keep every claim it already makes.",
  shorten:
    "Shorten the supplied passage. Keep its main point and every figure that matters; cut repetition, qualifiers and secondary detail first.",
  summarize:
    "Summarise the supplied passage. Compression, not invention: every sentence you write must be supported by the passage.",
};

/** Exported for `form_fill`, which offers the same closed list. */
export const TONE_WORDS: Record<NonNullable<StudioPayload["tone"]>, string> = {
  professional: "professional and measured",
  friendly: "friendly and direct, addressing the reader as 'you'",
  concise: "as concise as the meaning allows",
  plain: "plain, using everyday words in place of jargon wherever a plain word exists",
  formal: "formal, impersonal and precise",
  casual: "relaxed and conversational, without slang that would date",
  persuasive:
    "persuasive, making the case clearly — without hype, urgency tricks or promises of profit",
  educational:
    "educational, explaining terms as they appear and building from simple to less simple",
};

const FORMAT_WORDS: Record<NonNullable<StudioPayload["format"]>, string> = {
  paragraphs: "Use paragraphs separated by a blank line.",
  bullets: "Use a list: one point per line, each line starting with a hyphen and a space.",
  single_line: "Write a single line with no line breaks.",
};

/** The two actions whose text is a topic rather than a passage to preserve. */
const FROM_TOPIC = new Set<StudioPayload["action"]>(["draft", "headlines"]);

export function buildWritingStudioPrompt(
  payload: StudioPayload,
  extraInstructions?: string | null,
): BuiltPrompt {
  const { action } = payload;
  // Grammar correction changes nothing else, so a tone or a length would
  // contradict its own instruction. Headlines have a fixed shape of their own.
  const mechanical = action === "fix_grammar";

  const rules = [EDITORIAL_BASE, ACTION_INSTRUCTIONS[action], PLAIN_TEXT_FORMAT];
  if (!mechanical && action !== "headlines" && payload.format) {
    rules.push(FORMAT_WORDS[payload.format]);
  }
  rules.push(`Write in ${localeName(payload.locale)}.`);

  const system = buildSystem(rules.join(" "), extraInstructions);

  const parts: string[] = [];
  if (!mechanical && payload.tone) {
    parts.push(`Requested tone: ${TONE_WORDS[payload.tone]}.`);
  }
  if (!mechanical && payload.length) {
    const { unit, target } = payload.length;
    const each = action === "headlines" ? " for EACH headline" : "";
    const counted = unit === "characters" ? ", spaces included" : "";
    parts.push(
      `Length: at most ${target} ${unit}${each}${counted}, and as close to that as the content allows. Never exceed it.`,
    );
  }
  parts.push(
    asData(FROM_TOPIC.has(action) ? "the topic or brief" : "the passage to work on", payload.text),
  );

  return { system, messages: [{ role: "user", content: parts.join("\n\n") }] };
}
