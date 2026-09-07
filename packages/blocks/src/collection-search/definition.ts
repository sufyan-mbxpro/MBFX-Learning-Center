// A pure client-side URL control (ADR-022 §3) — no `needs()`, no live data:
// it names the `bindingId` it drives and writes `[ns.]q` on submit. Every
// provider today understands one unified `q` (`CollectionQuery.q`), so
// ADR-022 §3's abridged `fields` prop (implying per-field search) would be
// UI for a capability no provider offers — left out rather than faked.
// `placeholder` is a translatable authored prop, not a catalog key (ADR-022
// §3's illustrative `placeholderKey` would be this repo's only content
// block using an i18n key for admin-authored text — every other block
// here, heading/paragraph/button included, authors its own text as a
// translatable prop; matching that real precedent, not the abridged table).
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const collectionSearchPropsSchema = z.object({
  bindingId: z.string().trim().min(1).max(60).default("main"),
  placeholder: z.string().trim().max(120).default("Search…"),
});
export type CollectionSearchProps = z.infer<typeof collectionSearchPropsSchema>;

export const definition = defineBlock<CollectionSearchProps>({
  type: "collection-search",
  version: 1,
  labelKey: "cms.blocks.collectionSearch.label",
  category: "collection",
  schema: collectionSearchPropsSchema,
  defaults: { bindingId: "main", placeholder: "Search…" },
  fields: [
    { path: "bindingId", kind: "text", labelKey: "cms.blocks.collection.fields.bindingId" },
    {
      path: "placeholder",
      kind: "text",
      labelKey: "cms.blocks.common.fields.text",
      translatable: true,
    },
  ],
  translatable: ["placeholder"],
  client: true,
  supports: { style: ["width"], motion: true, visibility: true },
});
