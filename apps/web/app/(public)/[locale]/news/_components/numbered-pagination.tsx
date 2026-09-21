// Numbered pagination (changes-03-plan.md §1.3 #5, §6.3) — replaces the
// prev/next-only ListingPagination on the listing surfaces.
//
// Composes @repo/ui's Pagination primitives with next-intl's locale-aware
// <Link> via each part's `render` prop, so routing stays an app concern and
// @repo/ui keeps no dependency on the router (architecture.md #10).
//
// changes-37 (ADR-121 §2): the page window and every string are shared with
// `ClientPagination`, the learn shelves' pager, so the site has one pager
// appearance over two mechanisms. This one still NAVIGATES — a news page is a
// real, indexable URL. Since changes-39 each link is a `ListingLink`, so the
// navigation swaps the listing band in place instead of reading as a reload.
import { getTranslations } from "next-intl/server";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import { pageWindow } from "@repo/ui/lib/pagination";
import { ListingLink } from "./listing-navigation.tsx";

/** Preserves an active `q` so paging through search results keeps the query. */
function hrefFor(basePath: string, page: number, query?: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 0) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

export async function NumberedPagination({
  basePath,
  page,
  pageCount,
  query,
}: {
  basePath: string;
  /** Zero-based, matching @repo/core's listing options. */
  page: number;
  pageCount: number;
  query?: string;
}) {
  const t = await getTranslations("common.pagination");
  if (pageCount <= 1) return null;

  return (
    <Pagination aria-label={t("label")}>
      <PaginationContent>
        {page > 0 && (
          <PaginationItem>
            <PaginationPrevious
              text={t("previous")}
              aria-label={t("previous")}
              render={<ListingLink href={hrefFor(basePath, page - 1, query)} />}
            />
          </PaginationItem>
        )}

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis label={t("morePages")} />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink
                isActive={entry === page}
                render={<ListingLink href={hrefFor(basePath, entry, query)} />}
              >
                {/* Zero-based internally, one-based for humans. */}
                {entry + 1}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        {page + 1 < pageCount && (
          <PaginationItem>
            <PaginationNext
              text={t("next")}
              aria-label={t("next")}
              render={<ListingLink href={hrefFor(basePath, page + 1, query)} />}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
