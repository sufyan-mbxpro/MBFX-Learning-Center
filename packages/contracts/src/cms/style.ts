// Authored styling contracts (ADR-024 §1-2, ADR-032 §2) — token choices
// only. Every field here is a bounded enum or a MediaAsset id; there is no
// `string` color field anywhere in this file, so no schema in this package
// can ever accept a hex literal — that is a property of the shapes, not
// something a test has to police value-by-value (a contract test still
// asserts it, per ADR-024's compliance list).
import { z } from "zod";

/** The theme's own "brand" token group (packages/theme BRAND_FIELD_REGISTRY) — the only tokens a gradient may pair (ADR-032 §2). */
export const brandTokenSchema = z.enum(["primary", "secondary", "accent"]);
export type BrandToken = z.infer<typeof brandTokenSchema>;

export const overlaySchema = z.object({
  tone: z.enum(["none", "light", "dark", "brand"]),
  strength: z.enum(["sm", "md", "lg"]),
});
export type Overlay = z.infer<typeof overlaySchema>;

const tokenBackgroundSchema = z.object({
  kind: z.literal("token"),
  token: z.enum(["none", "surface-1", "surface-2", "primary", "secondary", "accent"]),
});

const gradientBackgroundSchema = z.object({
  kind: z.literal("gradient"),
  from: brandTokenSchema,
  to: brandTokenSchema,
  direction: z.enum(["to-b", "to-r", "to-br", "radial"]),
});

const imageBackgroundSchema = z.object({
  kind: z.literal("image"),
  assetId: z.string().trim().min(1),
  fit: z.enum(["cover", "contain"]),
  position: z.enum(["center", "top", "bottom"]),
  overlay: overlaySchema,
  fixed: z.boolean().optional(),
});

const videoBackgroundSchema = z.object({
  kind: z.literal("video"),
  assetId: z.string().trim().min(1),
  posterAssetId: z.string().trim().min(1),
  overlay: overlaySchema,
});

/** Discriminated union — every variant is validated for the overlay gate at publish (ADR-032 §2), not here: this schema only shapes the data. */
export const backgroundSchema = z.discriminatedUnion("kind", [
  tokenBackgroundSchema,
  gradientBackgroundSchema,
  imageBackgroundSchema,
  videoBackgroundSchema,
]);
export type Background = z.infer<typeof backgroundSchema>;

export const styleChoicesSchema = z.object({
  background: backgroundSchema.optional(),
  textTone: z.enum(["default", "muted", "on-primary", "on-image"]).optional(),
  padding: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
  gap: z.enum(["none", "sm", "md", "lg"]).optional(),
  radius: z.enum(["none", "sm", "md", "lg"]).optional(),
  shadow: z.enum(["none", "sm", "md", "lg"]).optional(),
  border: z.enum(["none", "hairline", "strong"]).optional(),
  width: z.enum(["narrow", "default", "wide", "full"]).optional(),
});
export type StyleChoices = z.infer<typeof styleChoicesSchema>;

/** Keys a block's `supports.style` may list (BlockDefinition, plan §6.1) — a subset of styleChoicesSchema's own keys, so the composer only offers what a block declared. */
export const styleKeySchema = z.enum([
  "background",
  "textTone",
  "padding",
  "gap",
  "radius",
  "shadow",
  "border",
  "width",
]);
export type StyleKey = z.infer<typeof styleKeySchema>;

/** Motion (ADR-024 §2, unchanged by ADR-032) — bounded enums over shipped `@repo/ui` components; there is no effect-preset table. */
export const motionChoicesSchema = z.object({
  entrance: z.enum(["none", "fade", "fade-up", "stagger"]).optional(),
  hover: z.enum(["none", "lift", "zoom"]).optional(),
});
export type MotionChoices = z.infer<typeof motionChoicesSchema>;
