// Numbered pagination (changes-03-plan.md §1.3 #5, §6.3) — replaces the
// prev/next-only ListingPagination on the listing surfaces.
//
// Composes @repo/ui's Pagination primitives with next-intl's locale-aware
// <Link> via each part's `render` prop, so routing stays an app concern and
// @repo/ui keeps no dependency on the router (architecture.md #10).
import { getTranslations } from "next-intl/server";
import { Link } from "@repo/i18n/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";

/**
 * Which page numbers to show: always the first and last, plus a window
 * around the current one, with ellipses standing in for the gaps.
 */
function pageWindow(current: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);

  const pages = new Set<number>([0, pageCount - 1, current]);
  for (const offset of [-1, 1]) {
    const page = current + offset;
    if (page > 0 && page < pageCount - 1) pages.add(page);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous: number | null = null;
  for (const page of sorted) {
    if (previous !== null && page - previous > 1) out.push("gap");
    out.push(page);
    previous = page;
  }
  return out;
}

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
  const t = await getTranslations("news");
  if (pageCount <= 1) return null;

  return (
    <Pagination aria-label={t("paginationLabel")}>
      <PaginationContent>
        {page > 0 && (
          <PaginationItem>
            <PaginationPrevious
              text={t("previousPage")}
              render={<Link href={hrefFor(basePath, page - 1, query)} />}
            />
          </PaginationItem>
        )}

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink
                isActive={entry === page}
                render={<Link href={hrefFor(basePath, entry, query)} />}
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
              text={t("nextPage")}
              render={<Link href={hrefFor(basePath, page + 1, query)} />}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
