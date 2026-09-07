import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const statCardPropsSchema = z.object({
  value: z.number(),
  prefix: z.string().trim().max(10).default(""),
  suffix: z.string().trim().max(10).default(""),
  label: z.string().trim().min(1).max(80),
});
export type StatCardProps = z.infer<typeof statCardPropsSchema>;

export const definition = defineBlock<StatCardProps>({
  type: "stat-card",
  version: 1,
  labelKey: "cms.blocks.stat-card.label",
  category: "content",
  schema: statCardPropsSchema,
  // See heading/definition.ts's comment — `label` requires `min(1)`.
  defaults: { value: 0, prefix: "", suffix: "", label: "Metric" },
  fields: [
    { path: "value", kind: "number", labelKey: "cms.blocks.common.fields.value" },
    { path: "prefix", kind: "text", labelKey: "cms.blocks.common.fields.prefix" },
    { path: "suffix", kind: "text", labelKey: "cms.blocks.common.fields.suffix" },
    { path: "label", kind: "text", labelKey: "cms.blocks.common.fields.label", translatable: true },
  ],
  translatable: ["label"],
  supports: { visibility: true },
});
