"use client";

// The About section's own sub-navigation — the icon strip every reference
// page carries under the header (changes-09-plan.md §1.1 row 1).
//
// Client only for `usePathname`: the active entry needs the current route,
// and the layout that renders this is cached (ADR-004), so it cannot know
// it. Same longest-prefix rule as the admin `SubNav`, so `/about` does not
// light up while you are on `/about/why-us`.
//
// Horizontally scrollable below sm rather than wrapping to two rows: five
// entries with icons do not fit a phone, and a wrapped strip pushes the
// page content down by a whole row on the narrowest screens.
//
// Icons are resolved HERE, from the same registry the mega-menu panel uses,
// rather than passed in: an icon is a function component, and React refuses
// to serialize one across the server/client boundary ("Functions cannot be
// passed directly to Client Components"). One icon source also means the
// header panel and this strip can never disagree about what a page's mark
// is.
import { Link, usePathname } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { cn } from "@repo/ui/lib/utils";
import { MEGA_MENU_ICONS, routeKeyForHref } from "../../_nav/mega-menu.ts";

export interface SectionNavItem {
  href: string;
  label: string;
}

export function SectionNav({ items, ariaLabel }: { items: SectionNavItem[]; ariaLabel: string }) {
  const pathname = usePathname();

  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .toSorted((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="border-b border-border/70 bg-muted/40">
      <Container>
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
                      // Hover carries the same weight as the active state
                      // (ADR-051 §6): a surface, a ring and a coloured glyph.
                      // On a strip where one entry is already filled, a
                      // hover that only changes text colour is invisible
                      // next to it.
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
