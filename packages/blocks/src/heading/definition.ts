import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const headingPropsSchema = z.object({
  text: z.string().trim().min(1).max(200),
  level: z.enum(["1", "2", "3", "4", "5", "6"]).default("2"),
  align: z.enum(["start", "center"]).default("start"),
});
export type HeadingProps = z.infer<typeof headingPropsSchema>;

export const definition = defineBlock<HeadingProps>({
  type: "heading",
  version: 1,
  labelKey: "cms.blocks.heading.label",
  category: "content",
  schema: headingPropsSchema,
  // Found via the composer's own smoke test (PR 3.3): `text` requires
  // `min(1)`, so an empty default failed validation the instant a fresh
  // node was inserted — every block below with a required-text prop had
  // the same latent bug, unexercised until something actually
  // instantiated a node from `defaults` and rendered it.
  defaults: { text: "Heading", level: "2", align: "start" },
  fields: [
    { path: "text", kind: "text", labelKey: "cms.blocks.common.fields.text", translatable: true },
    {
      path: "level",
      kind: "select",
      labelKey: "cms.blocks.heading.fields.level",
      options: ["1", "2", "3", "4", "5", "6"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.heading.options.h${v}`,
      })),
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
  ],
  translatable: ["text"],
  supports: { style: ["textTone"], motion: true, visibility: true },
});
