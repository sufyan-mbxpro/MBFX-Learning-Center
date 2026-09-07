import { z } from "zod";
import { defineBlock } from "../registry.ts";

const tabItemSchema = z.object({
  label: z.string().trim().min(1).max(60),
  content: z.string().trim().min(1).max(1000),
});

export const tabsPropsSchema = z.object({
  items: z.array(tabItemSchema).min(1).max(10),
});
export type TabsProps = z.infer<typeof tabsPropsSchema>;

export const definition = defineBlock<TabsProps>({
  type: "tabs",
  version: 1,
  labelKey: "cms.blocks.tabs.label",
  category: "content",
  schema: tabsPropsSchema,
  // See heading/definition.ts's comment — label/content require `min(1)`.
  defaults: { items: [{ label: "Tab 1", content: "Content" }] },
  fields: [
    {
      path: "items",
      kind: "json",
      labelKey: "cms.blocks.tabs.fields.items",
      helpKey: "cms.blocks.tabs.fields.itemsHelp",
      translatable: true,
    },
  ],
  translatable: ["items"],
  supports: { visibility: true },
});
