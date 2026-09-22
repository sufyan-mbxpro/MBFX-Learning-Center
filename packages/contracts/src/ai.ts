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

export const AI_PROVIDER_KINDS = [
  "ANTHROPIC",
  "OPENAI",
  "GOOGLE",
  "XAI",
  "DEEPSEEK",
  "MISTRAL",
  "OPENROUTER",
  "OPENAI_COMPATIBLE",
  "ECHO",
] as const;
export type AiProviderKindValue = (typeof AI_PROVIDER_KINDS)[number];

// ─── Provider presets (ADR-120) ──────────────────────────────

/**
 * Which wire protocol a provider speaks. There are exactly two real ones, and
 * that is why a new vendor is a registry row rather than a driver: every
 * provider here except Anthropic serves the OpenAI Chat Completions shape.
 */
export type AiProviderProtocol = "anthropic" | "openai" | "echo";

export interface AiProviderPreset {
  readonly kind: AiProviderKindValue;
  /**
   * The NAME a provider row is created with when the setup screen connects one.
   * Stored data, like the seeded "Anthropic" row's label — an admin renames it
   * on the providers screen, and the setup screen's own labels are catalog keys.
   */
  readonly defaultLabel: string;
  readonly protocol: AiProviderProtocol;
  /**
   * The endpoint used when the row has no base URL of its own. `null` for the
   * two protocols whose SDK already knows its host, and for the custom kind,
   * which has no default by definition and REQUIRES one.
   */
  readonly defaultBaseUrl: string | null;
  readonly baseUrlRequired: boolean;
  /** What a key from this vendor starts with — a placeholder, never a validator. */
  readonly keyPlaceholder: string;
  /** Where an admin creates a key. Rendered as an external link. */
  readonly consoleUrl: string | null;
  /**
   * OpenAI's reasoning models reject `max_tokens`; most compatible gateways
   * only know `max_tokens`. A provider fact, so it is a column here rather
   * than a guess in the driver.
   */
  readonly maxTokensParam: "max_tokens" | "max_completion_tokens";
  /** Whether the gateway accepts `stream_options.include_usage`. */
  readonly streamUsageOption: boolean;
  /**
   * A path that REQUIRES the key, for a gateway whose model list is public.
   * Without it "Test connection" would pass on any string at all.
   */
  readonly keyCheckPath: string | null;
}

