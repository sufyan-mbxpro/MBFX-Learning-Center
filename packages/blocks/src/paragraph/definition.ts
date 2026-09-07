import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const paragraphPropsSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  align: z.enum(["start", "center"]).default("start"),
  size: z.enum(["sm", "default", "lg"]).default("default"),
});
export type ParagraphProps = z.infer<typeof paragraphPropsSchema>;

export const definition = defineBlock<ParagraphProps>({
  type: "paragraph",
  version: 1,
  labelKey: "cms.blocks.paragraph.label",
  category: "content",
  schema: paragraphPropsSchema,
  // See heading/definition.ts's comment — `text` requires `min(1)`.
  defaults: { text: "Paragraph text", align: "start", size: "default" },
  fields: [
    {
      path: "text",
      kind: "textarea",
      labelKey: "cms.blocks.common.fields.text",
      translatable: true,
    },
    {
      path: "align",
      kind: "select",
      labelKey: "cms.blocks.common.fields.align",
      options: [
        { value: "start", labelKey: "cms.blocks.common.options.alignStart" },
        { value: "center", labelKey: "cms.blocks.common.options.alignCenter" },
      ],
    },
    {
      path: "size",
      kind: "select",
      labelKey: "cms.blocks.common.fields.size",
      options: [
        { value: "sm", labelKey: "cms.blocks.common.options.sm" },
        { value: "default", labelKey: "cms.blocks.common.options.default" },
        { value: "lg", labelKey: "cms.blocks.common.options.lg" },
      ],
    },
  ],
  translatable: ["text"],
  supports: { style: ["textTone"], motion: true, visibility: true },
});
