import { cn } from "@repo/ui/lib/utils";

// One row for search + custom filters (changes-05 #2): every filter toolbar
// in admin (users, articles, …) wraps its Selects in this exact
// flex-wrap/gap so filters sit on one row when the screen allows and wrap
// cleanly on narrow ones, instead of each page re-declaring the className.
export function FilterBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