export const AI_PROVIDER_PRESETS: Readonly<Record<AiProviderKindValue, AiProviderPreset>> = {
  ANTHROPIC: {
    kind: "ANTHROPIC",
    defaultLabel: "Anthropic",
    protocol: "anthropic",
    defaultBaseUrl: null,
    baseUrlRequired: false,
    keyPlaceholder: "sk-ant-…",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    maxTokensParam: "max_tokens",
    streamUsageOption: false,
    keyCheckPath: null,
  },
  OPENAI: {
    kind: "OPENAI",
    defaultLabel: "OpenAI",
    protocol: "openai",
    defaultBaseUrl: null,
    baseUrlRequired: false,
    keyPlaceholder: "sk-…",
    consoleUrl: "https://platform.openai.com/api-keys",
    maxTokensParam: "max_completion_tokens",
    streamUsageOption: true,
    keyCheckPath: null,
  },
  GOOGLE: {
    kind: "GOOGLE",
    defaultLabel: "Google Gemini",
    protocol: "openai",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    baseUrlRequired: false,
    keyPlaceholder: "AIza…",
    consoleUrl: "https://aistudio.google.com/apikey",
    maxTokensParam: "max_tokens",
    streamUsageOption: true,
    keyCheckPath: null,
  },
  XAI: {
    kind: "XAI",
    defaultLabel: "xAI",
    protocol: "openai",
    defaultBaseUrl: "https://api.x.ai/v1",
    baseUrlRequired: false,
    keyPlaceholder: "xai-…",
    consoleUrl: "https://console.x.ai",
    maxTokensParam: "max_tokens",
    streamUsageOption: true,
    keyCheckPath: null,
  },
  DEEPSEEK: {
    kind: "DEEPSEEK",
    defaultLabel: "DeepSeek",
    protocol: "openai",
    defaultBaseUrl: "https://api.deepseek.com",
    baseUrlRequired: false,
    keyPlaceholder: "sk-…",
    consoleUrl: "https://platform.deepseek.com/api_keys",
    maxTokensParam: "max_tokens",
    streamUsageOption: true,
    keyCheckPath: null,
  },
  MISTRAL: {
    kind: "MISTRAL",
    defaultLabel: "Mistral",
    protocol: "openai",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    baseUrlRequired: false,
    keyPlaceholder: "",
    consoleUrl: "https://console.mistral.ai/api-keys",
    maxTokensParam: "max_tokens",
    // Mistral reports usage on the final chunk unasked and validates request
    // fields strictly, so the option is left out rather than risked.
    streamUsageOption: false,
    keyCheckPath: null,
  },
  OPENROUTER: {
    kind: "OPENROUTER",
    defaultLabel: "OpenRouter",
    protocol: "openai",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    baseUrlRequired: false,
    keyPlaceholder: "sk-or-…",
    consoleUrl: "https://openrouter.ai/keys",
    maxTokensParam: "max_tokens",
    streamUsageOption: true,
    // `/models` answers without a key, so it proves nothing about one.
    keyCheckPath: "/key",
  },
  OPENAI_COMPATIBLE: {
    kind: "OPENAI_COMPATIBLE",
    defaultLabel: "OpenAI-compatible",
    protocol: "openai",
    defaultBaseUrl: null,
    baseUrlRequired: true,
    keyPlaceholder: "",
    consoleUrl: null,
    maxTokensParam: "max_tokens",
    streamUsageOption: true,
    keyCheckPath: null,
  },
  ECHO: {
    kind: "ECHO",
    defaultLabel: "Echo (no provider)",
    protocol: "echo",
    defaultBaseUrl: null,
    baseUrlRequired: false,
    keyPlaceholder: "",
    consoleUrl: null,
    maxTokensParam: "max_tokens",
    streamUsageOption: false,
    keyCheckPath: null,
  },
};

export function aiProviderPreset(kind: AiProviderKindValue): AiProviderPreset {
  return AI_PROVIDER_PRESETS[kind];
}

/**
 * A model as the provider's own list describes it — the "Test connection"
 * result. Every field past the id is nullable because most providers publish
 * nothing past the id; a missing price is left for the admin, never invented.
 */
export interface AiDiscoveredModel {
  modelId: string;
  label: string;
  maxOutputTokens: number | null;
  supportsVision: boolean | null;
  /** USD per 1M tokens, when the provider's list publishes it (OpenRouter does). */
  inputPricePerMTok: number | null;
  outputPricePerMTok: number | null;
}

export const AI_CALL_STATUSES = ["OK", "FAILED", "ABORTED", "REFUSED"] as const;
export type AiCallStatusValue = (typeof AI_CALL_STATUSES)[number];

/** What the cap does when it is reached (§7.3). */
export const AI_CAP_BEHAVIORS = ["DISABLE", "NOTIFY_ONLY"] as const;
export type AiCapBehavior = (typeof AI_CAP_BEHAVIORS)[number];

// ─── The feature registry ────────────────────────────────────

