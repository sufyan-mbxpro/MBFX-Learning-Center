// Mirrors apps/web's existing (deliberately disabled — no subscriber model
// yet, see that component's own comment) NewsletterForm markup, so the CMS
// version behaves identically until a NewsletterSubscriber model lands.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const newsletterFormPropsSchema = z.object({
  placeholder: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  submitLabel: z.string().trim().min(1).max(40),
  unavailableLabel: z.string().trim().min(1).max(200),
  tone: z.enum(["default", "onFill", "onSecondary"]).default("default"),
});
export type NewsletterFormProps = z.infer<typeof newsletterFormPropsSchema>;

export const definition = defineBlock<NewsletterFormProps>({
  type: "newsletter-form",
  version: 1,
  labelKey: "cms.blocks.newsletter-form.label",
  category: "marketing",
  schema: newsletterFormPropsSchema,
  // See heading/definition.ts's comment — all four text props require `min(1)`.
  defaults: {
    placeholder: "Enter your email",
    label: "Subscribe to our newsletter",
    submitLabel: "Subscribe",
    unavailableLabel: "Newsletter signup is coming soon.",
    tone: "default",
  },
  fields: [
    {
      path: "placeholder",
      kind: "text",
      labelKey: "cms.blocks.newsletter-form.fields.placeholder",
      translatable: true,
    },
    { path: "label", kind: "text", labelKey: "cms.blocks.common.fields.label", translatable: true },
    {
      path: "submitLabel",
      kind: "text",
      labelKey: "cms.blocks.newsletter-form.fields.submitLabel",
      translatable: true,
    },
    {
      path: "unavailableLabel",
      kind: "text",
      labelKey: "cms.blocks.newsletter-form.fields.unavailableLabel",
      translatable: true,
    },
    {
      path: "tone",
      kind: "select",
      labelKey: "cms.blocks.newsletter-form.fields.tone",
      options: ["default", "onFill", "onSecondary"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.newsletter-form.options.${v}`,
      })),
    },
  ],
  translatable: ["placeholder", "label", "submitLabel", "unavailableLabel"],
  supports: { visibility: true },
});
