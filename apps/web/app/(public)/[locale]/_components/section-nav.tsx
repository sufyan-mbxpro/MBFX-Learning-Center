"use client";

// The one section bar under the site header (ADR-076 §1) — About's five pages
// and each learning school's four surfaces render THIS component, so the two
// sections cannot drift into two looks again. They had: About's strip was a
// muted, unpinned band and Learn's was a near-white pinned one, both
// hand-copied from the same original.
//
// Client only for `usePathname`: the active entry needs the current route,
// and the layouts that render this are cached (ADR-004), so they cannot know
// it.
//
// **A brand-tinted band, not a second header.** The header is `bg-background`,
// so a bar in the same colour read as part of it. The tint is `bg-primary/10`
// laid over an opaque `bg-background` — opaque because the bar is pinned and
// content scrolls underneath it, and /10 because that is inside the tint
// `--primary-interactive` is derived to stay legible on (TONAL_TINT_CONTRACT,
// ADR-073). The active entry is a SOLID `--primary` pill with
// `--primary-foreground`, the pair ADR-003 derives readable by construction.
//
// **Pinned below the header in both sections (ADR-065 §5, extended to About).**
// It offsets on `--header-offset`, which `StickyHeaderShell` measures — a
// literal `top-16` would tuck this bar under the header the day the
// announcement bar is switched on. z-30, one below the header's z-40: an open
// header panel must pass OVER this bar, not under it.
//
// Scrolls sideways below sm rather than wrapping: five entries with icons do
// not fit a phone, and a wrapped strip pushes the page down by a whole row.
//
// Icons are resolved HERE, from the registry the mega-menu panels use, rather
// than passed in: an icon is a function component, and React refuses to
// serialize one across the server/client boundary. One icon source also means
// the header panel and this bar can never disagree about a page's mark.
import { Link, usePathname } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { cn } from "@repo/ui/lib/utils";
import { activeSectionHref } from "../_nav/active-section.ts";
import { MEGA_MENU_ICONS, routeKeyForHref } from "../_nav/mega-menu.ts";

export interface SectionNavItem {
  href: string;
  label: string;
}

export function SectionNav({ items, ariaLabel }: { items: SectionNavItem[]; ariaLabel: string }) {
  const pathname = usePathname();
  const activeHref = activeSectionHref(
    pathname,
    items.map((item) => item.href),
  );

  return (
    <div className="sticky top-(--header-offset) z-30 border-b border-primary/20 bg-background shadow-xs">
      <div className="bg-primary/10">
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
                        // Hover carries a surface and a ring as well as ink
                        // (ADR-051 §6): next to a filled active pill, a hover
                        // that only changes text colour is invisible.
                        "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ring-1 ring-transparent transition duration-(--duration-base) ease-(--ease-out-quint) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                        isActive
                          ? "bg-primary-solid text-primary-solid-foreground shadow-sm"
                          : "text-foreground hover:bg-background hover:shadow-sm hover:ring-primary/25",
                      )}
                    >
                      {Icon && (
                        <Icon
                          aria-hidden
                          className={cn(
                            "size-4 transition-colors duration-(--duration-base)",
                            isActive ? "text-primary-foreground" : "text-primary-interactive",
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
    </div>
  );
}
