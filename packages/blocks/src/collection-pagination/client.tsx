// Client-driven navigation (`window.location`), same family as
// collection-search/-sort/-filter — and the same real, named trade-off:
// page links are JS `onClick` handlers, not crawlable `<a href>`s, because
// building a correct href needs the CURRENT request's search params, which
// only exist server-side and aren't threaded into `BlockComponentProps`
// today. `/news`'s own `NumberedPagination` (a route-specific component,
// not a CMS block) still uses real server-rendered links — this is a
// regression from that for CMS-authored collection pages specifically,
// worth revisiting once a real need for crawlable pagination shows up
// (thread `searchParams` through `BlockComponentProps`, same as `locale`).
//
// Split from `index.tsx` — see collection-search/client.tsx's comment for
// why: `index.tsx`'s `registerBlock()` needs to run server-side, and a
// "use client" file's own top-level code never does when imported there.
"use client";

import { useEffect, useState } from "react";
import type { CollectionListResult } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import type { BlockComponentProps } from "../registry.ts";
import type { CollectionPaginationProps } from "./definition.ts";

function namespacedKey(bindingId: string, key: string): string {
  return bindingId === "main" ? key : `${bindingId}.${key}`;
}

function goToPage(pageKey: string, page: number) {
  const params = new URLSearchParams(window.location.search);
  if (page > 0) params.set(pageKey, String(page));
  else params.delete(pageKey);
  const query = params.toString();
  window.location.href = query ? `${window.location.pathname}?${query}` : window.location.pathname;
}

export function CollectionPaginationBlock({
  props,
  resolvedData,
}: BlockComponentProps<CollectionPaginationProps>) {
  const result = resolvedData?.[props.bindingId] as CollectionListResult | undefined;
  const pageKey = namespacedKey(props.bindingId, "page");
  const [currentPage, setCurrentPage] = useState(result?.page ?? 0);

  useEffect(() => {
    const fromUrl = Number(new URLSearchParams(window.location.search).get(pageKey));
    setCurrentPage(Number.isFinite(fromUrl) && fromUrl >= 0 ? fromUrl : (result?.page ?? 0));
  }, [pageKey, result?.page]);

  if (!result || result.limit <= 0) return null;
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit));
  if (pageCount <= 1) return null;

  if (props.mode === "load-more") {
    if (currentPage + 1 >= pageCount) return null;
    return (
      <div className="flex justify-center">
        <Button type="button" variant="outline" onClick={() => goToPage(pageKey, currentPage + 1)}>
          Load more
        </Button>
      </div>
    );
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage === 0}
        onClick={() => goToPage(pageKey, currentPage - 1)}
      >
        Previous
      </Button>
      <span className="px-3 text-sm text-muted-foreground">
        {currentPage + 1} / {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage + 1 >= pageCount}
        onClick={() => goToPage(pageKey, currentPage + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
