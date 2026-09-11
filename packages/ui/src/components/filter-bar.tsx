import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 (tokens.md §3.2, §6.3) — the reference's filter
// toolbar, as layout only: rows that wrap (`flex-wrap gap-2`), stacked with
// `gap-2`, where each filter control takes an equal share with a 150px floor
// (`flex-1 min-w-37.5`). The controls themselves are the ordinary
// SearchInput / Combobox `size="sm"` / Button — this component owns spacing,
// never a second implementation of a control.
//
// Inside a DataTable, pass filters to its `filters` prop instead (ADR-044 #9:
// search and filters share one toolbar row); FilterBar is for pages whose
// filters sit above something other than a DataTable.

function FilterBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-bar"
      role="toolbar"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function FilterBarRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-bar-row"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

/** One filter's slot: an equal share of the row, never narrower than 150px. */
function FilterBarItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="filter-bar-item" className={cn("min-w-37.5 flex-1", className)} {...props} />
  );
}

export { FilterBar, FilterBarItem, FilterBarRow };
