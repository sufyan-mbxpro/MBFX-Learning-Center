import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const badgePropsSchema = z.object({
  text: z.string().trim().min(1).max(60),
  variant: z.enum(["default", "secondary", "outline", "eyebrow", "pill"]).default("default"),
});
export type BadgeProps = z.infer<typeof badgePropsSchema>;

export const definition = defineBlock<BadgeProps>({
  type: "badge",
  version: 1,
  labelKey: "cms.blocks.badge.label",
  category: "content",
  schema: badgePropsSchema,
  // See heading/definition.ts's comment — `text` requires `min(1)`.
  defaults: { text: "Badge", variant: "default" },
  fields: [
    { path: "text", kind: "text", labelKey: "cms.blocks.common.fields.text", translatable: true },
    {
      path: "variant",
      kind: "select",
      labelKey: "cms.blocks.common.fields.variant",
      options: ["default", "secondary", "outline", "eyebrow", "pill"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.badge.options.${v}`,
      })),
    },
  ],
  translatable: ["text"],
  supports: { visibility: true },
});
