import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const marqueePropsSchema = z.object({
  items: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  speed: z.int().min(10).max(120).default(32),
});
export type MarqueeProps = z.infer<typeof marqueePropsSchema>;

export const definition = defineBlock<MarqueeProps>({
  type: "marquee",
  version: 1,
  labelKey: "cms.blocks.marquee.label",
  category: "content",
  schema: marqueePropsSchema,
  // See heading/definition.ts's comment — each item requires `min(1)`.
  defaults: { items: ["Item"], speed: 32 },
  fields: [
    {
      path: "items",
      kind: "json",
      labelKey: "cms.blocks.marquee.fields.items",
      helpKey: "cms.blocks.marquee.fields.itemsHelp",
      translatable: true,
    },
    { path: "speed", kind: "number", labelKey: "cms.blocks.marquee.fields.speed" },
  ],
  translatable: ["items"],
  supports: { visibility: true },
});
