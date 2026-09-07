// The one companion block that genuinely needs live data (ADR-022 §4): a
// wrong page count is a real bug, unlike a filter's stale count, which is
// only cosmetic — so this is the one place besides `collection`/
// `featured-content` itself declaring a `needs()`, deliberately identical
// to `collection`'s own so both dedupe onto the SAME resolved result
// (render.tsx's `needKey` — same `{provider, query}` pair, one real
// provider call either way).
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const collectionPaginationPropsSchema = z.object({
  bindingId: z.string().trim().min(1).max(60).default("main"),
  mode: z.enum(["numbered", "load-more"]).default("numbered"),
});
export type CollectionPaginationProps = z.infer<typeof collectionPaginationPropsSchema>;

export const definition = defineBlock<CollectionPaginationProps>({
  type: "collection-pagination",
  version: 1,
  labelKey: "cms.blocks.collectionPagination.label",
  category: "collection",
  schema: collectionPaginationPropsSchema,
  defaults: { bindingId: "main", mode: "numbered" },
  fields: [
    { path: "bindingId", kind: "text", labelKey: "cms.blocks.collection.fields.bindingId" },
    {
      path: "mode",
      kind: "select",
      labelKey: "cms.blocks.collectionPagination.fields.mode",
      options: [
        { value: "numbered", labelKey: "cms.blocks.collectionPagination.options.numbered" },
        { value: "load-more", labelKey: "cms.blocks.collectionPagination.options.loadMore" },
      ],
    },
  ],
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
  client: true,
  supports: { style: ["width"], motion: true, visibility: true },
});
