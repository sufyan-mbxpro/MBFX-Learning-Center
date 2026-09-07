// A pure client-side URL control (ADR-022 §3) — no `needs()`. `options`
// (value/label/count) are authored directly by the admin, refreshed
// whenever they re-open this block's settings (a real, named
// simplification: live per-request facet counts would need this block to
// carry its own `needs()` correlated with the bound collection's provider,
// same mechanism `collection-pagination` uses for `total` — worth doing
// once a page actually needs facet counts that track visitor-by-visitor
// changes; a filter's VALUES rarely change, only its counts drift, so
// staleness here is cosmetic, unlike pagination's `total` being wrong).
// `style: "checkboxes"` is single-select today, same as "pills"/"dropdown"
// — no provider yet accepts more than one value per filter key, so a true
// multi-select control would be UI for a capability nothing offers.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

const filterOptionSchema = z.object({
  value: z.string().trim().min(1).max(150),
  label: z.string().trim().min(1).max(150),
  count: z.int().min(0).optional(),
});

export const collectionFilterPropsSchema = z.object({
  bindingId: z.string().trim().min(1).max(60).default("main"),
  filterKey: z.string().trim().min(1).max(60).default("category"),
  style: z.enum(["pills", "dropdown", "checkboxes"]).default("pills"),
  options: z.array(filterOptionSchema).max(30).default([]),
});
export type CollectionFilterProps = z.infer<typeof collectionFilterPropsSchema>;

export const definition = defineBlock<CollectionFilterProps>({
  type: "collection-filter",
  version: 1,
  labelKey: "cms.blocks.collectionFilter.label",
  category: "collection",
  schema: collectionFilterPropsSchema,
  defaults: { bindingId: "main", filterKey: "category", style: "pills", options: [] },
  fields: [
    { path: "bindingId", kind: "text", labelKey: "cms.blocks.collection.fields.bindingId" },
    { path: "filterKey", kind: "text", labelKey: "cms.blocks.collectionFilter.fields.filterKey" },
    {
      path: "style",
      kind: "select",
      labelKey: "cms.blocks.collectionFilter.fields.style",
      options: [
        { value: "pills", labelKey: "cms.blocks.collectionFilter.options.pills" },
        { value: "dropdown", labelKey: "cms.blocks.collectionFilter.options.dropdown" },
        { value: "checkboxes", labelKey: "cms.blocks.collectionFilter.options.checkboxes" },
      ],
    },
    { path: "options", kind: "json", labelKey: "cms.blocks.collectionFilter.fields.options" },
  ],
  client: true,
  supports: { style: ["width"], motion: true, visibility: true },
});
