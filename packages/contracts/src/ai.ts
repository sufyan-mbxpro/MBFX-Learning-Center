// AI platform contracts (Module 18, ADR-097/098/099/100).
//
// ADR-042's split, a third time — after email templates (ADR-078 #5) and
// tools (ADR-086 #1): **the set of AI features is code, and everything a
// feature says is data.** `AI_FEATURES` below decides which features exist,
// what each one sends, which model tier it wants and whether it streams. An
// `AiFeature` row decides on/off, provider, model, output ceiling and up to
// 1000 characters of house style. An admin can never mint a key and can never
// replace a system prompt, because both are behaviour.
//
// Two other rules live here rather than beside their callers:
//
//   1. **A model's OUTPUT is parsed by the same schema the form uses.** An
//      over-length meta description is a FAILED row, not a truncation — a
//      truncated meta description is a worse artefact than an honest retry.
//   2. **A blank API key means UNCHANGED.** ADR-087's write-only field
//      contract, copied verbatim: the field renders empty over a stored key,
//      so "blank = erase" would wipe the credential on every unrelated save.
import { z } from "zod";

// ─── Model tiers (ADR-099) ───────────────────────────────────

/**
 * Which cost class an entry wants.
 *
 * It is a ROLE, not a model id, because `fix_grammar` is an ACTION inside
 * `writing_assistant` and a per-feature model column cannot say "grammar on
 * Haiku, drafting on Opus" (ADR-099 #4). The three roles resolve through
 * `ai.model.light` / `.standard` / `.heavy`, which is also what makes the cost
 * dial one place rather than six dropdowns.
 */
export const AI_MODEL_ROLES = ["light", "standard", "heavy"] as const;
export type AiModelRole = (typeof AI_MODEL_ROLES)[number];

/**
 * Thinking effort. Code, never an admin control (ADR-099): effort and tier
 * move together, because a `light` entry at `high` effort is a Haiku bill
 * pretending to be a Haiku bill.
 */
export const AI_EFFORTS = ["low", "medium", "high"] as const;
export type AiEffort = (typeof AI_EFFORTS)[number];

export const AI_PROVIDER_KINDS = ["ANTHROPIC", "OPENAI", "ECHO"] as const;
export type AiProviderKindValue = (typeof AI_PROVIDER_KINDS)[number];

export const AI_CALL_STATUSES = ["OK", "FAILED", "ABORTED", "REFUSED"] as const;
export type AiCallStatusValue = (typeof AI_CALL_STATUSES)[number];

/** What the cap does when it is reached (§7.3). */
export const AI_CAP_BEHAVIORS = ["DISABLE", "NOTIFY_ONLY"] as const;
export type AiCapBehavior = (typeof AI_CAP_BEHAVIORS)[number];

// ─── The feature registry ────────────────────────────────────

/** Where the affordance lives, which is what the features screen names. */
export type AiFeatureSurface = "editor" | "media";

export interface AiFeatureDefinition {
  readonly key: string;
  readonly surface: AiFeatureSurface;
  readonly streams: boolean;
  readonly modelRole: AiModelRole;
  readonly effort: AiEffort;
  readonly vision: boolean;
  /** The registry ceiling — one of the three in `config.ts`'s clamp. */
  readonly maxOutputTokens: number;
  /** What a usage row is usually ABOUT. `"any"` where it varies by caller. */
  readonly entity: string;
}

export const AI_FEATURES = [
  {
    key: "writing_assistant",
    surface: "editor",
    streams: true,
    modelRole: "heavy",
    effort: "high",
    vision: false,
    maxOutputTokens: 2000,
    entity: "article",
  },
  {
    key: "seo_generation",
    surface: "editor",
    streams: false,
    modelRole: "standard",
    effort: "medium",
    vision: false,
    maxOutputTokens: 700,
    entity: "article",
  },
  {
    key: "translation",
    surface: "editor",
    streams: false,
    modelRole: "light",
    effort: "medium",
    vision: false,
    maxOutputTokens: 4000,
    entity: "any",
  },
  {
    key: "summarization",
    surface: "editor",
    streams: false,
    modelRole: "standard",
    effort: "medium",
    vision: false,
    maxOutputTokens: 800,
    entity: "article",
  },
  {
    key: "alt_text",
    surface: "media",
    streams: false,
    modelRole: "light",
    effort: "low",
    vision: true,
    maxOutputTokens: 200,
    entity: "media",
  },
  // Pulled forward out of the tutor-chatbot spec by the owner (2026-09-14). It
  // is staff-triggered, admin-surface and reviewed — Phase 2's shape exactly —
  // and it lands as a DRAFT quiz in the existing seven-state machine, so it
  // needs no ADR beyond ADR-097. The tutor chatbot it was originally bundled
  // with does NOT come with it, and deliberately has no key here: a registry
  // key with no builder behind it is a switch an admin can flip into a 500.
  {
    key: "quiz_generation",
    surface: "editor",
    streams: false,
    modelRole: "standard",
    effort: "medium",
    vision: false,
    maxOutputTokens: 3000,
    entity: "lesson",
  },
] as const satisfies readonly AiFeatureDefinition[];

