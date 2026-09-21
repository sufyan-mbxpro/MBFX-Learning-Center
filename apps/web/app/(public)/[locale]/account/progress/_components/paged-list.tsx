"use client";

// One page of a history band on `/account/progress` (changes-42).
//
// The rows are rendered on the SERVER and arrive here as finished elements, so
// this island owns only the page number: no row markup, no formatting, and no
// second request. The pager is the site's one client pager (`ClientPagination`,
// ADR-121 §2), so these bands page exactly as the learn shelves do.
import { ClientPagination, usePagedList } from "@repo/ui/components/client-pagination";
import { cn } from "@repo/ui/lib/utils";
import { ACCOUNT_PROGRESS_PAGE_SIZE } from "@repo/contracts";
import { usePaginationLabels } from "../../../learn/_lib/use-pagination-labels.ts";

export function PagedList({
  id,
  items,
  className,
  pageSize = ACCOUNT_PROGRESS_PAGE_SIZE,
}: {
  /** The list's id: the pager scrolls back to it when the reader changes page. */
  id: string;
  /** Finished `<li>` elements, each with its own key. */
  items: React.ReactNode[];
  className?: string;
  pageSize?: number;
}) {
  const labels = usePaginationLabels();
  const { page, pageCount, pageItems, setPage } = usePagedList(items, { pageSize });

  return (
    <div className="flex flex-col gap-4">
      {/* Keyed by page so each page fades up into place like the learn
          shelves' cards (changes-44 #1), rather than the rows swapping in a
          single frame. The id stays on the element across remounts. */}
      <ul
        key={page}
        id={id}
        className={cn(
          "scroll-mt-(--header-offset) motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
          className,
        )}
      >
        {pageItems}
      </ul>
      <ClientPagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        labels={labels}
        scrollTargetId={id}
      />
    </div>
  );
}
