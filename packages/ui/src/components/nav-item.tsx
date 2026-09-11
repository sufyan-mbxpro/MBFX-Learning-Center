import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 (tokens.md §6.12) — the reference's sidebar item:
// 40px, 13px medium (the `nav` type step), 16px icon, 8px gap, rounded-md,
// hover and active on the warm --accent (which the dark theme resolves to the
// muted surface, as the reference's own `dark:bg-muted` does). A trailing
// slot takes a CountBadge and/or a chevron; `justify-between` spreads them.
//
// It renders as whatever the caller passes (`render`): a router <Link> for a
// destination, a <button> for a group toggle — the recipe is identical, so an
// app sidebar never re-types it. `@repo/ui` stays router-free.

function NavItem({
  className,
  active = false,
  icon,
  trailing,
  children,
  render,
  ...props
}: useRender.ComponentProps<"a"> & {
  /** The current page (sets aria-current) or an open group. */
  active?: boolean;
  icon?: React.ReactNode;
  /** End-aligned extras: a CountBadge, a chevron. */
  trailing?: React.ReactNode;
}) {
  return useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        "aria-current": active ? "page" : undefined,
        className: cn(
          "inline-flex h-10 w-full items-center gap-2 rounded-md px-4 py-2 text-nav font-medium whitespace-nowrap transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
          active && "bg-accent text-accent-foreground",
          trailing ? "justify-between" : "justify-start",
          className,
        ),
        children: trailing ? (
          <>
            <span className="flex min-w-0 items-center gap-2">
              {icon}
              <span className="truncate">{children}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">{trailing}</span>
          </>
        ) : (
          <>
            {icon}
            <span className="truncate">{children}</span>
          </>
        ),
      },
      props,
    ),
  });
}

/** A group's children: indented 16px from the start, 4px apart. */
function NavItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="nav-item-group" className={cn("mt-1 space-y-1 ps-4", className)} {...props} />
  );
}

export { NavItem, NavItemGroup };
