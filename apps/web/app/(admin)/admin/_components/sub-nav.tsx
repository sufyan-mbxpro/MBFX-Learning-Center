"use client";

// Shared section sub-navigation (settings hub, articles area) — one active-
// state treatment instead of three diverging copies of the same classes.
// Horizontal lists scroll sideways on small screens instead of stacking
// above the content.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

export interface SubNavItem {
  href: string;
  label: string;
  /** Match exactly instead of by prefix (index entries). */
  exact?: boolean;
}

export function SubNav({
  items,
  orientation = "horizontal",
  className,
  "aria-label": ariaLabel,
}: {
  items: SubNavItem[];
  orientation?: "horizontal" | "vertical";
  className?: string;
  "aria-label"?: string;
}) {
  const pathname = usePathname();

  // Longest matching prefix wins, so "/admin/articles" isn't also active on
  // "/admin/articles/categories"; `exact` entries only match their own URL.
  const activeHref = items
    .filter((item) =>
      item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .toSorted((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        orientation === "horizontal" ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-1",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
