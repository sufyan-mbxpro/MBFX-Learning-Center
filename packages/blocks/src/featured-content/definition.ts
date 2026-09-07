// A `collection` variant for a "hero + list" treatment (plan v2.2 §12
// PR 4.2's own block list; not in ADR-022 §3's abridged table, so this is
// a judgment call: same generic content-type/binding mechanism as
// `collection`, distinct only in its fixed small limit and its render —
// one large lead item, the rest as a compact list. No admin-facing
// "featured" flag exists anywhere in this repo's data model (`Article` has
// no `isFeatured` column) — this block highlights the FIRST result of
// whatever query it's given (e.g. "newest" sort), it does not select
// editorially-pinned items. Naming that limitation here rather than
// pretending a curation feature exists.
import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const featuredContentPropsSchema = z.object({
  contentType: z.string().trim().min(1).max(60),
  bindingId: z.string().trim().min(1).max(60).default("main"),
  filter: z.record(z.string(), z.string()).default({}),
  sort: z.string().trim().max(60).optional(),
  limit: z.int().min(2).max(6).default(4),
  /** ADR-023: see `collection`'s own field for the fallback contract. */
  cardTemplateId: z.string().trim().min(1).optional(),
});
export type FeaturedContentProps = z.infer<typeof featuredContentPropsSchema>;

export const definition = defineBlock<FeaturedContentProps>({
  type: "featured-content",
  version: 2,
  labelKey: "cms.blocks.featuredContent.label",
  category: "collection",
  schema: featuredContentPropsSchema,
  defaults: { contentType: "news", bindingId: "main", filter: {}, limit: 4 },
  // v1 → v2 (PR 4.3): `cardTemplateId` added, optional — see collection/
  // definition.ts's identical migration note.
  migrate: { 1: (old) => old },
  fields: [
    { path: "contentType", kind: "text", labelKey: "cms.blocks.collection.fields.contentType" },
    { path: "bindingId", kind: "text", labelKey: "cms.blocks.collection.fields.bindingId" },
    { path: "filter", kind: "json", labelKey: "cms.blocks.collection.fields.filter" },
    { path: "sort", kind: "text", labelKey: "cms.blocks.collection.fields.sort" },
    { path: "limit", kind: "number", labelKey: "cms.blocks.collection.fields.limit" },
    {
      path: "cardTemplateId",
      kind: "text",
      labelKey: "cms.blocks.collection.fields.cardTemplateId",
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
  supports: { style: ["padding", "width"], motion: true, visibility: true },
});
