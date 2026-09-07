import { z } from "zod";
import { linkTargetSchema } from "@repo/contracts";
import { defineBlock } from "../registry.ts";

export const ctaBandPropsSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(300).default(""),
  buttonLabel: z.string().trim().min(1).max(60),
  buttonLink: linkTargetSchema,
  variant: z.enum(["default", "full-width"]).default("default"),
});
export type CtaBandProps = z.infer<typeof ctaBandPropsSchema>;

export const definition = defineBlock<CtaBandProps>({
  type: "cta-band",
  version: 1,
  labelKey: "cms.blocks.cta-band.label",
  category: "marketing",
  schema: ctaBandPropsSchema,
  // See heading/definition.ts's comment — `title`/`buttonLabel` require `min(1)`.
  defaults: {
    title: "Call to action",
    description: "",
    buttonLabel: "Learn more",
    buttonLink: { type: "NONE" },
    variant: "default",
  },
  fields: [
    { path: "title", kind: "text", labelKey: "cms.blocks.common.fields.title", translatable: true },
    {
      path: "description",
      kind: "textarea",
      labelKey: "cms.blocks.common.fields.description",
      translatable: true,
    },
    {
      path: "buttonLabel",
      kind: "text",
      labelKey: "cms.blocks.common.fields.label",
      translatable: true,
    },
    { path: "buttonLink", kind: "link", labelKey: "cms.blocks.common.fields.link" },
    {
      path: "variant",
      kind: "select",
      labelKey: "cms.blocks.common.fields.variant",
      options: [
        { value: "default", labelKey: "cms.blocks.common.options.default" },
        { value: "full-width", labelKey: "cms.blocks.cta-band.options.fullWidth" },
      ],
    },
  ],
  translatable: ["title", "description", "buttonLabel"],
  links: ["buttonLink"],
  supports: { motion: true, visibility: true },
});