/** Where the affordance lives, which is what the features screen names. */
/** `global` is ADR-129's: a panel on every admin page, bound to no field. */
export type AiFeatureSurface = "editor" | "media" | "global";

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
  // ADR-126. One key for every editor, for the writing assistant's reason: an
  // admin thinks of "generate with AI" as one tool with one switch. The payload
  // names the module, and the run route gates on THAT module's content key.
  {
    key: "form_fill",
    surface: "editor",
    streams: false,
    modelRole: "standard",
    effort: "medium",
    vision: false,
    // A lesson body plus SEO plus objectives, as JSON. Still clamped by
    // `ai.maxTokensPerRequest`, which is seeded at 2000 and must be raised.
    maxOutputTokens: 8000,
    entity: "any",
  },
  // ADR-129. Its own key rather than more `writing_assistant` actions: the
  // assistant works on text inside an editor its user can save, while the
  // studio takes ANY text from anyone holding `ai.use` — the nearer of the two
  // to a general chatbot, so an admin must be able to switch it off alone and
  // see its spend on its own line. Tier and effort are per ACTION below.
  {
    key: "writing_studio",
    surface: "global",
    streams: true,
    modelRole: "standard",
    effort: "medium",
    vision: false,
    maxOutputTokens: 4000,
    entity: "none",
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

// ─── The writing studio (ADR-129) ────────────────────────────

/**
 * What the studio does. `needsText` is false for the two that can start from a
 * topic alone; every other action works on text the admin supplies.
 *
 * No action is `heavy`: a studio result is a suggestion copied out by hand, and
 * tidying a tweet should not move the cost dial drafting an article does.
 */
export interface AiStudioActionDefinition {
  readonly key: string;
  readonly modelRole: AiModelRole;
  readonly effort: AiEffort;
  readonly fromTopic: boolean;
}

export const AI_STUDIO_ACTIONS = [
  { key: "draft", modelRole: "standard", effort: "medium", fromTopic: true },
  { key: "headlines", modelRole: "standard", effort: "medium", fromTopic: true },
  { key: "rewrite", modelRole: "standard", effort: "medium", fromTopic: false },
  { key: "paraphrase", modelRole: "standard", effort: "medium", fromTopic: false },
  { key: "fix_grammar", modelRole: "light", effort: "low", fromTopic: false },
  { key: "expand", modelRole: "standard", effort: "medium", fromTopic: false },
  { key: "shorten", modelRole: "standard", effort: "medium", fromTopic: false },
  { key: "summarize", modelRole: "standard", effort: "medium", fromTopic: false },
] as const satisfies readonly AiStudioActionDefinition[];

export type AiStudioAction = (typeof AI_STUDIO_ACTIONS)[number]["key"];

export const AI_STUDIO_ACTION_KEYS = AI_STUDIO_ACTIONS.map(
  (a) => a.key,
) as readonly AiStudioAction[];

/** The assistant's four, plus four more. Closed, for `AI_TONES`'s reason. */
export const AI_STUDIO_TONES = [
  ...AI_TONES,
  "formal",
  "casual",
  "persuasive",
  "educational",
] as const;
export type AiStudioTone = (typeof AI_STUDIO_TONES)[number];

export const AI_STUDIO_FORMATS = ["paragraphs", "bullets", "single_line"] as const;
export type AiStudioFormat = (typeof AI_STUDIO_FORMATS)[number];

export const AI_STUDIO_LENGTH_UNITS = ["characters", "words"] as const;
export type AiStudioLengthUnit = (typeof AI_STUDIO_LENGTH_UNITS)[number];

/** Common targets, one click each. Custom covers everything else. */
export const AI_STUDIO_LENGTH_PRESETS = [
  { key: "tweet", unit: "characters", target: 280 },
  { key: "seo_title", unit: "characters", target: 60 },
  { key: "meta_description", unit: "characters", target: 160 },
  { key: "excerpt", unit: "characters", target: 300 },
  { key: "short_paragraph", unit: "words", target: 100 },
] as const satisfies ReadonlyArray<{ key: string; unit: AiStudioLengthUnit; target: number }>;

export type AiStudioLengthPreset = (typeof AI_STUDIO_LENGTH_PRESETS)[number]["key"];

/**
 * How much a draft should say. Words, not a count: a whole-form draft fills
 * several fields at once and each has its own column limit, so a number could
 * only ever describe the long-form field — and would read as a promise.
 * Declared above the payload schemas that use it (module-level `const`).
 */
export const AI_FILL_LENGTHS = ["brief", "standard", "in_depth"] as const;
export type AiFillLength = (typeof AI_FILL_LENGTHS)[number];

/** Who a draft is written for. The same three levels the content carries. */
export const AI_FILL_AUDIENCES = ["beginner", "intermediate", "advanced"] as const;

/**
 * A draft's word target, as the assistant panel offers it: pre-filled with the
 * default, editable. The ceiling keeps a draft inside the seeded
 * `ai.maxTokensPerRequest` (2000 tokens ≈ 1500 English words).
 */
export const AI_DRAFT_WORDS_DEFAULT = 300;
export const AI_DRAFT_WORDS_MIN = 20;
export const AI_DRAFT_WORDS_MAX = 1500;
export type AiFillAudience = (typeof AI_FILL_AUDIENCES)[number];

/** A topic or a pasted passage, never a document. */
export const AI_STUDIO_INPUT_MAX = 10_000;
/** The largest target a person can set: about four pages of words. */
export const AI_STUDIO_TARGET_MAX = 10_000;

// ─── Payloads: what each feature is given ────────────────────

/** The longest authored text any builder will accept, in characters. */
export const AI_MAX_CONTENT_CHARS = 60_000;

const contentSchema = z.string().min(1).max(AI_MAX_CONTENT_CHARS);

export const writingAssistantPayloadSchema = z.object({
  action: z.enum(AI_ASSISTANT_ACTION_KEYS as readonly [AiAssistantAction, ...AiAssistantAction[]]),
  /** The selection, as PLAIN TEXT (ADR-097 — text in, text out). */
  selection: z.string().max(AI_MAX_CONTENT_CHARS).optional(),
  /** A brief for `draft`, which has no selection to work from. */
  instruction: z.string().max(2000).optional(),
  /**
   * `change_tone` offers the assistant's four; the draft dialog offers the
   * studio's eight, a superset, so one enum accepts both.
   */
  tone: z.enum(AI_STUDIO_TONES).optional(),
  /** `draft` only: the dialog's steering. Ignored by every other action. */
  audience: z.enum(AI_FILL_AUDIENCES).optional(),
  length: z.enum(AI_FILL_LENGTHS).optional(),
  format: z.enum(AI_STUDIO_FORMATS).optional(),
  /** `draft` only: a word target. Wins over `length` when both are sent. */
  wordCount: z.number().int().min(AI_DRAFT_WORDS_MIN).max(AI_DRAFT_WORDS_MAX).optional(),
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

// ─── Form fill (ADR-126) ─────────────────────────────────────

/** The editors a brief can fill. The permission row per module lives in the run route. */
export const AI_FILL_MODULES = [
  "article",
  "course",
  "lesson",
  "video_topic",
  "quiz",
  "glossary_term",
  "glossary_topic",
  "tool",
] as const;

export type AiFillModule = (typeof AI_FILL_MODULES)[number];

/**
 * What a field IS, which decides both the JSON shape the model is asked for
 * and the control the review dialog previews it in.
 *
 * - `text` / `textarea` — a string, capped at `max`.
 * - `rich` — structured blocks (never HTML); `aiBlocksToHtml` writes the markup.
 * - `list` — strings, each capped at `max`, at most `maxItems`.
 * - `faq` — `{ question, answer }` pairs, answers plain text.
 * - `questions` — generated quiz questions (`generatedQuizQuestionSchema`).
 */
export type AiFillFieldKind = "text" | "textarea" | "rich" | "list" | "faq" | "questions";

export interface AiFillFieldDefinition {
  readonly key: string;
  readonly kind: AiFillFieldKind;
  /** Characters for a string; per-item characters for a `list`. */
  readonly max?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  /** One line telling the model what the field is FOR. English, code-owned. */
  readonly purpose: string;
}

/**
 * The fields AI may fill, per module, with the COLUMN's own limits (ADR-126 §2).
 *
 * The output schemas, the prompt's JSON description and the review dialog's
 * rows are all derived from this, so the three cannot drift. What is absent is
 * absent on purpose: no URL, image, slug, category, track, difficulty or status
 * — a model inventing a video URL is the SSRF-shaped input security.md #9
 * refuses, and a slug change writes a redirect.
 */
export const AI_FILL_FIELDS = {
  article: [
    { key: "title", kind: "text", max: 255, purpose: "the headline" },
    { key: "excerpt", kind: "textarea", max: 500, purpose: "a one- or two-sentence standfirst" },
    { key: "body", kind: "rich", purpose: "the full article" },
    { key: "seoTitle", kind: "text", max: 70, purpose: "the search-result title" },
    { key: "seoDescription", kind: "textarea", max: 180, purpose: "the meta description" },
    {
      key: "focusKeywords",
      kind: "list",
      max: 60,
      maxItems: 5,
      purpose: "search keywords the article targets",
    },
    { key: "ogTitle", kind: "text", max: 120, purpose: "the social-share title" },
    { key: "ogDescription", kind: "textarea", max: 300, purpose: "the social-share description" },
    { key: "faq", kind: "faq", maxItems: 8, purpose: "questions a reader would ask, answered" },
    {
      key: "keyTakeaways",
      kind: "list",
      max: 160,
      minItems: 3,
      maxItems: 5,
      purpose: "the points a reader should leave with",
    },
  ],
  course: [
    { key: "title", kind: "text", max: 255, purpose: "the course name" },
    { key: "summary", kind: "textarea", max: 1000, purpose: "a short summary for course cards" },
    { key: "description", kind: "rich", purpose: "what the course covers and who it is for" },
    { key: "seoTitle", kind: "text", max: 70, purpose: "the search-result title" },
    { key: "seoDescription", kind: "textarea", max: 180, purpose: "the meta description" },
    { key: "seoFocusKeyword", kind: "text", max: 100, purpose: "the one search phrase targeted" },
  ],
  lesson: [
    { key: "title", kind: "text", max: 255, purpose: "the lesson name" },
    { key: "summary", kind: "textarea", max: 1000, purpose: "a short summary of the lesson" },
    { key: "content", kind: "rich", purpose: "the full lesson a learner reads" },
    {
      key: "learningObjectives",
      kind: "list",
      max: 300,
      maxItems: 8,
      purpose: "what the learner can do after the lesson, each starting with a verb",
    },
    { key: "seoTitle", kind: "text", max: 70, purpose: "the search-result title" },
    { key: "seoDescription", kind: "textarea", max: 180, purpose: "the meta description" },
    { key: "seoFocusKeyword", kind: "text", max: 100, purpose: "the one search phrase targeted" },
  ],
  video_topic: [
    { key: "title", kind: "text", max: 255, purpose: "the video topic name" },
    { key: "summary", kind: "textarea", max: 1000, purpose: "a short summary of the topic" },
    { key: "content", kind: "rich", purpose: "the written guide shown beside the videos" },
    { key: "seoTitle", kind: "text", max: 70, purpose: "the search-result title" },
    { key: "seoDescription", kind: "textarea", max: 180, purpose: "the meta description" },
    { key: "seoFocusKeyword", kind: "text", max: 100, purpose: "the one search phrase targeted" },
  ],
  quiz: [
    { key: "title", kind: "text", max: 255, purpose: "the quiz name" },
    {
      key: "description",
      kind: "textarea",
      max: 2000,
      purpose: "what the quiz tests, shown before it starts",
    },
    { key: "questions", kind: "questions", maxItems: 20, purpose: "the quiz questions" },
  ],
  glossary_term: [
    { key: "term", kind: "text", max: 150, purpose: "the term being defined" },
    // ONE body since changes-46 #1: the editor writes the whole explanation to
    // this column and retires the other three prose columns, so the model is
    // asked for the whole thing, in the order the term page reads.
    {
      key: "simpleExplanation",
      kind: "rich",
      purpose:
        "the full explanation: open with a plain-language definition in one or two sentences, then sections for a fuller explanation, nuance for an experienced trader and a worked, clearly hypothetical example",
    },
    { key: "faq", kind: "faq", maxItems: 8, purpose: "common questions about the term, answered" },
    { key: "seoTitle", kind: "text", max: 70, purpose: "the search-result title" },
    { key: "seoDescription", kind: "textarea", max: 180, purpose: "the meta description" },
  ],
  glossary_topic: [
    { key: "name", kind: "text", max: 100, purpose: "the topic name" },
    { key: "description", kind: "rich", purpose: "what the topic groups together" },
    { key: "seoTitle", kind: "text", max: 70, purpose: "the search-result title" },
    { key: "seoDescription", kind: "textarea", max: 180, purpose: "the meta description" },
    {
      key: "seoKeywords",
      kind: "text",
      max: 255,
      purpose: "comma-separated search keywords",
    },
  ],
  // The words AROUND a calculator, never its behaviour: `config` (defaults,
  // limits, instrument lists) is configuration an admin sets, and highlights
  // carry a glyph from a closed list (ADR-114 #3), so neither is prose to draft.
  tool: [
    { key: "title", kind: "text", max: 160, purpose: "the tool's page title" },
    {
      key: "tagline",
      kind: "textarea",
      max: 220,
      purpose: "one sentence under the title saying what the tool does",
    },
    {
      key: "intro",
      kind: "rich",
      purpose:
        "a short introduction shown beside the calculator: what it answers and when to use it",
    },
    {
      key: "body",
      kind: "rich",
      purpose:
        "the explainer below the calculator: the concepts behind it, how to read its result, a worked hypothetical example",
    },
    {
      key: "faq",
      kind: "faq",
      maxItems: 8,
      purpose: "questions a user of the tool would ask, answered",
    },
    { key: "seoTitle", kind: "text", max: 70, purpose: "the search-result title" },
    { key: "seoDescription", kind: "textarea", max: 180, purpose: "the meta description" },
    { key: "seoFocusKeyword", kind: "text", max: 100, purpose: "the one search phrase targeted" },
  ],
} as const satisfies Record<AiFillModule, readonly AiFillFieldDefinition[]>;

export function aiFillField(module: AiFillModule, key: string): AiFillFieldDefinition | undefined {
  return (AI_FILL_FIELDS[module] as readonly AiFillFieldDefinition[]).find((f) => f.key === key);
}

/** The four things a field's ✨ menu does. */
export const AI_FIELD_ACTIONS = ["regenerate", "improve", "shorten", "expand"] as const;
export type AiFieldAction = (typeof AI_FIELD_ACTIONS)[number];

/** A brief is a paragraph, not a document. */
export const AI_FILL_BRIEF_MAX = 2000;

/**
 * The editor's current text, keyed by field. Plain text: rich fields are sent
 * through `htmlToText`-style extraction on the client, never as markup.
 */
const fillContextSchema = z
  .record(z.string().max(60), z.string().max(20_000))
  .refine((value) => Object.values(value).join("").length <= AI_MAX_CONTENT_CHARS, {
    message: "Context is too large",
  });

const fillModuleSchema = z.enum(AI_FILL_MODULES);

export const formFillPayloadSchema = z
  .discriminatedUnion("mode", [
    z.object({
      mode: z.literal("form"),
      module: fillModuleSchema,
      brief: z.string().trim().min(1).max(AI_FILL_BRIEF_MAX),
      context: fillContextSchema.optional(),
      /** Quizzes only: how many questions to write. */
      questionCount: z.number().int().min(1).max(20).optional(),
      /** The studio's closed list; absent means the house default. */
      tone: z.enum(AI_STUDIO_TONES).optional(),
      length: z.enum(AI_FILL_LENGTHS).optional(),
      audience: z.enum(AI_FILL_AUDIENCES).optional(),
      locale: z.string().max(10).optional(),
    }),
    z.object({
      mode: z.literal("field"),
      module: fillModuleSchema,
      field: z.string().min(1).max(60),
      action: z.enum(AI_FIELD_ACTIONS),
      /** The field's current value, as plain text. Empty for `regenerate` on a blank field. */
      current: z.string().max(AI_MAX_CONTENT_CHARS),
      brief: z.string().trim().max(AI_FILL_BRIEF_MAX).optional(),
      context: fillContextSchema.optional(),
      locale: z.string().max(10).optional(),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.mode !== "field") return;
    const field = aiFillField(value.module, value.field);
    // Only single-value text fields have a ✨ menu; lists, FAQs and questions
    // are regenerated through the whole-form brief.
    if (!field || !["text", "textarea", "rich"].includes(field.kind)) {
      ctx.addIssue({ code: "custom", path: ["field"], message: "not_fillable" });
    }
  });

export const writingStudioPayloadSchema = z.object({
  action: z.enum(AI_STUDIO_ACTION_KEYS as readonly [AiStudioAction, ...AiStudioAction[]]),
  /** The topic (for `draft`/`headlines`) or the passage to work on. Plain text. */
  text: z.string().trim().min(1).max(AI_STUDIO_INPUT_MAX),
  tone: z.enum(AI_STUDIO_TONES).optional(),
  format: z.enum(AI_STUDIO_FORMATS).optional(),
  /** A request, not a limit the output is rejected on (ADR-129 §3). */
  length: z
    .object({
      unit: z.enum(AI_STUDIO_LENGTH_UNITS),
      target: z.number().int().min(1).max(AI_STUDIO_TARGET_MAX),
    })
    .optional(),
  locale: z.string().max(10).optional(),
});

export const AI_PAYLOAD_SCHEMAS = {
  writing_assistant: writingAssistantPayloadSchema,
  seo_generation: seoGenerationPayloadSchema,
  translation: translationPayloadSchema,
  summarization: summarizationPayloadSchema,
  alt_text: altTextPayloadSchema,
  quiz_generation: quizGenerationPayloadSchema,
  form_fill: formFillPayloadSchema,
  writing_studio: writingStudioPayloadSchema,
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

/**
 * Formatted text WITHOUT markup (ADR-126 §3).
 *
 * A model never writes HTML here: it returns blocks, and `aiBlocksToHtml`
 * (`@repo/utils`) escapes every character and emits only tags the sanitizer
 * already allows with no attribute. Inline emphasis is `**bold**` and
 * `*italic*`, and nothing else is interpreted.
 */
export const aiRichBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().min(1).max(200),
  }),
  z.object({ type: z.literal("paragraph"), text: z.string().min(1).max(4000) }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean(),
    items: z.array(z.string().min(1).max(600)).min(1).max(20),
  }),
  z.object({ type: z.literal("quote"), text: z.string().min(1).max(1000) }),
]);

