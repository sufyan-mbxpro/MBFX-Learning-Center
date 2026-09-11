import { NextResponse } from "next/server";
import { listMediaAssetsQuerySchema } from "@repo/contracts";
import { getMediaFacets, getRecentlyUsedMedia, listMediaAssets } from "@repo/core";
import { requirePermission } from "@repo/rbac";

// The media browser's read endpoint (ADR-067 §2). A GET route handler rather
// than a server action, for four reasons the ADR records: it is abortable
// (typing in search must cancel the request in flight), it is not serialised
// per client the way action calls are, a GET can carry a cache header
// honestly, and it is a read.
//
// ONE request opens a picker: `include=facets,recent` folds the chrome into
// the first page's response, and every later request (tab, search, next page)
// carries rows only.
//
// `requirePermission` runs first and is the boundary — the proxy's STAFF gate
// on /admin/* is a gate, not a guarantee (security.md #3), and every
// parameter is parsed through @repo/contracts rather than cast
// (security.md #6). There is no way to ask this endpoint for the whole
// library: `limit` clamps in the schema (ADR-067 §1).

export async function GET(request: Request): Promise<NextResponse> {
  await requirePermission("media.view");

  const params = new URL(request.url).searchParams;
  const parsed = listMediaAssetsQuerySchema.safeParse({
    category: params.get("category") ?? undefined,
    folder: params.get("folder") ?? undefined,
    kind: params.get("kind") ?? undefined,
    // Repeated `kinds` params are how a multi-kind picker asks; a single one
    // still arrives as an array through the schema's own normalisation.
    kinds: params.getAll("kinds").length > 0 ? params.getAll("kinds") : undefined,
    q: params.get("q") ?? undefined,
    tag: params.get("tag") ?? undefined,
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ?? undefined,
    include: params.get("include") ?? undefined,
    sourceType: params.get("sourceType") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid media query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { include, sourceType, ...filter } = parsed.data;
  const [page, facets, recent] = await Promise.all([
    listMediaAssets({ ...filter, query: filter.q }),
    include.facets ? getMediaFacets() : Promise.resolve(undefined),
    include.recent
      ? getRecentlyUsedMedia({ sourceType, kinds: filter.kinds })
      : Promise.resolve(undefined),
  ]);

  return NextResponse.json(
    { ...page, facets, recent },
    {
      headers: {
        // Private: the response is permission-scoped. Short: an upload from
        // another tab should show up on the next open, not in half an hour.
        "Cache-Control": "private, max-age=30",
      },
    },
  );
}
