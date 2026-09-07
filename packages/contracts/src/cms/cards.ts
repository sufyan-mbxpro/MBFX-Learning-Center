// CardTemplate contracts (ADR-023) — referenced by id from `collection`/
// `featured-content` blocks, never copied: editing one updates every
// placement. `variant` picks the `@repo/ui`-composition code path (a
// code-owned floor, ADR-023's own "Alternatives" reasoning); `config`
// customises within that variant — which fields show, in what order, image
// ratio, excerpt length — never colours/spacing/arbitrary classes
// (ADR-024). `config.version` + a migration map is the same versioned-
// migration discipline blocks already use, named ahead of need in
// ADR-023's Consequences.
import { z } from "zod";

export const cardVariantSchema = z.enum(["standard", "featured", "compact", "horizontal"]);
export type CardVariant = z.infer<typeof cardVariantSchema>;

export const cardFieldSchema = z.enum(["image", "category", "title", "excerpt", "date", "author"]);
export type CardField = z.infer<typeof cardFieldSchema>;

export const cardConfigSchema = z.object({
  version: z.int().min(1).default(1),
  /** Which fields render, in this order — a field absent here never shows, regardless of whether the underlying `CollectionItem` has it. */
  fields: z
    .array(cardFieldSchema)
    .min(1)
    .max(cardFieldSchema.options.length)
    .default(["image", "category", "title", "excerpt", "date"]),
  imageAspectRatio: z.enum(["square", "video", "portrait"]).default("video"),
  /** Characters, not words — matches `article-list.tsx`'s existing `line-clamp` posture closely enough without a second truncation convention. 0 = no cap. */
  excerptLength: z.int().min(0).max(500).default(160),
  ctaLabelKey: z.string().trim().min(1).max(120).optional(),
});
export type CardConfig = z.infer<typeof cardConfigSchema>;

export const cardTemplateKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/, 'lower-case, hyphenated ("modern-news-card")');

export const createCardTemplateSchema = z.object({
  key: cardTemplateKeySchema,
  name: z.string().trim().min(1).max(120),
  contentType: z.string().trim().min(1).max(60).optional(),
  variant: cardVariantSchema,
  config: cardConfigSchema,
});
export type CreateCardTemplateInput = z.infer<typeof createCardTemplateSchema>;

export const updateCardTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  contentType: z.string().trim().min(1).max(60).optional(),
  variant: cardVariantSchema.optional(),
  config: cardConfigSchema.optional(),
});
export type UpdateCardTemplateInput = z.infer<typeof updateCardTemplateSchema>;
