"use client";

import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 — the reference's table (tokens.md §6.9), which the
// capture shows is shadcn `default` exactly (capture-2): 48px header cells in
// muted medium text, 16px body padding, border-b rows with a muted hover.
//
// Two densities, both measured from the reference and switched by one
// attribute on <table> so a whole table changes together:
//   default — p-4 cells, text-sm (the reference's simple tables in cards)
//   compact — px-2.5 py-2 cells at 11px (its Users Directory list)
// The header stays h-12 in both, as the reference keeps it.

type TableDensity = "default" | "compact";

function Table({
  className,
  density = "default",
  ...props
}: React.ComponentProps<"table"> & { density?: TableDensity }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        data-density={density}
        className={cn("group/table w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      // The header row does not take the row hover — a header is not a row
      // (changes-08 #7). Whether the band is FILLED is the caller's choice:
      // the reference leaves simple tables unfilled and fills its dense
      // admin lists (`bg-muted/50`), which is what DataTable passes.
      className={cn("[&_tr]:border-b [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-12 px-4 text-start align-middle font-medium whitespace-nowrap text-muted-foreground group-data-[density=compact]/table:px-2.5 group-data-[density=compact]/table:py-2 group-data-[density=compact]/table:text-2xs [&:has([role=checkbox])]:pe-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-4 align-middle whitespace-nowrap group-data-[density=compact]/table:px-2.5 group-data-[density=compact]/table:py-2 group-data-[density=compact]/table:text-2xs [&:has([role=checkbox])]:pe-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
export type { TableDensity };