export type AiFeatureKey = (typeof AI_FEATURES)[number]["key"];

export const AI_FEATURE_KEYS = AI_FEATURES.map((f) => f.key) as readonly AiFeatureKey[];

export function isAiFeatureKey(key: string): key is AiFeatureKey {
  return (AI_FEATURE_KEYS as readonly string[]).includes(key);
}

export function aiFeature(key: AiFeatureKey): AiFeatureDefinition {
  const found = AI_FEATURES.find((f) => f.key === key);
  // Unreachable through the type, but the registry is read by seed scripts and
  // route handlers where the string arrives from outside.
  if (!found) throw new Error(`Unknown AI feature: ${key}`);
  return found;
}

// ─── The assistant's actions (B1) ────────────────────────────

/**
 * The five things the writing assistant does.
 *
 * A nested registry rather than five feature keys: an admin thinks of this as
 * one tool with one switch, and splitting `fix_grammar` out would put a second
 * toolbar toggle on the screen to say the same thing. Each action declares its
 * OWN `modelRole`, which is the whole reason `modelRole` exists (ADR-099 #4) —
 * mechanical corrections cost a fifth of what drafting does, and the admin
 * never has to know that.
 */
export interface AiAssistantActionDefinition {
  readonly key: string;
  readonly modelRole: AiModelRole;
  readonly effort: AiEffort;
  /** Whether the action needs a selection. `draft` is the one that does not. */
  readonly needsSelection: boolean;
}

export const AI_ASSISTANT_ACTIONS = [
  { key: "draft", modelRole: "heavy", effort: "high", needsSelection: false },
  { key: "expand", modelRole: "heavy", effort: "high", needsSelection: true },
  { key: "change_tone", modelRole: "heavy", effort: "high", needsSelection: true },
  { key: "summarize", modelRole: "standard", effort: "medium", needsSelection: true },
  { key: "fix_grammar", modelRole: "light", effort: "low", needsSelection: true },
] as const satisfies readonly AiAssistantActionDefinition[];

export type AiAssistantAction = (typeof AI_ASSISTANT_ACTIONS)[number]["key"];

export const AI_ASSISTANT_ACTION_KEYS = AI_ASSISTANT_ACTIONS.map(
  (a) => a.key,
) as readonly AiAssistantAction[];

/**
 * A closed list, because a free-text tone field is a free-text PROMPT field
 * wearing a label.
 */
export const AI_TONES = ["professional", "friendly", "concise", "plain"] as const;
export type AiTone = (typeof AI_TONES)[number];

// ─── Payloads: what each feature is given ────────────────────

/** The longest authored text any builder will accept, in characters. */
export const AI_MAX_CONTENT_CHARS = 60_000;

const contentSchema = z.string().min(1).max(AI_MAX_CONTENT_CHARS);

export const writingAssistantPayloadSchema = z.object({
  action: z.enum(AI_ASSISTANT_ACTION_KEYS as readonly [AiAssistantAction, ...AiAssistantAction[]]),
  /** The selection, as PLAIN TEXT (ADR-097 — text in, text out). */
  selection: z.string().max(AI_MAX_CONTENT_CHARS).optional(),
  /** A short brief for `draft`, which has no selection to work from. */
  instruction: z.string().max(500).optional(),
  tone: z.enum(AI_TONES).optional(),
  /** Surrounding document text, so a draft matches the piece it joins. */
  context: z.string().max(AI_MAX_CONTENT_CHARS).optional(),
  locale: z.string().max(10).optional(),
});

export const seoGenerationPayloadSchema = z.object({
  title: z.string().max(300),
  content: contentSchema,
  excerpt: z.string().max(2000).optional(),
  locale: z.string().max(10).optional(),
});

