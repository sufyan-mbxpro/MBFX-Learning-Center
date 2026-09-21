// `form_fill` — the "Generate with AI" bar and every field's ✨ menu (ADR-126).
//
// The JSON shape is DESCRIBED FROM `AI_FILL_FIELDS`, the same registry the
// output schemas are built from, so the prompt cannot ask for a limit the
// parser does not enforce. Rich fields are asked for as BLOCKS, never HTML:
// `aiBlocksToHtml` writes the markup, which is how formatting survives the
// sanitizer and a model's `<script>` arrives as text.
import {
  AI_FILL_FIELDS,
  aiFillField,
  type AiFillFieldDefinition,
  type AiFillModule,
  type AiPayload,
} from "@repo/contracts";

import { JSON_ONLY, asData, buildSystem, localeName, type BuiltPrompt } from "./shared.ts";
import { TONE_WORDS } from "./writing-studio.ts";

type FormPayload = Extract<AiPayload<"form_fill">, { mode: "form" }>;

const LENGTH_WORDS: Record<NonNullable<FormPayload["length"]>, string> = {
  brief:
    "Keep it brief: the long-form field is a few short paragraphs, lists stay at their minimum.",
  standard:
    "Aim for a standard length: the long-form field covers the subject properly without padding.",
  in_depth:
    "Go in depth: the long-form field is thorough, with sections, explanation and a worked example. Short fields still respect their limits.",
};

/** Exported for the assistant's draft dialog, which offers the same levels. */
export const AUDIENCE_WORDS: Record<NonNullable<FormPayload["audience"]>, string> = {
  beginner: "a beginner who is new to trading: define every term the first time it appears",
  intermediate: "an intermediate trader who knows the basic vocabulary",
  advanced: "an experienced trader: skip the basics and go into nuance",
};

/** The optional steering a person chose in the bar, as prompt lines. */
function steering(payload: FormPayload): string[] {
  return [
    ...(payload.tone ? [`Tone: ${TONE_WORDS[payload.tone]}.`] : []),
    ...(payload.audience ? [`Write for ${AUDIENCE_WORDS[payload.audience]}.`] : []),
    ...(payload.length ? [LENGTH_WORDS[payload.length]] : []),
  ];
}

const MODULE_NAMES: Record<AiFillModule, string> = {
  article: "a news or market-analysis article",
  course: "a course",
  lesson: "a lesson inside a course",
  video_topic: "a video topic page (a written guide shown beside videos)",
  quiz: "a quiz",
  glossary_term: "a glossary term",
  glossary_topic: "a glossary topic that groups related terms",
  tool: "a trading tool's page (the explanatory copy around a calculator; the calculator itself is code and must not be described as doing anything it was not said to do)",
};

const RICH_FORMAT = [
  "A rich-text value is an ARRAY OF BLOCKS, never HTML or Markdown. Each block is one of:",
  '  { "type": "heading", "level": 2 or 3, "text": string (at most 200 characters) }',
  '  { "type": "paragraph", "text": string (at most 4000 characters) }',
  '  { "type": "list", "ordered": boolean, "items": string[] (1 to 20 items, each at most 600 characters) }',
  '  { "type": "quote", "text": string (at most 1000 characters) }',
  "Inside any text you may use **bold** and *italic*. No other formatting, no links, no tags.",
].join("\n");

const QUESTION_FORMAT =
  '{ "prompt": string (at most 500 characters), "options": string[] (2 to 6, each at most 300 characters), "correctIndex": integer index into options, "explanation": string (at most 600 characters) }';

/** One line of the JSON description for a field. */
function describeField(field: AiFillFieldDefinition): string {
  const purpose = ` — ${field.purpose}`;
  switch (field.kind) {
    case "text":
    case "textarea":
      return `  "${field.key}": string, at most ${field.max ?? 255} characters${purpose}`;
    case "rich":
      return `  "${field.key}": rich-text blocks${purpose}`;
    case "list":
      return `  "${field.key}": string[], ${field.minItems ?? 1} to ${field.maxItems ?? 10} items, each at most ${field.max ?? 300} characters${purpose}`;
    case "faq":
      return `  "${field.key}": { "question": string (at most 300 characters), "answer": plain-text string (at most 2000 characters) }[], at most ${field.maxItems ?? 8} items${purpose}`;
    case "questions":
      return `  "${field.key}": ${QUESTION_FORMAT}[]${purpose}`;
  }
}

