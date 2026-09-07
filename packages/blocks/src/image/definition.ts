import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const imagePropsSchema = z.object({
  assetId: z.string().trim().min(1),
  alt: z.string().trim().max(300).default(""),
  fit: z.enum(["cover", "contain"]).default("cover"),
  aspectRatio: z.enum(["auto", "square", "video", "portrait"]).default("auto"),
});
export type ImageProps = z.infer<typeof imagePropsSchema>;

export const definition = defineBlock<ImageProps>({
  type: "image",
  version: 1,
  labelKey: "cms.blocks.image.label",
  category: "content",
  schema: imagePropsSchema,
  defaults: { assetId: "", alt: "", fit: "cover", aspectRatio: "auto" },
  fields: [
    { path: "assetId", kind: "media", labelKey: "cms.blocks.common.fields.image" },
    { path: "alt", kind: "text", labelKey: "cms.blocks.image.fields.alt", translatable: true },
    {
      path: "fit",
      kind: "select",
      labelKey: "cms.blocks.image.fields.fit",
      options: [
        { value: "cover", labelKey: "cms.blocks.image.options.cover" },
        { value: "contain", labelKey: "cms.blocks.image.options.contain" },
      ],
    },
    {
      path: "aspectRatio",
      kind: "select",
      labelKey: "cms.blocks.image.fields.aspectRatio",
      options: ["auto", "square", "video", "portrait"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.image.options.${v}`,
      })),
    },
  ],
  translatable: ["alt"],
  supports: { style: ["radius", "shadow", "border", "width"], motion: true, visibility: true },
});
