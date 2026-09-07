// A leaf module on purpose: `registry.ts` and `widgets.ts` both need this
// shape and must not import each other (registry.ts needs `WidgetMap` from
// widgets.ts for the `needs` callback's context; widgets.ts needs
// `BlockDataNeed` for `WidgetDefinition.needs`'s return type — putting the
// need shape here breaks what would otherwise be a two-file cycle).
export interface BlockDataNeed {
  /** Registry key of a `CollectionProvider`/`DataProvider`/widget data source. */
  provider: string;
  /** Provider-specific, normalised query — identical `(provider, query)` pairs dedupe to one resolution. */
  query: unknown;
  /** Names which collection block a resolved list should bind to, for collection-filter/search/sort/pagination (ADR-022 §4). */
  bindingId?: string;
  /** Grouped (site parts) vs per-need (URL-param page collections) resolution, ADR-029 §2 — decided by the caller that injects `RenderContext.resolveNeeds`, carried here only so that caller can tell needs apart. */
  scope: "page" | "part";
}
