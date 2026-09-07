// Builds the `RenderContext` every real page render passes to
// `renderTree()` (ADR-020: providers/visibility/links arrive by injection,
// never by `@repo/blocks` importing `@repo/rbac`/`@repo/settings`/`@repo/db`
// itself). One place, reused by every route that renders a CMS page.
import { cacheLife, cacheTag } from "next/cache";
import { evaluateVisibility } from "@repo/settings";
import type { Subject } from "@repo/rbac";
import { getCardTemplateConfig, getMediaUrls, resolveLinks } from "@repo/core";
import type { BlockDataNeed } from "@repo/blocks";
import type { RenderContext } from "@repo/blocks/render";
import {
  buildCollectionSearchSchema,
  COLLECTION_LIMIT_MAX,
  COLLECTION_PAGE_MAX,
} from "@repo/contracts";
import { collectionProviders, widgets } from "./registry.ts";

/**
 * One provider call, cached by its own (already-normalised) arguments — the
 * "per-need caching keyed by the normalised query" plan v2.2 §12 PR 4.2
 * asks for. `scope: "page"` (URL-param page collections, ADR-029 §2) is the
 * only kind Phase 4 produces; a `"part"` (global site part) need would
 * cache differently (grouped, not per-need) — that is Phase 6's concern,
 * not built here.
 */
async function resolveCollectionNeed(
  providerKey: string,
  query: unknown,
  locale: string,
): Promise<unknown> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  const provider = collectionProviders[providerKey];
  if (!provider) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockDataNeed.query is `unknown` by design (registry.ts); the provider's own schema is the real validation boundary.
  return provider.list(query as any, { locale });
}

/** Next's `searchParams` prop can hand back a `string[]` for a repeated key; every collection-query field is single-valued, so only the first value is kept — the same posture `publicArticleSearchSchema`'s route-level parsing already takes. */
export function flattenSearchParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) flat[key] = first;
  }
  return flat;
}

export function buildRenderContext(params: {
  locale: string;
  draft: boolean;
  subject: Subject | null;
  /** Flattened `searchParams` for the current request — first value only where Next would otherwise hand back an array. Defaults to none (the composer's canvas preview and the CMS home fallback don't have a request to read from). */
  searchParams?: Record<string, string>;
}): RenderContext {
  const searchParams = params.searchParams ?? {};

  return {
    locale: params.locale,
    draft: params.draft,
    isVisible: (visibility) => {
      // TODO(Module 16, feature-gated pages): `requiresFeature` needs a
      // cached flag lookup (the shape `navigation.ts`'s `loadMenuData`
      // already has) once a page/block actually sets it — nothing in
      // Phase 2's content does, so it is not wired here yet.
      return evaluateVisibility(visibility ?? "PUBLIC", params.subject);
    },
    resolveNeeds: (needs: BlockDataNeed[]) =>
      Promise.all(
        needs.map((need) => resolveCollectionNeed(need.provider, need.query, params.locale)),
      ),
    resolveLinks: (targets) => resolveLinks(targets, { locale: params.locale }),
    resolveMediaUrls: (assetIds) => getMediaUrls(assetIds),
    // ADR-023, PR 4.3: `getCardTemplateConfig` is itself the cached,
    // tagged (`card-template:{id}`) read — this just batches the N ids a
    // page's collection blocks named into one Promise.all, same shape as
    // `resolveMediaUrls`. A deleted/missing id resolves to an absent key,
    // never a throw — the block falls back to its own default render.
    resolveCardTemplates: async (ids) => {
      const entries = await Promise.all(
        ids.map(async (id) => [id, await getCardTemplateConfig(id)] as const),
      );
      const result: Record<string, { variant: string; config: unknown }> = {};
      for (const [id, row] of entries) if (row) result[id] = row;
      return result;
    },
    widgets,
    // ADR-022 §4: authored defaults merged with the request's search
    // params, namespaced by `bindingId` for every binding but the default
    // "main" (clean URLs for the overwhelmingly common single-collection
    // page), hard caps applied last regardless of what either side asked
    // for. An unknown filter key simply never reaches a provider that
    // reads it — providers only ever look up the keys they declared, so
    // there is nothing to strip here.
    resolveBindingQuery: ({ contentType, bindingId, filter, sort, limit }) => {
      const provider = collectionProviders[contentType];
      const namespace = bindingId === "main" ? undefined : bindingId;
      const prefix = namespace ? `${namespace}.` : "";
      if (!provider) {
        return {
          contentType,
          bindingId,
          filter,
          sort,
          page: 0,
          limit: Math.min(limit, COLLECTION_LIMIT_MAX),
        };
      }
      const schema = buildCollectionSearchSchema(provider, namespace);
      const parsed = schema.safeParse(searchParams);
      const parsedData: Record<string, unknown> = parsed.success ? parsed.data : {};

      const resolvedFilter: Record<string, string> = { ...filter };
      for (const f of provider.filters) {
        const value = parsedData[`${prefix}${f.key}`];
        if (typeof value === "string") resolvedFilter[f.key] = value;
      }

      return {
        contentType,
        bindingId,
        filter: resolvedFilter,
        sort: (parsedData[`${prefix}sort`] as string | undefined) ?? sort,
        page: Math.min(
          (parsedData[`${prefix}page`] as number | undefined) ?? 0,
          COLLECTION_PAGE_MAX,
        ),
        limit: Math.min(
          (parsedData[`${prefix}limit`] as number | undefined) ?? limit,
          COLLECTION_LIMIT_MAX,
        ),
        q: parsedData[`${prefix}q`] as string | undefined,
      };
    },
  };
}
