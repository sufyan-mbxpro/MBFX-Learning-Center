import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const spacerPropsSchema = z.object({
  size: z.enum(["sm", "md", "lg", "xl"]).default("md"),
});
export type SpacerProps = z.infer<typeof spacerPropsSchema>;

export const definition = defineBlock<SpacerProps>({
  type: "spacer",
  version: 1,
  labelKey: "cms.blocks.spacer.label",
  category: "layout",
  schema: spacerPropsSchema,
  defaults: { size: "md" },
  fields: [
    {
      path: "size",
      kind: "select",
      labelKey: "cms.blocks.common.fields.size",
      options: ["sm", "md", "lg", "xl"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.common.options.${v}`,
      })),
    },
  ],
  supports: { visibility: true },
});
