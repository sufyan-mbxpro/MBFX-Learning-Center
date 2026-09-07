// StylePreset contracts (ADR-033 §1-2) — "Linked": a node stores an id;
// editing the row updates every placement. `config` is the same token-only
// vocabulary a node's own `style.overrides`/`motion` fields use — never a
// third, looser shape for "presets".
import { z } from "zod";
import { motionChoicesSchema, styleChoicesSchema } from "./style.ts";

export const stylePresetConfigSchema = z.object({
  style: styleChoicesSchema.optional(),
  motion: motionChoicesSchema.optional(),
});
export type StylePresetConfig = z.infer<typeof stylePresetConfigSchema>;

/** Advisory only (not a foreign key) — narrows which blocks the composer offers a preset for. "any" | a block type key | "widget". */
export const stylePresetScopeSchema = z.string().trim().min(1).max(60).default("any");

export const stylePresetKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/, 'lower-case, hyphenated ("hero-dark")');

export const createStylePresetSchema = z.object({
  key: stylePresetKeySchema,
  name: z.string().trim().min(1).max(120),
  scope: stylePresetScopeSchema,
  config: stylePresetConfigSchema,
});
export type CreateStylePresetInput = z.infer<typeof createStylePresetSchema>;

export const updateStylePresetSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  scope: stylePresetScopeSchema.optional(),
  config: stylePresetConfigSchema.optional(),
});
export type UpdateStylePresetInput = z.infer<typeof updateStylePresetSchema>;
