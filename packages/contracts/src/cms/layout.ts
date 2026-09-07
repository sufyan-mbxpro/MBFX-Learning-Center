// CMS layout tree — the node envelope (ADR-032 §1) and the top-level
// versioned document it lives in (ADR-021 §3). `props` is validated per
// block type by the Phase 2 registry (@repo/blocks/definitions); here it
// is only checked to be present.
//
// Phase 2 (plan §12 PR 2.2): `style.overrides`, `motion` and `responsive`
// now use the full token-only StyleChoices/MotionChoices/ResponsiveOverrides
// contracts (ADR-032 §2-3, this file's siblings `style.ts`/`responsive.ts`)
// in place of Phase 1's placeholder records. Widening a frozen enum later is
// additive (a new value); renaming one is an ADR (ADR-032 "Consequences").
import { z } from "zod";
import { motionChoicesSchema, styleChoicesSchema } from "./style.ts";
import type { MotionChoices, StyleChoices } from "./style.ts";
import { responsiveOverridesSchema } from "./responsive.ts";
import type { ResponsiveOverrides } from "./responsive.ts";

export const featureVisibilitySchema = z.enum(["PUBLIC", "AUTHENTICATED", "PREMIUM", "ADMIN"]);
export type FeatureVisibilityInput = z.infer<typeof featureVisibilitySchema>;

export interface StoredNode {
  type: string;
  version: number;
  id: string;
  props: unknown;
  label?: string;
  hidden: boolean;
  anchor?: string;
  style?: { presetId?: string; overrides?: StyleChoices };
  motion?: MotionChoices;
  visibility?: FeatureVisibilityInput;
  requiresFeature?: string;
  responsive?: ResponsiveOverrides;
  translations?: Record<string, Record<string, unknown>>;
  children: StoredNode[];
}

// z.ZodType<T> + z.lazy is Zod's documented pattern for a self-referential
// schema (`children: StoredNode[]`).
export const storedNodeSchema: z.ZodType<StoredNode> = z.lazy(() =>
  z.object({
    type: z.string().trim().min(1).max(80),
    version: z.int().min(1),
    id: z.string().trim().min(1).max(64),
    props: z.unknown(),
    label: z.string().trim().max(120).optional(),
    hidden: z.boolean().default(false),
    anchor: z.string().trim().max(150).optional(),
    style: z
      .object({
        presetId: z.string().trim().min(1).max(64).optional(),
        overrides: styleChoicesSchema.optional(),
      })
      .optional(),
    motion: motionChoicesSchema.optional(),
    visibility: featureVisibilitySchema.optional(),
    requiresFeature: z.string().trim().max(80).optional(),
    responsive: responsiveOverridesSchema.optional(),
    translations: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    children: z.array(storedNodeSchema).max(200).default([]),
  }),
);

/** The whole document a `PageVersion.layout` column holds. Versioned so a future breaking shape gets its own literal and a migration, same discipline as blocks. */
export const layoutTreeSchema = z.object({
  version: z.literal(1),
  nodes: z.array(storedNodeSchema).max(500),
});
export type LayoutTree = z.infer<typeof layoutTreeSchema>;

export const EMPTY_LAYOUT: LayoutTree = { version: 1, nodes: [] };
