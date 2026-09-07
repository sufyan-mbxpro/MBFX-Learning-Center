import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const counterPropsSchema = z.object({
  value: z.number(),
  prefix: z.string().trim().max(10).default(""),
  suffix: z.string().trim().max(10).default(""),
});
export type CounterProps = z.infer<typeof counterPropsSchema>;

export const definition = defineBlock<CounterProps>({
  type: "counter",
  version: 1,
  labelKey: "cms.blocks.counter.label",
  category: "content",
  schema: counterPropsSchema,
  defaults: { value: 0, prefix: "", suffix: "" },
  fields: [
    { path: "value", kind: "number", labelKey: "cms.blocks.common.fields.value" },
    { path: "prefix", kind: "text", labelKey: "cms.blocks.common.fields.prefix" },
    { path: "suffix", kind: "text", labelKey: "cms.blocks.common.fields.suffix" },
  ],
  supports: { style: ["textTone"], visibility: true },
});