export type AiRichBlock = z.infer<typeof aiRichBlockSchema>;

export const aiRichTextSchema = z.array(aiRichBlockSchema).min(1).max(80);

export const aiFaqItemSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
});

/** The schema one field's generated value is parsed with, from its definition. */
export function aiFillValueSchema(field: AiFillFieldDefinition): z.ZodType {
  switch (field.kind) {
    case "text":
    case "textarea":
      return z
        .string()
        .trim()
        .min(1)
        .max(field.max ?? 255);
    case "rich":
      return aiRichTextSchema;
    case "list":
      return z
        .array(
          z
            .string()
            .trim()
            .min(1)
            .max(field.max ?? 300),
        )
        .min(field.minItems ?? 1)
        .max(field.maxItems ?? 10);
    case "faq":
      return z
        .array(aiFaqItemSchema)
        .min(1)
        .max(field.maxItems ?? 8);
    case "questions":
      return z
        .array(generatedQuizQuestionSchema)
        .min(1)
        .max(field.maxItems ?? 20);
  }
}

/**
 * What a `form` generation must look like for one module: every field
 * OPTIONAL (a model that has nothing honest to say about FAQs omits them) but
 * never empty, and every value at the column's own limit. Unknown keys are
 * stripped, so a model that invents a `slug` contributes nothing.
 */
