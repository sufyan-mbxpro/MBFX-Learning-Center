// Self-hosted MediaAsset only for Phase 2 — the allow-listed EMBED source
// plan §6.2 mentions belongs to Media v2 (ADR-034), a Phase 3 dependency
// this PR does not pull forward. Adding it later is additive (a new
// `source.kind`), not a breaking change to this schema.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const videoPropsSchema = z.object({
  assetId: z.string().trim().min(1),
  posterAssetId: z.string().trim().min(1),
  autoplay: z.boolean().default(false),
});
export type VideoProps = z.infer<typeof videoPropsSchema>;

export const definition = defineBlock<VideoProps>({
  type: "video",
  version: 1,
  labelKey: "cms.blocks.video.label",
  category: "content",
  schema: videoPropsSchema,
  defaults: { assetId: "", posterAssetId: "", autoplay: false },
  fields: [
    { path: "assetId", kind: "media", labelKey: "cms.blocks.common.fields.image" },
    { path: "posterAssetId", kind: "media", labelKey: "cms.blocks.video.fields.poster" },
    { path: "autoplay", kind: "boolean", labelKey: "cms.blocks.common.fields.autoplay" },
  ],
  supports: { style: ["radius", "shadow", "width"], visibility: true },
});