export const translationPayloadSchema = z.object({
  sourceLocale: z.string().min(2).max(10),
  targetLocale: z.string().min(2).max(10),
  /**
   * Named fields, never a Prisma row (ADR-097 #11). The builder sees exactly
   * what is here and nothing else.
   */
  fields: z.record(z.string().max(60), z.string().max(AI_MAX_CONTENT_CHARS)),
});

export const summarizationPayloadSchema = z.object({
  title: z.string().max(300),
  content: contentSchema,
  /** `excerpt` alone, `takeaways` alone, or both in one call. */
  want: z
    .array(z.enum(["excerpt", "takeaways"]))
    .min(1)
    .max(2),
  locale: z.string().max(10).optional(),
});

export const altTextPayloadSchema = z.object({
  /** Base64 of the stored bytes. `@repo/core` reads them; `@repo/ai` never does. */
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1).max(100),
  /** The filename, which is often the only hint about what the picture is for. */
  filename: z.string().max(255).optional(),
  locale: z.string().max(10).optional(),
});

export const quizGenerationPayloadSchema = z.object({
  lessonTitle: z.string().max(300),
  content: contentSchema,
  questionCount: z.number().int().min(1).max(20),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  locale: z.string().max(10).optional(),
});

export const AI_PAYLOAD_SCHEMAS = {
  writing_assistant: writingAssistantPayloadSchema,
  seo_generation: seoGenerationPayloadSchema,
  translation: translationPayloadSchema,
  summarization: summarizationPayloadSchema,
  alt_text: altTextPayloadSchema,
  quiz_generation: quizGenerationPayloadSchema,
} as const satisfies Record<AiFeatureKey, z.ZodType>;

export type AiPayload<K extends AiFeatureKey> = z.infer<(typeof AI_PAYLOAD_SCHEMAS)[K]>;

// ─── Outputs: what we accept back ────────────────────────────
//
// Every structured feature parses the model's answer with the COLUMN's own
// limits, so a bad generation fails the same way wherever it came from
// (ADR-086 #2's rule applied again).

export const seoSuggestionSchema = z.object({
  seoTitle: z.string().min(1).max(70),
  seoDescription: z.string().min(1).max(180),
  ogTitle: z.string().max(120).optional(),
  ogDescription: z.string().max(300).optional(),
  focusKeywords: z.array(z.string().min(1).max(60)).max(5).optional(),
});

export type SeoSuggestion = z.infer<typeof seoSuggestionSchema>;

export const summarySuggestionSchema = z.object({
  excerpt: z.string().max(500).optional(),
  /** 3–5 entries, each short enough to read at a glance. */
  keyTakeaways: z.array(z.string().min(1).max(160)).min(3).max(5).optional(),
});

export type SummarySuggestion = z.infer<typeof summarySuggestionSchema>;

/** One sentence for a screen-reader user. Capped well under the column's 500. */
export const altTextSuggestionSchema = z.object({
  altText: z.string().min(1).max(160),
});

export type AltTextSuggestion = z.infer<typeof altTextSuggestionSchema>;

export const translationSuggestionSchema = z.object({
  fields: z.record(z.string().max(60), z.string().max(AI_MAX_CONTENT_CHARS)),
});

export type TranslationSuggestion = z.infer<typeof translationSuggestionSchema>;

/**
 * A generated question set.
 *
 * `correctIndex` rather than a flag on each option, and the refinement below
 * is the one failure mode a generated quiz has that a hand-written one does
 * not: a correct answer that is not among its own options.
 */
