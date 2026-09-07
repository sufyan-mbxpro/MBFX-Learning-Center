// The one generic dispatch block for every interactive feature (ADR-030
// §2) — this block never changes again; a new feature ships a widget
// package, not a change here. `configVersion` tracks the WIDGET's own
// `version`/`migrate` chain (ADR-030 §1), separate from this block's own
// `version` (the envelope's, always 1 — "the widget block never changes").
import { z } from "zod";
import { defineBlock } from "../registry.ts";
import type { WidgetMap } from "../widgets.ts";

export const widgetBlockPropsSchema = z.object({
  widgetKey: z.string().trim().min(1).max(80),
  config: z.unknown(),
  configVersion: z.int().min(1).default(1),
});
export type WidgetBlockProps = z.infer<typeof widgetBlockPropsSchema>;

export const definition = defineBlock<WidgetBlockProps>({
  type: "widget",
  version: 1,
  labelKey: "cms.blocks.widget.label",
  category: "data",
  schema: widgetBlockPropsSchema,
  defaults: { widgetKey: "", config: {}, configVersion: 1 },
  // `configVersion` is bookkeeping the widget's own migrate chain owns
  // (ADR-030 §1) — not admin-editable, so it has no field entry here.
  fields: [
    { path: "widgetKey", kind: "text", labelKey: "cms.blocks.widget.fields.widgetKey" },
    { path: "config", kind: "json", labelKey: "cms.blocks.widget.fields.config" },
  ],
  // Pass 1 (ADR-029): the underlying widget's needs join the same
  // collect-dedupe-resolve pipeline as a collection block's — looked up by
  // key here because the specific widget isn't known until a node's props
  // are read, unlike a block whose needs are fixed at registration.
  needs: (props, ctx: { widgets: WidgetMap }) => {
    const entry = ctx.widgets[props.widgetKey];
    if (!entry?.definition.needs) return [];
    return entry.definition.needs(props.config);
  },
  supports: { style: ["padding", "width"], motion: true, visibility: true },
});
