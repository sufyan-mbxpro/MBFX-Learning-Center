// The one generic collection block (ADR-022 §3): content-type agnostic,
// configured by `contentType` — a new provider appears here with no block
// change (ADR-022 §16's genericity requirement). `category: "collection"`
// is what PR 3.4's data-budget gate already counts (`gates.ts`'s
// `checkDataBudget`), wired ahead of this block existing — registering it
// here is the only change needed for that gate to start seeing real nodes.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const collectionPropsSchema = z.object({
  contentType: z.string().trim().min(1).max(60),
  bindingId: z.string().trim().min(1).max(60).default("main"),
  filter: z.record(z.string(), z.string()).default({}),
  sort: z.string().trim().max(60).optional(),
  limit: z.int().min(1).max(24).default(12),
  layout: z.enum(["grid", "list", "carousel"]).default("grid"),
  columns: z.enum(["1", "2", "3", "4"]).default("3"),
  /** ADR-023: a `CardTemplate` id, resolved once per render (`RenderContext.resolveCardTemplate`, PR 4.3) — a missing/unset id falls back to the content type's seeded system template, never an error. */
  cardTemplateId: z.string().trim().min(1).optional(),
});
export type CollectionProps = z.infer<typeof collectionPropsSchema>;

export const definition = defineBlock<CollectionProps>({
  type: "collection",
  version: 2,
  labelKey: "cms.blocks.collection.label",
  category: "collection",
  schema: collectionPropsSchema,
  defaults: {
    contentType: "news",
    bindingId: "main",
    filter: {},
    limit: 12,
    layout: "grid",
    columns: "3",
  },
  // v1 → v2 (PR 4.3): `cardTemplateId` added, optional — an old node with
  // no opinion on its card template simply falls back to the system
  // default at render time, so the migration is a structural no-op.
  migrate: { 1: (old) => old },
  fields: [
    { path: "contentType", kind: "text", labelKey: "cms.blocks.collection.fields.contentType" },
    { path: "bindingId", kind: "text", labelKey: "cms.blocks.collection.fields.bindingId" },
    { path: "filter", kind: "json", labelKey: "cms.blocks.collection.fields.filter" },
    { path: "sort", kind: "text", labelKey: "cms.blocks.collection.fields.sort" },
    { path: "limit", kind: "number", labelKey: "cms.blocks.collection.fields.limit" },
    {
      path: "layout",
      kind: "select",
      labelKey: "cms.blocks.collection.fields.layout",
      options: [
        { value: "grid", labelKey: "cms.blocks.collection.options.grid" },
        { value: "list", labelKey: "cms.blocks.collection.options.list" },
        { value: "carousel", labelKey: "cms.blocks.collection.options.carousel" },
      ],
    },
    {
      path: "columns",
      kind: "select",
      labelKey: "cms.blocks.common.fields.columnCount",
      options: ["1", "2", "3", "4"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.common.options.count${v}`,
      })),
    },
    {
      path: "cardTemplateId",
      kind: "text",
      labelKey: "cms.blocks.collection.fields.cardTemplateId",
    },
  ],
  // ADR-022 §4 / plan v2.2 §12 PR 4.2: the canonical query for this
  // `bindingId` is resolved ONCE per render (render.tsx's Pass 0) so a
  // `collection-pagination` block elsewhere in the tree can declare the
  // identical need and dedupe onto the same result.
  needs: (props, ctx) => {
    const binding = ctx.bindings[props.bindingId];
    if (!binding) return [];
    return [
      {
        provider: binding.contentType,
        query: binding.query,
        bindingId: props.bindingId,
        scope: "page",
      },
    ];
  },
  supports: { style: ["padding", "width"], motion: true, visibility: true },
});
