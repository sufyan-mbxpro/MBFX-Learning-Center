// Glossary contracts (ADR-069, changes-17 PR 1).
//
// Every glossary server action parses its input through these before any
// service call — "parse, don't spread" (security.md #6). `faq` matters most:
// it is the one `Json?` column on the translation row, so a raw cast there is
// invisible until something reads it back and finds an array of nulls.
import { z } from "zod";

import { glossaryTrackSchema } from "./learn.ts";

/** Mirrors `articleFaqItemSchema` deliberately — same shape, same caps. */
export const glossaryFaqItemSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(5000),
});
export type GlossaryFaqItemInput = z.infer<typeof glossaryFaqItemSchema>;

/**
 * The cap is per-term, not per-locale: a term with more than this many
 * questions is an article wearing a glossary entry's clothes.
 */
export const GLOSSARY_FAQ_MAX = 12;

export const glossaryFaqSchema = z.array(glossaryFaqItemSchema).max(GLOSSARY_FAQ_MAX);

/** `Difficulty` in the Prisma schema. Kept literal here so contracts stays free of @repo/db. */
export const glossaryDifficultySchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export type GlossaryDifficultyInput = z.infer<typeof glossaryDifficultySchema>;

// `glossaryTrackSchema` (a track key, or null) lives in ./learn.ts next to
// `quizTrackSchema`, because the two exist to be READ TOGETHER: a quiz track is
// required, a glossary track is nullable, and the comment explaining the
// difference belongs between them. Imported here, not re-exported — one
// barrel export of a name is enough.

/** Term-level fields — the ones on `GlossaryTerm` rather than its translations. */
export const glossaryTermMetaSchema = z.object({
  /** Null means UNFILED: the term is in the A–Z but under no topic. */
  topicId: z.string().min(1).max(64).nullable().optional(),
  track: glossaryTrackSchema.optional(),
  difficulty: glossaryDifficultySchema.optional(),
  /** Plain text, rendered in a `<code>`-ish block. Not rich text — it is a formula. */
  formula: z.string().trim().max(500).nullable().optional(),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^(\/|https?:\/\/)/, "must be a path or URL")
    .nullable()
    .optional(),
});
export type GlossaryTermMetaInput = z.infer<typeof glossaryTermMetaSchema>;

/**
 * One locale's translation. The four prose fields are rich text and are
 * sanitized server-side on save — per field, never once over a join
 * (security.md #8).
 *
 * `simpleExplanation` is the only required body: it is what the A–Z list
 * renders inline and what the term-of-the-day card quotes, so a term without
 * one has nothing to show anywhere but its own page.
 */
export const saveGlossaryTranslationSchema = z.object({
  locale: z.string().min(2).max(10),
  term: z.string().trim().min(1).max(150),
  slug: z.string().trim().max(150).optional(),
  simpleExplanation: z.string().min(1).max(20_000),
  detailedExplanation: z.string().max(200_000).nullable().optional(),
  advancedExplanation: z.string().max(200_000).nullable().optional(),
  exampleScenario: z.string().max(20_000).nullable().optional(),
  faq: glossaryFaqSchema.optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
});
export type SaveGlossaryTranslationPayload = z.infer<typeof saveGlossaryTranslationSchema>;

/**
 * The editor's one save (ADR-069 §1). Meta and translation together so the
 * service commits both in ONE transaction — a term whose topic saved but whose
 * body did not is the state this shape exists to make unreachable.
 */
export const saveGlossaryTermSchema = z.object({
  termId: z.string().min(1).max(64),
  meta: glossaryTermMetaSchema,
  translation: saveGlossaryTranslationSchema,
});
export type SaveGlossaryTermInput = z.infer<typeof saveGlossaryTermSchema>;

/** The "New term" dialog. Both fields optional — a blank term is legal and starts DRAFT. */
export const createGlossaryTermSchema = z.object({
  topicId: z.string().min(1).max(64).nullable().optional(),
  track: glossaryTrackSchema.optional(),
});
export type CreateGlossaryTermInput = z.infer<typeof createGlossaryTermSchema>;

// ─── Topics (changes-18 PR 3) ────────────────────────────────
//
// A topic used to be five fields edited inline in a table row, so its only
// contract was the action's own inline parse. It is now a page with an editor,
// a rich-text description and SEO fields, which is the same shape the term
// above already has — so it gets the same treatment: one schema covering the
// topic row and one locale's translation, committed together.

/** Topic-level fields — the ones on `GlossaryTopic` itself. */
export const glossaryTopicMetaSchema = z.object({
  /**
   * A topic is TAXONOMY, not content, so it has `isActive` rather than the
   * seven-state machine (changes-18 §2 D2). The screen says Published/Draft;
   * this is the boolean underneath.
   */
  isActive: z.boolean().optional(),
});
export type GlossaryTopicMetaInput = z.infer<typeof glossaryTopicMetaSchema>;

/**
 * One locale's topic translation.
 *
 * `description` is rich text and is sanitized server-side on save. It is the
 * ONLY rich field here: a name is a name, and SEO fields are metadata that
 * must reach a `<meta>` tag as plain text.
 */
export const saveGlossaryTopicTranslationSchema = z.object({
  locale: z.string().min(2).max(10),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(150).optional(),
  description: z.string().max(50_000).nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
  /** Comma-separated, as the meta tag itself is. Stored as typed. */
  seoKeywords: z.string().trim().max(255).nullable().optional(),
});
export type SaveGlossaryTopicTranslationPayload = z.infer<
  typeof saveGlossaryTopicTranslationSchema
>;

/** The topic editor's one save — meta and translation in one transaction. */
export const saveGlossaryTopicSchema = z.object({
  topicId: z.string().min(1).max(64),
  meta: glossaryTopicMetaSchema,
  translation: saveGlossaryTopicTranslationSchema,
});
export type SaveGlossaryTopicInput = z.infer<typeof saveGlossaryTopicSchema>;

/**
 * The "New topic" dialog, and the inline "create topic" the term editor offers
 * (changes-18 PR 4). Name only: everything else has a default, and a dialog
 * that demands SEO copy before a topic can exist is a dialog editors work
 * around.
 */
export const createGlossaryTopicSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type CreateGlossaryTopicInput = z.infer<typeof createGlossaryTopicSchema>;
