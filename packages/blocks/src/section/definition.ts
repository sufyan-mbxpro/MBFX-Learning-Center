// Pure — no react-dom, no @repo/ui (ADR-032 §5). Schema/defaults/metadata
// only; the renderer lives in ./index.tsx.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const sectionPropsSchema = z.object({
  spacing: z.enum(["sm", "md", "lg"]).default("md"),
});
export type SectionProps = z.infer<typeof sectionPropsSchema>;

export const definition = defineBlock<SectionProps>({
  type: "section",
  version: 1,
  labelKey: "cms.blocks.section.label",
  category: "layout",
  schema: sectionPropsSchema,
  defaults: { spacing: "md" },
  fields: [
    {
      path: "spacing",
      kind: "select",
      labelKey: "cms.blocks.common.fields.spacing",
      options: [
        { value: "sm", labelKey: "cms.blocks.common.options.sm" },
        { value: "md", labelKey: "cms.blocks.common.options.md" },
        { value: "lg", labelKey: "cms.blocks.common.options.lg" },
      ],
    },
  ],
  supports: {
    style: ["background", "textTone", "padding", "width"],
    motion: true,
    visibility: true,
    children: true,
  },
});
