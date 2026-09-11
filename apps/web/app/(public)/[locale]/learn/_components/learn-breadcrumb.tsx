// Learn / <course> [ / <lesson> ] (changes-11 PR 4.4).
//
// A real `<nav aria-label>` with an ordered list, and the current page marked
// `aria-current="page"` and NOT linked — a breadcrumb whose last crumb links to
// the page you are on is a control that does nothing.
//
// The separator is `aria-hidden` and rendered by CSS-free markup rather than a
// `/` inside the link text, so a screen reader reads "Learn, Advanced trading
// strategies" instead of "Learn slash Advanced trading strategies".
import { ChevronRight } from "lucide-react";
import { Link } from "@repo/i18n/navigation";
import { cn } from "@repo/ui/lib/utils";

export interface BreadcrumbCrumb {
  href: string;
  label: string;
}

export function LearnBreadcrumb({
  learnLabel,
  learnHref,
  /** Intermediate crumbs between Learn and the current page — the course, on a
   * lesson page. Empty on a course page. */
  trail = [],
  current,
  className,
}: {
  learnLabel: string;
  learnHref: string;
  trail?: BreadcrumbCrumb[];
  current: string;
  className?: string;
}) {
  const links = [{ href: learnHref, label: learnLabel }, ...trail];

  return (
    <nav aria-label={learnLabel} className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {links.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            <Link
              href={crumb.href}
              className="transition-colors duration-(--duration-base) hover:text-foreground"
            >
              {crumb.label}
            </Link>
            {/* `rtl:rotate-180`: the chevron points along the reading
                direction, not rightwards (code-style.md #3). */}
            <ChevronRight aria-hidden className="size-3.5 shrink-0 rtl:rotate-180" />
          </li>
        ))}
        <li className="min-w-0">
          <span aria-current="page" className="truncate font-medium text-foreground">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
