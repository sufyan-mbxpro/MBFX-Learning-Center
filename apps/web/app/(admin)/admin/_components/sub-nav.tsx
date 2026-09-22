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
  /**
   * The prefix that makes this item active, when it is not `href` itself — a
   * section whose entry lands on one of its tabs (changes-51: Email opens on
   * Sender for an admin and on the log for `support`).
   */
  match?: string;
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
  const matchOf = (item: SubNavItem) => item.match ?? item.href;
  const activeHref = items
    .filter((item) =>
      item.exact
        ? pathname === item.href
        : pathname === matchOf(item) || pathname.startsWith(`${matchOf(item)}/`),
    )
    .toSorted((a, b) => matchOf(b).length - matchOf(a).length)[0]?.href;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        // Filled, bordered tray — the same treatment TabsList carries, so
        // a page's section tabs read as one control instead of a row of
        // links floating on the page background. `w-fit` on the horizontal
        // strip keeps it hugging its items now that it is visible; the
        // vertical settings sub-sidebar fills its column instead.
        "rounded-lg border border-border/60 bg-muted p-1",
        orientation === "horizontal"
          ? "flex w-fit max-w-full gap-1 overflow-x-auto"
          : "flex flex-col gap-1",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            // Full prefetch (ADR-140 §4). The admin routes are dynamic, and a
            // dynamic route's default prefetch stops at its first
            // `loading.tsx` — so every tab click rendered that skeleton, a
            // whole-page placeholder under a heading that never left, which
            // is the "reload" the owner kept seeing. `true` fetches the full
            // RSC payload as the strip enters the viewport and keeps it for
            // `staleTimes.static` (5 min); a mutation's `revalidateTag`
            // refreshes it. Production only — `next dev` never prefetches,
            // so the skeleton still shows there.
            prefetch={true}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // Active = a raised --background pill inside the muted tray.
              // (It used to be bg-muted on a transparent strip, which is
              // now the tray's own colour — indistinguishable.)
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
