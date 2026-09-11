"use client";

// The Learn area's section tabs (changes-11 PR 4.0, D25).
//
// Modelled on `about/_components/section-nav.tsx`, which the plan names as the
// pattern to follow, and client for the same single reason: the active entry
// needs `usePathname`, and the layout that renders this is cached (ADR-004),
// so it cannot know the current route.
//
// Two differences from the About strip, both forced by this section's shape:
//
//   1. **Longest-prefix matching would be wrong here.** `/learn/<track>` is
//      the parent of `/learn/<track>/[course]` AND of
//      `/learn/<track>/quizzes`, so a plain prefix rule lights up Courses
//      while the reader is on a quiz. Courses therefore matches the track
//      index and its course/lesson descendants but yields to any OTHER
//      registered section whose href is a longer prefix of the path.
//   2. **It is PINNED below the site header (ADR-065 §5).** A lesson is the
//      longest page on the site and the one a reader most often leaves
//      mid-way, so the strip has to stay reachable. It offsets on
//      `--header-offset`, which `StickyHeaderShell` measures — the header
//      stack's height is a setting, not a constant, so a literal `top-16`
//      would tuck this bar under the header the day the announcement bar is
//      switched on.
import { Link, usePathname } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { cn } from "@repo/ui/lib/utils";
import { MEGA_MENU_ICONS, routeKeyForHref } from "../../_nav/mega-menu.ts";
import { activeSectionHref } from "../_nav/learn-sections.ts";

export interface LearnSectionNavItem {
  href: string;
  label: string;
}

export function LearnSectionNav({
  items,
  ariaLabel,
}: {
  items: LearnSectionNavItem[];
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const activeHref = activeSectionHref(
    pathname,
    items.map((item) => item.href),
  );

  return (
    // z-30, one below the header's z-40: the two never overlap, but when a
    // dropdown opens in the header it must pass OVER this bar, not under it.
    <div className="sticky top-(--header-offset) z-30 border-b border-border/70 bg-background/95 shadow-xs backdrop-blur-md">
      <Container>
        {/* Scrolls sideways below sm rather than wrapping: three entries with
            icons still fit most phones, but the strip must not push the page
            down by a whole row on the narrowest ones. */}
        <nav aria-label={ariaLabel} className="-mx-4 overflow-x-auto px-4">
          <ul className="flex w-max items-center gap-1 py-2">
            {items.map((item) => {
              const isActive = item.href === activeHref;
              const routeKey = routeKeyForHref(item.href);
              const Icon = routeKey ? MEGA_MENU_ICONS[routeKey] : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap ring-1 ring-transparent transition-[background-color,color,box-shadow] duration-(--duration-base) ease-(--ease-out-quint) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                      isActive
                        ? "bg-background text-foreground shadow-sm ring-border"
                        : "text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm hover:ring-primary/25",
                    )}
                  >
                    {Icon && (
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-4 transition-colors duration-(--duration-base)",
                          isActive
                            ? "text-primary-interactive"
                            : "group-hover:text-primary-interactive",
                        )}
                      />
                    )}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Container>
    </div>
  );
}
