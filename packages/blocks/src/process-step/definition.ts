import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const processStepPropsSchema = z.object({
  step: z.int().min(1).max(20),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().max(300).default(""),
  isLast: z.boolean().default(false),
});
export type ProcessStepProps = z.infer<typeof processStepPropsSchema>;

export const definition = defineBlock<ProcessStepProps>({
  type: "process-step",
  version: 1,
  labelKey: "cms.blocks.process-step.label",
  category: "content",
  schema: processStepPropsSchema,
  // See heading/definition.ts's comment — `title` requires `min(1)`.
  defaults: { step: 1, title: "Step", body: "", isLast: false },
  fields: [
    { path: "step", kind: "number", labelKey: "cms.blocks.process-step.fields.step" },
    { path: "title", kind: "text", labelKey: "cms.blocks.common.fields.title", translatable: true },
    {
      path: "body",
      kind: "textarea",
      labelKey: "cms.blocks.common.fields.body",
      translatable: true,
    },
    { path: "isLast", kind: "boolean", labelKey: "cms.blocks.process-step.fields.isLast" },
  ],
  translatable: ["title", "body"],
  supports: { visibility: true },
});
