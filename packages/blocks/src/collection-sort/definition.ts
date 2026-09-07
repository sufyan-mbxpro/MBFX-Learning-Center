// A pure client-side URL control (ADR-022 §3), same shape as
// `collection-search` — no `needs()`. `options` are authored directly by
// the admin (a JSON field, matching `collection`'s own `filter` field):
// the composer has no live, provider-aware picker yet that could offer "the
// bound collection's real `sorts` descriptors" while designing — a real
// gap, not pretended otherwise. Wiring that is a composer UX enhancement on
// top of an already-working render path, not a blocker to shipping one.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

const sortOptionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(60),
});

export const collectionSortPropsSchema = z.object({
  bindingId: z.string().trim().min(1).max(60).default("main"),
  options: z
    .array(sortOptionSchema)
    .min(1)
    .max(10)
    .default([{ value: "newest", label: "Newest" }]),
});
export type CollectionSortProps = z.infer<typeof collectionSortPropsSchema>;

export const definition = defineBlock<CollectionSortProps>({
  type: "collection-sort",
  version: 1,
  labelKey: "cms.blocks.collectionSort.label",
  category: "collection",
  schema: collectionSortPropsSchema,
  defaults: { bindingId: "main", options: [{ value: "newest", label: "Newest" }] },
  fields: [
    { path: "bindingId", kind: "text", labelKey: "cms.blocks.collection.fields.bindingId" },
    { path: "options", kind: "json", labelKey: "cms.blocks.collectionSort.fields.options" },
  ],
  client: true,
  supports: { style: ["width"], motion: true, visibility: true },
});
