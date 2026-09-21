"use client";

// A pager that pages a list already in the payload (changes-37, ADR-121 §2).
//
// The learn shelves hold every course, quiz and video topic of a track in one
// cached page, and filter them in `useState` for the reason D26 gives: reading
// `searchParams` would make a public route dynamic (architecture.md #6). A
// pager over the same list is the same decision — `?page=2` on a shelf of
// thirty cards is a round trip and a cache entry to show six of them, and the
// owner asked for paging that "works without page loading".
//
// ─── It looks exactly like the /news pager, on purpose ───────────────────
//
// "The pagination buttons & style should be same for the whole site." /news
// pages by NAVIGATING and keeps doing so (a news page is an indexable URL), so
// there are two mechanisms — and one appearance. This file renders the same
// `Pagination` / `PaginationContent` / `PaginationItem` frame and the same
// Button variants and sizes `PaginationLink` resolves to (outlined 36px
// Previous/Next, ghost page numbers, the current page outlined), and both
// pagers take their window from `@repo/ui/lib/pagination`. The difference is
// the element: a `<button>` that sets state, rather than a link.
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Pagination, PaginationContent, PaginationItem } from "@repo/ui/components/pagination";
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  pageCountFor,
  pageSlice,
  pageWindow,
} from "@repo/ui/lib/pagination";

export interface ClientPaginationLabels {
  /** The nav landmark's name. */
  label: string;
  previous: string;
  next: string;
  /** Stands in for a run of hidden page numbers, for a screen reader. */
  morePages: string;
  /** The accessible name of a page-number button, e.g. "Page 3". */
  page: (page: number) => string;
}

/**
 * One page of `items`, and the state to move between pages.
 *
 * `resetKey` is whatever the list is FILTERED by. When it changes the reader
 * is back on page one — a filter that leaves them on page four of a list that
 * now has one page shows nothing and explains nothing. It is compared during
 * render (React's "adjusting state when a prop changes" pattern), so there is
 * no effect and no frame in which the stale page paints.
 */
export function usePagedList<T>(
  items: readonly T[],
  { pageSize = DEFAULT_PAGE_SIZE, resetKey }: { pageSize?: number; resetKey?: unknown } = {},
) {
  const [state, setState] = useState<{ page: number; key: unknown }>({ page: 0, key: resetKey });
  const current = Object.is(state.key, resetKey) ? state.page : 0;
  if (!Object.is(state.key, resetKey)) setState({ page: 0, key: resetKey });

  const pageCount = pageCountFor(items.length, pageSize);
  const page = clampPage(current, pageCount);

  return {
    page,
    pageCount,
    pageItems: pageSlice(items, page, pageSize),
    /** The absolute index of the first item on this page — for stagger delays and keys. */
    offset: page * pageSize,
    setPage: (next: number) => setState({ page: clampPage(next, pageCount), key: resetKey }),
  };
}

function ClientPagination({
  page,
  pageCount,
  onPageChange,
  labels,
  /**
   * The element to bring back into view after a page change, by id. Only
   * scrolled when its top has gone above the viewport: a reader who pressed
   * "Next" at the foot of a tall grid should land on the first new card, and
   * one who pressed it with the whole grid on screen should not see the page
   * jump.
   */
  scrollTargetId,
  className,
}: {
  /** Zero-based, matching `usePagedList` and @repo/core's listing options. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  labels: ClientPaginationLabels;
  scrollTargetId?: string;
  className?: string;
}) {
  // One page is not a pager — the `NumberedPagination` rule.
  if (pageCount <= 1) return null;

  function go(next: number) {
    onPageChange(next);
    if (!scrollTargetId) return;
    const target = document.getElementById(scrollTargetId);
    if (target && target.getBoundingClientRect().top < 0) {
      target.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  }

  return (
    <Pagination aria-label={labels.label} className={className}>
      <PaginationContent>
        {/* Absent rather than disabled at either end, like the /news pager:
            the page numbers already say where the reader is. */}
        {page > 0 && (
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={labels.previous}
              onClick={() => go(page - 1)}
            >
              <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
              <span className="hidden sm:inline">{labels.previous}</span>
            </Button>
          </PaginationItem>
        )}

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <span
                aria-hidden
                data-slot="pagination-ellipsis"
                className="flex size-9 items-center justify-center"
              >
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">{labels.morePages}</span>
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <Button
                type="button"
                variant={entry === page ? "outline" : "ghost"}
                size="icon-sm"
                className="tabular-nums"
                aria-label={labels.page(entry + 1)}
                // `aria-current="page"` is what a screen reader announces as
                // "current page" on a pager, whether it links or not.
                aria-current={entry === page ? "page" : undefined}
                data-active={entry === page}
                onClick={() => go(entry)}
              >
                {/* Zero-based internally, one-based for humans. */}
                {entry + 1}
              </Button>
            </PaginationItem>
          ),
        )}

        {page + 1 < pageCount && (
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={labels.next}
              onClick={() => go(page + 1)}
            >
              <span className="hidden sm:inline">{labels.next}</span>
              <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
            </Button>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}

export { ClientPagination };