export function aiFormSuggestionSchema(module: AiFillModule) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of AI_FILL_FIELDS[module] as readonly AiFillFieldDefinition[]) {
    shape[field.key] = aiFillValueSchema(field).optional();
  }
  return z.object(shape).refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "The suggestion is empty",
  });
}

/** What a `field` generation must look like: `{ "value": … }` in that field's own shape. */
export function aiFieldSuggestionSchema(field: AiFillFieldDefinition) {
  return z.object({ value: aiFillValueSchema(field) });
}

/** A form suggestion after parsing: field key → a value in that field's kind. */
export type AiFormSuggestion = Record<
  string,
  | string
  | string[]
  | AiRichBlock[]
  | Array<z.infer<typeof aiFaqItemSchema>>
  | GeneratedQuizQuestion[]
>;

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

export const aiProviderSchema = z
  .object({
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
  })
  .superRefine((value, ctx) => {
    // The custom gateway has no endpoint of its own (ADR-120).
    if (AI_PROVIDER_PRESETS[value.kind].baseUrlRequired && !value.baseUrl) {
      ctx.addIssue({ code: "custom", path: ["baseUrl"], message: "required" });
    }
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

// ─── Guided setup (ADR-120) ──────────────────────────────────

/**
 * An endpoint must be there for the custom kind, and nowhere else: every other
 * preset carries its own, and a blank field means "use it".
 */
function requireBaseUrl(
  value: { kind: AiProviderKindValue; baseUrl?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (AI_PROVIDER_PRESETS[value.kind].baseUrlRequired && !value.baseUrl) {
    ctx.addIssue({ code: "custom", path: ["baseUrl"], message: "required" });
  }
}

/** "Test connection" on the setup screen, which also lists the models. */
export const aiConnectionTestSchema = z
  .object({
    providerId: z.string().max(40).nullish(),
    kind: z.enum(AI_PROVIDER_KINDS),
    baseUrl: z.url().max(255).nullish().or(z.literal("")),
    apiKey: z.string().max(400).optional(),
  })
  .superRefine(requireBaseUrl);

export type AiConnectionTestInput = z.infer<typeof aiConnectionTestSchema>;

export const aiSetupModelSchema = z.object({
  modelId: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  // Optional: connecting a provider does not ask for a price. Absent keeps the
  // stored price (or starts at 0); prices are edited on Settings → AI → Providers.
  inputPricePerMTok: priceSchema.nullish(),
  outputPricePerMTok: priceSchema.nullish(),
  cachedInputPricePerMTok: priceSchema.nullish(),
  maxOutputTokens: z.number().int().min(1).max(200_000),
  supportsVision: z.boolean(),
});

export type AiSetupModelInput = z.infer<typeof aiSetupModelSchema>;

/**
 * One save for the whole connection: provider, key, the models it offers and
 * the three tiers. The provider becomes enabled and the default — that is what
 * "connect" means on this screen; the Providers tab stays the place for a
 * second provider that is NOT the default.
 */
export const aiSetupSchema = z
  .object({
    providerId: z.string().max(40).nullish(),
    kind: z.enum(AI_PROVIDER_KINDS),
    baseUrl: z.url().max(255).nullish().or(z.literal("")),
    /** Blank means unchanged — the same write-only contract as `aiProviderSchema`. */
    apiKey: z.string().max(400).optional(),
    models: z.array(aiSetupModelSchema).max(500),
    tiers: z.object({
      light: z.string().max(80),
      standard: z.string().max(80),
      heavy: z.string().max(80),
    }),
  })
  .superRefine((value, ctx) => {
    requireBaseUrl(value, ctx);
    // Echo has one placeholder model and falls through the tiers by design.
    if (value.kind === "ECHO") return;

    if (value.models.length === 0) {
      ctx.addIssue({ code: "custom", path: ["models"], message: "required" });
    }
    const ids = new Set<string>();
    value.models.forEach((model, index) => {
      if (ids.has(model.modelId)) {
        ctx.addIssue({ code: "custom", path: ["models", index, "modelId"], message: "duplicate" });
      }
      ids.add(model.modelId);
    });
    for (const role of AI_MODEL_ROLES) {
      const tier = value.tiers[role];
      if (!tier) {
        ctx.addIssue({ code: "custom", path: ["tiers", role], message: "required" });
      } else if (!ids.has(tier)) {
        // A tier naming a model this save does not enable would fall through
        // to the default provider's first model — silently, which is the one
        // way a tier choice must never fail.
        ctx.addIssue({ code: "custom", path: ["tiers", role], message: "not_selected" });
      }
    }
  });

export type AiSetupSaveInput = z.infer<typeof aiSetupSchema>;

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

/** The setup screen's usage section: the limits without the tiers, which it sets with the models. */
export const aiUsageLimitsSchema = aiLimitsSchema.omit({
  modelLight: true,
  modelStandard: true,
  modelHeavy: true,
});

export type AiUsageLimitsSaveInput = z.infer<typeof aiUsageLimitsSchema>;

/** The usage screen's toolbar filters (ADR-044 #9). */
export const aiUsageFilterSchema = z.object({
  feature: z.string().max(40).nullish(),
  status: z.enum(AI_CALL_STATUSES).nullish(),
  userId: z.string().max(40).nullish(),
  range: z.enum(["day", "week", "month", "quarter", "year"]).nullish(),
});

export type AiUsageFilter = z.infer<typeof aiUsageFilterSchema>;
