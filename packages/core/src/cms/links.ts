// The `LinkTarget` resolver (ADR-031 §2) — the one function every authored
// link and `buildNavigation` share. Targets are grouped by type and each
// group is resolved with one read (never one query per link); entity types
// (`ARTICLE`, `COURSE`, …) join once their providers land in Phase 4 —
// today they resolve to `missing` rather than guessing, which is the
// honest state until there is a provider to ask.
import { isRouteKey, publicPagePath, ROUTE_PATHS } from "@repo/contracts";
import type { LinkTarget, ResolvedLink } from "@repo/contracts";
import { db } from "@repo/db";
import { loadMediaAsset } from "../media.ts";
import { getDefaultLocale } from "./paths.ts";

async function resolvePageTargets(
  pageIds: string[],
  locale: string,
  defaultLocale: string,
): Promise<Map<string, ResolvedLink>> {
  const result = new Map<string, ResolvedLink>();
  if (pageIds.length === 0) return result;

  const rows = await db.pageTranslation.findMany({
    where: { pageId: { in: pageIds }, locale },
    select: {
      pageId: true,
      path: true,
      page: { select: { publishedVersionId: true, deletedAt: true, isActive: true } },
    },
  });
  const byPageId = new Map(rows.map((r) => [r.pageId, r]));

  for (const pageId of pageIds) {
    const row = byPageId.get(pageId);
    if (!row || row.page.deletedAt || !row.page.isActive) {
      result.set(pageId, { href: null, state: "missing" });
    } else if (!row.page.publishedVersionId) {
      result.set(pageId, { href: null, state: "unpublished" });
    } else {
      result.set(pageId, { href: publicPagePath(locale, defaultLocale, row.path), state: "ok" });
    }
  }
  return result;
}

async function resolveMediaTargets(assetIds: string[]): Promise<Map<string, ResolvedLink>> {
  const result = new Map<string, ResolvedLink>();
  if (assetIds.length === 0) return result;

  const assets = await Promise.all(assetIds.map((id) => loadMediaAsset(id)));
  assetIds.forEach((id, i) => {
    const asset = assets[i];
    result.set(
      id,
      asset ? { href: asset.url, state: "ok", download: true } : { href: null, state: "missing" },
    );
  });
  return result;
}

/**
 * The cases that need no I/O at all — `URL`/`ROUTE`/`ANCHOR`/`NONE`. Shared
 * with `../navigation.ts`'s `resolveHref` (`buildNavigation` "calls it" for
 * its existing `ROUTE`/`URL` rows, plan §12 PR 2.6) so the two never drift,
 * without forcing `assembleNavigation` — deliberately pure and synchronous,
 * exercised directly by ~20 cases in `navigation.integration.test.ts` — to
 * become async. `PAGE`/`MEDIA`/entity types return `null`: they need a
 * batched lookup only `resolveLinks` below has the inputs for, and Phase
 * 6's `MenuItem` gaining those target types is the point at which
 * `buildNavigation` itself needs to become async — a real, scoped Phase 6
 * change, not something to pre-build here on speculation.
 */
export function resolveStatelessLinkTarget(target: LinkTarget): ResolvedLink | null {
  switch (target.type) {
    case "URL":
      return { href: target.url, state: "ok" };
    case "ROUTE":
      return isRouteKey(target.routeKey)
        ? { href: ROUTE_PATHS[target.routeKey], state: "ok" }
        : { href: null, state: "missing" };
    case "ANCHOR":
      return { href: `#${target.anchor}`, state: "ok" };
    case "NONE":
      return { href: null, state: "ok" };
    default:
      return null;
  }
}

function resolveOne(
  target: LinkTarget,
  pageMap: Map<string, ResolvedLink>,
  mediaMap: Map<string, ResolvedLink>,
): ResolvedLink {
  const stateless = resolveStatelessLinkTarget(target);
  if (stateless) return stateless;

  if (target.type === "PAGE") {
    const resolved = pageMap.get(target.pageId) ?? { href: null, state: "missing" };
    return target.anchor && resolved.state === "ok" && resolved.href
      ? { ...resolved, href: `${resolved.href}#${target.anchor}` }
      : resolved;
  }
  if (target.type === "MEDIA") {
    return mediaMap.get(target.assetId) ?? { href: null, state: "missing" };
  }
  // Entity targets (ARTICLE, COURSE, …): no provider exists yet (ADR-022
  // lands Phase 4). `missing` is honest — there is nothing to resolve
  // against today, never a guessed href.
  return { href: null, state: "missing" };
}

/**
 * Deduped targets in, results in the SAME order out (the shape
 * `@repo/blocks`' `renderTree` and `buildNavigation` both call against).
 * One read per type present in `targets` — a page with N links across T
 * types issues at most T reads on a cold miss (ADR-031's query-count test).
 */
export async function resolveLinks(
  targets: LinkTarget[],
  params: { locale: string },
): Promise<ResolvedLink[]> {
  const pageIds = [...new Set(targets.filter((t) => t.type === "PAGE").map((t) => t.pageId))];
  const assetIds = [...new Set(targets.filter((t) => t.type === "MEDIA").map((t) => t.assetId))];

  // No query at all when only stateless targets are present (ADR-029 §4's
  // "a global part must never issue an uncached query" discipline extends
  // here: a header full of ROUTE/URL links costs zero reads).
  const [defaultLocale, mediaMap] = await Promise.all([
    pageIds.length > 0 ? getDefaultLocale() : Promise.resolve(params.locale),
    resolveMediaTargets(assetIds),
  ]);
  const pageMap = await resolvePageTargets(pageIds, params.locale, defaultLocale);

  return targets.map((target) => resolveOne(target, pageMap, mediaMap));
}
