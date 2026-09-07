import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const containerPropsSchema = z.object({
  size: z.enum(["page", "wide", "narrow"]).default("page"),
});
export type ContainerProps = z.infer<typeof containerPropsSchema>;

export const definition = defineBlock<ContainerProps>({
  type: "container",
  version: 1,
  labelKey: "cms.blocks.container.label",
  category: "layout",
  schema: containerPropsSchema,
  defaults: { size: "page" },
  fields: [
    {
      path: "size",
      kind: "select",
      labelKey: "cms.blocks.common.fields.size",
      options: [
        { value: "page", labelKey: "cms.blocks.container.options.page" },
        { value: "wide", labelKey: "cms.blocks.container.options.wide" },
        { value: "narrow", labelKey: "cms.blocks.container.options.narrow" },
      ],
    },
  ],
  supports: { style: ["padding"], motion: true, visibility: true, children: true },
});
