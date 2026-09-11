// The glossary's two browse modes (changes-11 Phase 10, D27).
//
// A server component and a real `<nav>` of links, not a client tab strip: A–Z
// and Browse-by-topic are two ROUTES with two sets of URLs, and D26's rule is
// explicit that a filter creating a collection is a route while one narrowing
// an on-page set is client state. The A–Z chips inside `/glossary` are the
// second kind; these are the first.
//
// It follows `about/_components/section-nav.tsx` and `LearnSectionNav` — the
// established shape for a section strip on this site.
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { cn } from "@repo/ui/lib/utils";

export interface GlossaryTabItem {
  href: string;
  label: string;
}

export function GlossaryTabs({
  items,
  current,
  ariaLabel,
}: {
  items: GlossaryTabItem[];
  /** The href of the active tab, matched exactly. */
  current: string;
  ariaLabel: string;
}) {
  // One tab is not navigation — the same rule the learn layout applies. It
  // happens when no topic has published terms yet.
  if (items.length < 2) return null;

  return (
    <nav aria-label={ariaLabel} className="border-b">
      <Container>
        <ul className="-mb-px flex flex-wrap items-center gap-1">
          {items.map((item) => {
            const active = item.href === current;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  // `aria-current="page"` rather than `aria-selected`: these are
                  // links to pages, not tabs in a tablist, and claiming the
                  // tablist role without its keyboard behaviour is worse than
                  // not claiming it.
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-block border-b-2 px-3.5 py-3 text-sm font-medium transition-colors duration-(--duration-base) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}

export const GLOSSARY_PATH = ROUTE_PATHS.glossary;
export const GLOSSARY_TOPICS_PATH = `${ROUTE_PATHS.glossary}/topics`;
