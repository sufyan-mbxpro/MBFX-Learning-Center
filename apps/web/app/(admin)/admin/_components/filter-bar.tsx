import { cn } from "@repo/ui/lib/utils";

// A screen's custom filters as ONE group (changes-05 #2, changes-08 #7).
//
// This is meant to be handed to `DataTable`'s `filters` prop, which drops
// it into the table's own toolbar beside the search box — so search and
// filters share one horizontal row and wrap together, instead of the
// filters sitting in a separate bar above the table. Rendering it as a
// standalone row above a table is the layout changes-08 #7 replaced.
export function FilterBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} data-slot="filter-bar">
      {children}
    </div>
  );
}
