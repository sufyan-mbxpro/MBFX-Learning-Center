// LayoutTemplate contracts (ADR-033 §1/§3) — "Start from": the layout is
// copied into the target and is then independent. One table/kind set
// covers page, section, block and part templates (no table per preset
// "type" — ADR-033 Alternatives).
import { z } from "zod";
import { pageKindSchema } from "./pages.ts";
import { layoutTreeSchema, storedNodeSchema } from "./layout.ts";

export const layoutTemplateKindSchema = z.enum(["PAGE", "SECTION", "BLOCK", "PART"]);
export type LayoutTemplateKindInput = z.infer<typeof layoutTemplateKindSchema>;

export const layoutTemplateKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/, 'lower-case, hyphenated ("landing-page")');

/** A PART template's reserved key (ADR-027) — validated loosely here; the owning Phase 6 service knows the exact reserved-key set. */
export const layoutTemplatePartKeySchema = z.string().trim().min(1).max(60);

/**
 * `layout` shape depends on `kind`: a full tree for PAGE/PART, a subtree
 * (one node with children) for SECTION, one leaf node for BLOCK. All three
 * validate through the same node schema — a BLOCK/SECTION template is
 * simply a `StoredNode`, a PAGE/PART template a full `LayoutTree`. The
 * request schema accepts either shape and the service picks by `kind`.
 */
export const layoutTemplateContentSchema = z.union([layoutTreeSchema, storedNodeSchema]);
export type LayoutTemplateContent = z.infer<typeof layoutTemplateContentSchema>;

export const createLayoutTemplateSchema = z
  .object({
    key: layoutTemplateKeySchema,
    name: z.string().trim().min(1).max(120),
    kind: layoutTemplateKindSchema,
    pageKind: pageKindSchema.nullable().optional(),
    partKey: layoutTemplatePartKeySchema.nullable().optional(),
    layout: layoutTemplateContentSchema,
    previewImageId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .refine((v) => v.kind !== "PART" || Boolean(v.partKey), {
    message: "partKey is required for a PART template",
    path: ["partKey"],
  });
export type CreateLayoutTemplateInput = z.infer<typeof createLayoutTemplateSchema>;

export const updateLayoutTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  layout: layoutTemplateContentSchema.optional(),
  previewImageId: z.string().trim().min(1).max(64).nullable().optional(),
});
export type UpdateLayoutTemplateInput = z.infer<typeof updateLayoutTemplateSchema>;
