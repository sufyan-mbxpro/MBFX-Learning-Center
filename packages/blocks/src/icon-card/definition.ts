import { z } from "zod";
import { linkTargetSchema } from "@repo/contracts";
import { defineBlock } from "../registry.ts";

// A bounded set, not an arbitrary lucide-react name — `/definitions` is
// pure (no react-dom, ADR-032 §5), so the icon->component mapping lives in
// ./index.tsx's own literal table, and only these keys are legal data.
export const ICON_KEYS = [
  "trending-up",
  "shield",
  "users",
  "zap",
  "globe",
  "book-open",
  "bar-chart",
  "dollar-sign",
] as const;

export const iconCardPropsSchema = z.object({
  icon: z.enum(ICON_KEYS),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().max(300).default(""),
  link: linkTargetSchema.optional(),
});
export type IconCardProps = z.infer<typeof iconCardPropsSchema>;

export const definition = defineBlock<IconCardProps>({
  type: "icon-card",
  version: 1,
  labelKey: "cms.blocks.icon-card.label",
  category: "content",
  schema: iconCardPropsSchema,
  // See heading/definition.ts's comment — `title` requires `min(1)`.
  defaults: { icon: "zap", title: "Feature", body: "" },
  fields: [
    {
      path: "icon",
      kind: "select",
      labelKey: "cms.blocks.common.fields.icon",
      options: ICON_KEYS.map((v) => ({ value: v, labelKey: `cms.blocks.icon-card.options.${v}` })),
    },
    { path: "title", kind: "text", labelKey: "cms.blocks.common.fields.title", translatable: true },
    {
      path: "body",
      kind: "textarea",
      labelKey: "cms.blocks.common.fields.body",
      translatable: true,
    },
    { path: "link", kind: "link", labelKey: "cms.blocks.common.fields.link" },
  ],
  translatable: ["title", "body"],
  links: ["link"],
  supports: { visibility: true },
});