export const generatedQuizQuestionSchema = z
  .object({
    prompt: z.string().min(1).max(500),
    options: z.array(z.string().min(1).max(300)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    explanation: z.string().max(600).optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: "The correct answer must be one of the options",
    path: ["correctIndex"],
  });

export const quizSuggestionSchema = z.object({
  questions: z.array(generatedQuizQuestionSchema).min(1).max(20),
});

export type QuizSuggestion = z.infer<typeof quizSuggestionSchema>;
export type GeneratedQuizQuestion = z.infer<typeof generatedQuizQuestionSchema>;

// ─── The run endpoint ────────────────────────────────────────

/**
 * What `POST /admin/api/ai/run` accepts.
 *
 * The payload is `unknown` here on purpose: the handler resolves the feature
 * first and then parses the payload with that feature's own schema, which is
 * what keeps one endpoint from needing a discriminated union that has to be
 * edited every time a feature lands.
 */
export const aiRunSchema = z.object({
  feature: z.enum(AI_FEATURE_KEYS as readonly [AiFeatureKey, ...AiFeatureKey[]]),
  payload: z.unknown(),
  entity: z.object({ type: z.string().min(1).max(40), id: z.string().min(1).max(40) }).optional(),
  stream: z.boolean().optional(),
});

export type AiRunInput = z.infer<typeof aiRunSchema>;

/**
 * How a STREAMED failure is signalled.
 *
 * A stream that has already started cannot change its status code, so the
 * taxonomy reason is appended to the body behind a control character (0x1F,
 * unit separator) that no model emits in prose. The client splits on it and
 * renders an error rather than showing the reason as if it were the
 * suggestion.
 *
 * Built with `fromCharCode` rather than written as an escape so no source file
 * in this repo contains a raw control byte — one did, briefly, and `grep`
 * called the file binary.
 */
export const AI_STREAM_ERROR_MARKER = String.fromCharCode(31);
export const AI_STREAM_ERROR_PREFIX = `${AI_STREAM_ERROR_MARKER}AI_ERROR:`;

// ─── Admin forms ─────────────────────────────────────────────

export const aiProviderSchema = z.object({
  id: z.string().max(40).nullish(),
  kind: z.enum(AI_PROVIDER_KINDS),
  label: z.string().min(1).max(80),
  baseUrl: z.url().max(255).nullish().or(z.literal("")),
  /**
   * Write-only (ADR-098). **Blank means unchanged, never erase** — the market
   * provider's contract, its caption and its integration test, copied.
   */
  apiKey: z.string().max(400).optional(),
  isEnabled: z.boolean(),
  isDefault: z.boolean(),
});

export type AiProviderSaveInput = z.infer<typeof aiProviderSchema>;

const priceSchema = z.number().min(0).max(10_000);

export const aiModelSchema = z.object({
  id: z.string().max(40).nullish(),
  providerId: z.string().min(1).max(40),
  modelId: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  inputPricePerMTok: priceSchema,
  outputPricePerMTok: priceSchema,
  cachedInputPricePerMTok: priceSchema.nullish(),
  maxOutputTokens: z.number().int().min(1).max(200_000),
  supportsVision: z.boolean(),
  supportsStream: z.boolean(),
  isEnabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
});

export type AiModelSaveInput = z.infer<typeof aiModelSchema>;

export const aiFeatureSchema = z.object({
  key: z.enum(AI_FEATURE_KEYS as readonly [AiFeatureKey, ...AiFeatureKey[]]),
  isEnabled: z.boolean(),
  providerId: z.string().max(40).nullish().or(z.literal("")),
  modelId: z.string().max(40).nullish().or(z.literal("")),
  maxOutputTokens: z.number().int().min(1).max(200_000).nullish(),
  /**
   * House style only, and hard-capped. An admin who can rewrite the whole
   * prompt is an admin who can turn the summariser into a general chatbot
   * billed to the company — behaviour, and behaviour is code (ADR-042).
   */
  extraInstructions: z.string().max(1000).nullish().or(z.literal("")),
});

export type AiFeatureSaveInput = z.infer<typeof aiFeatureSchema>;

export const aiLimitsSchema = z.object({
  enabled: z.boolean(),
  maxTokensPerRequest: z.number().int().min(1).max(200_000),
  /** `0` means unlimited, and the screen says so in words. */
  monthlyBudgetUsd: z.number().min(0).max(1_000_000),
  budgetWarnPercent: z.number().int().min(1).max(100),
  capBehavior: z.enum(AI_CAP_BEHAVIORS),
  rateLimitPerUserHour: z.number().int().min(1).max(100_000),
  modelLight: z.string().min(1).max(80),
  modelStandard: z.string().min(1).max(80),
  modelHeavy: z.string().min(1).max(80),
});

export type AiLimitsSaveInput = z.infer<typeof aiLimitsSchema>;

/** The usage screen's toolbar filters (ADR-044 #9). */
export const aiUsageFilterSchema = z.object({
  feature: z.string().max(40).nullish(),
  status: z.enum(AI_CALL_STATUSES).nullish(),
  userId: z.string().max(40).nullish(),
  range: z.enum(["day", "week", "month", "quarter", "year"]).nullish(),
});

export type AiUsageFilter = z.infer<typeof aiUsageFilterSchema>;
