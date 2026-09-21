"use client";

// The progress screen's tables, paged (changes-48 #4).
//
// Every row is already in the payload — the screen loads each list whole to
// draw its chart — so a page is a slice in state, not a round trip, and the
// pager is the site's one `ClientPagination`. Before this the lesson table
// silently stopped at fifteen rows and the others never stopped at all.
//
// A plain `Table` rather than `DataTable` on purpose (see page.tsx): every list
// is sorted by the question it answers, and a sort control invites an editor
// to reorder away from it.
import { ClientPagination, usePagedList } from "@repo/ui/components/client-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { SubText } from "@repo/ui/components/typography";

export const ANALYTICS_PAGE_SIZE = 10;

export interface AnalyticsPagerLabels {
  label: string;
  previous: string;
  next: string;
  morePages: string;
  /** "Page {page}" with the placeholder left in; filled per button. */
  page: string;
}

/**
 * It sits edge to edge in its card — the reference's table-in-card has no
 * content padding (tokens.md §3.2), so the cells' own 16px is the inset — and
 * scrolls sideways inside the card rather than making the page do it.
 */
export function AnalyticsTable({
  headers,
  rows,
  emptyLabel,
  pager,
  resetKey,
}: {
  headers: string[];
  rows: { key: string; cells: string[] }[];
  emptyLabel: string;
  pager: AnalyticsPagerLabels;
  /** The active filters: a new filter starts the table on page one. */
  resetKey: string;
}) {
  const { page, pageCount, pageItems, setPage } = usePagedList(rows, {
    pageSize: ANALYTICS_PAGE_SIZE,
    resetKey,
  });

  if (rows.length === 0) {
    return <SubText className="px-(--card-spacing)">{emptyLabel}</SubText>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={header} scope="col" className={index === 0 ? undefined : "text-end"}>
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((row) => (
            <TableRow key={row.key}>
              {row.cells.map((cell, index) => (
                <TableCell
                  key={index}
                  className={
                    index === 0 ? "font-medium" : "text-end tabular-nums text-muted-foreground"
                  }
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ClientPagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        className="px-(--card-spacing)"
        labels={{
          label: pager.label,
          previous: pager.previous,
          next: pager.next,
          morePages: pager.morePages,
          page: (n) => pager.page.replace("{page}", String(n)),
        }}
      />
    </div>
  );
}
