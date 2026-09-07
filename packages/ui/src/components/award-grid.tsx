// The awards grid (changes-09-plan.md §2). Its whole job beyond layout is
// ADR-047 §2's rule: with no children it renders NOTHING — no <ul>, no
// heading slot, no empty grid. An unearned or absent award must leave no
// trace on the page.
import { Children } from "react";

import { cn } from "@repo/ui/lib/utils";

function AwardGrid({ children, className, ...props }: React.ComponentProps<"ul">) {
  if (Children.count(children) === 0) return null;

  return (
    <ul
      data-slot="award-grid"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
      {...props}
    >
      {children}
    </ul>
  );
}

export { AwardGrid };
