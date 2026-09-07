import { z } from "zod";
import { linkTargetSchema } from "@repo/contracts";
import { defineBlock } from "../registry.ts";

export const buttonPropsSchema = z.object({
  label: z.string().trim().min(1).max(60),
  link: linkTargetSchema,
  variant: z.enum(["default", "outline", "secondary", "ghost"]).default("default"),
  size: z.enum(["default", "lg", "xl"]).default("default"),
});
export type ButtonProps = z.infer<typeof buttonPropsSchema>;

export const definition = defineBlock<ButtonProps>({
  type: "button",
  version: 1,
  labelKey: "cms.blocks.button.label",
  category: "content",
  schema: buttonPropsSchema,
  // See heading/definition.ts's comment — `label` requires `min(1)`.
  defaults: { label: "Button", link: { type: "NONE" }, variant: "default", size: "default" },
  fields: [
    { path: "label", kind: "text", labelKey: "cms.blocks.common.fields.label", translatable: true },
    { path: "link", kind: "link", labelKey: "cms.blocks.common.fields.link" },
    {
      path: "variant",
      kind: "select",
      labelKey: "cms.blocks.common.fields.variant",
      options: ["default", "outline", "secondary", "ghost"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.button.options.${v}`,
      })),
    },
    {
      path: "size",
      kind: "select",
      labelKey: "cms.blocks.common.fields.size",
      options: [
        { value: "default", labelKey: "cms.blocks.common.options.default" },
        { value: "lg", labelKey: "cms.blocks.common.options.lg" },
        { value: "xl", labelKey: "cms.blocks.button.options.xl" },
      ],
    },
  ],
  translatable: ["label"],
  links: ["link"],
  supports: { visibility: true },
});
