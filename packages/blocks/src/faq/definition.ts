import { z } from "zod";
import { defineBlock } from "../registry.ts";

const faqItemSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1000),
});

export const faqPropsSchema = z.object({
  items: z.array(faqItemSchema).min(1).max(20),
});
export type FaqProps = z.infer<typeof faqPropsSchema>;

export const definition = defineBlock<FaqProps>({
  type: "faq",
  version: 1,
  labelKey: "cms.blocks.faq.label",
  category: "content",
  schema: faqPropsSchema,
  // See heading/definition.ts's comment — question/answer require `min(1)`.
  defaults: { items: [{ question: "Question", answer: "Answer" }] },
  fields: [
    {
      path: "items",
      kind: "json",
      labelKey: "cms.blocks.faq.fields.items",
      helpKey: "cms.blocks.faq.fields.itemsHelp",
      translatable: true,
    },
  ],
  // Whole-array replacement per locale, not per-field merge — the same
  // rule the envelope's `mergeTranslation` already applies to any
  // translatable key (render.tsx).
  translatable: ["items"],
  supports: { visibility: true },
});
