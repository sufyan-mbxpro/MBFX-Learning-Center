// Shared shapes for the Widget registry (ADR-030 §1) — the metadata a
// `WidgetDefinition` and a `BlockDefinition` (plan §6.1) both use to let the
// composer render a settings panel from data instead of per-block UI code.
// The generic `widget` block's own props schema lives beside the other
// block prop schemas at `cms/blocks/widget.ts`, not here — this file is the
// vocabulary every widget package's `/definition` subpath is built from.
import { z } from "zod";

export const widgetCategorySchema = z.enum(["calculator", "market", "trading", "form", "other"]);
export type WidgetCategory = z.infer<typeof widgetCategorySchema>;

/** A widget's or a block's registry key — dot-namespaced by feature, e.g. "calc.pip", "market.rates-table". */
export const registryKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/, 'lower-case, dot-namespaced ("calc.pip")');

const editorFieldKindSchema = z.enum([
  "text",
  "textarea",
  "richText",
  "number",
  "boolean",
  "select",
  "link",
  "media",
  "cardTemplate",
  "stylePreset",
  "color-token",
  // PR 3.3: a raw-JSON fallback for array-of-object props (faq/tabs items,
  // table headers/rows, marquee items) — no dedicated repeater control
  // exists yet. Same temporary-simplification precedent as the Styles
  // screen's JSON textarea (PR 3.1): validated by the block's own schema
  // on save, never trusted as-is.
  "json",
]);

/**
 * Declarative settings-panel metadata — the composer renders one panel
 * control per entry, keyed by `path` into the block/widget's `props`. No
 * React, no render function: this is data the admin surface reads, matching
 * ADR-032 §5's rule that `/definition(s)` subpaths stay pure.
 */
export const editorFieldMetaSchema = z.object({
  path: z.string().trim().min(1).max(200),
  kind: editorFieldKindSchema,
  labelKey: z.string().trim().min(1).max(150),
  helpKey: z.string().trim().min(1).max(150).optional(),
  options: z.array(z.object({ value: z.string(), labelKey: z.string() })).optional(),
  translatable: z.boolean().optional(),
});
export type EditorFieldMeta = z.infer<typeof editorFieldMetaSchema>;
