// `html` is sanitized server-side ON SAVE (security.md #8, ADR-009) — the
// admin composer's save path runs it through @repo/core's sanitizer before
// it ever reaches a `PageVersion.layout` column. This block only renders
// what it is handed, exactly like the existing content-body renderers
// (glossary terms, articles) that already trust their own save path.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const richTextPropsSchema = z.object({
  html: z.string().trim().min(1).max(20_000),
});
export type RichTextProps = z.infer<typeof richTextPropsSchema>;

export const definition = defineBlock<RichTextProps>({
  type: "rich-text",
  version: 1,
  labelKey: "cms.blocks.rich-text.label",
  category: "content",
  schema: richTextPropsSchema,
  // See heading/definition.ts's comment — `html` requires `min(1)`.
  defaults: { html: "<p>Rich text</p>" },
  fields: [
    {
      path: "html",
      kind: "richText",
      labelKey: "cms.blocks.common.fields.text",
      translatable: true,
    },
  ],
  translatable: ["html"],
  supports: { style: ["textTone"], visibility: true },
});