const RULES = [
  "You write for a forex and trading education website. Your readers are learning; write clearly, accurately and without hype.",
  "Never give personal financial advice, never promise or imply returns, and always treat trading as risky.",
  "Never invent facts you were not given: no current prices, dates, statistics, named institutions, named people or quotations. Worked examples use round, obviously hypothetical numbers and say so.",
  "Never return a URL, an image, a file path, a slug, a category, a status or any field not listed below.",
];

const ACTION_INSTRUCTIONS = {
  regenerate: "Write a fresh version of this field from the brief and the rest of the page.",
  improve:
    "Improve the current value: clearer, more accurate, better organised. Keep its meaning and roughly its length.",
  shorten: "Make the current value noticeably shorter while keeping what matters.",
  expand:
    "Expand the current value with more useful detail and explanation, staying on the same subject.",
} as const;

function contextParts(context: Record<string, string> | undefined): string[] {
  if (!context) return [];
  return Object.entries(context)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => asData(`current ${key}`, value));
}

export function buildFormFillPrompt(
  payload: AiPayload<"form_fill">,
  extraInstructions?: string | null,
): BuiltPrompt {
  const language = localeName(payload.locale);
  const moduleName = MODULE_NAMES[payload.module];

  if (payload.mode === "form") {
    const fields = AI_FILL_FIELDS[payload.module] as readonly AiFillFieldDefinition[];
    const hasRich = fields.some((f) => f.kind === "rich");
    const hasQuestions = fields.some((f) => f.kind === "questions");

    const system = buildSystem(
      [
        ...RULES,
        `You are drafting ${moduleName} from a brief written by a member of staff. Write in ${language}.`,
        "Where the page already has text, stay consistent with it; where a field is empty, write it.",
        ...steering(payload),
        "",
        "Return this JSON shape. Every field is optional — omit one only if the brief gives you nothing honest to write:",
        "{",
        fields.map(describeField).join(",\n"),
        "}",
        ...(hasRich ? ["", RICH_FORMAT] : []),
        ...(hasQuestions
          ? [
              "",
              `Write ${payload.questionCount ?? 5} questions. Each has exactly one correct option, plausible wrong options, and an explanation of why the answer is right.`,
            ]
          : []),
        "",
        "Every length limit is hard: one value over its limit and the whole draft is discarded.",
        JSON_ONLY,
      ].join("\n"),
      extraInstructions,
    );

    const parts = [asData("brief", payload.brief), ...contextParts(payload.context)];
    return { system, messages: [{ role: "user", content: parts.join("\n\n") }] };
  }

  // `field` mode. The payload schema has already refused a field that is not a
  // single-value text field of this module, so the lookup cannot miss.
  const field = aiFillField(payload.module, payload.field)!;
  const system = buildSystem(
    [
      ...RULES,
      `You are editing one field of ${moduleName}. Write in ${language}.`,
      ACTION_INSTRUCTIONS[payload.action],
      "",
      "Return this JSON shape:",
      "{",
      describeField({ ...field, key: "value" }),
      "}",
      ...(field.kind === "rich" ? ["", RICH_FORMAT] : []),
      "",
      "The length limit is hard: a value over it is discarded.",
      JSON_ONLY,
    ].join("\n"),
    extraInstructions,
  );

  const parts = [
    ...(payload.brief ? [asData("brief", payload.brief)] : []),
    asData(`current ${payload.field}`, payload.current || "(empty)"),
    ...contextParts(payload.context),
  ];
  return { system, messages: [{ role: "user", content: parts.join("\n\n") }] };
}
