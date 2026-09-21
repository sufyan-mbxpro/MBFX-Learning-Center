// The category tile, and the grid of them.
//
// One component, three callers: the /news front's "browse by topic" band, the
// category archive (where the current category is marked), and the tag
// archive (where none is). Extracted when the archives needed the same tile —
// a second copy would have drifted the moment one of them was restyled.
//
// Categories are DATA (ADR-042: content is dynamic, design is code), so
// nothing here is keyed to a particular category. The accent rotates by
// POSITION, which means a category added in the admin gets a colour with no
// code change and none is hard-coded to one.
import { ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { ArticleFacetTerm } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { cn } from "@repo/ui/lib/utils";

// Semantic tokens only, and the ink is always the `-interactive` derivation —
// ADR-018 rule 5: these are small text and thin rules, which is exactly what
// raw --primary is not for.
const ACCENT = [
  { ink: "text-primary-interactive", wash: "bg-primary/10" },
  { ink: "text-info-interactive", wash: "bg-info/10" },
  { ink: "text-success-interactive", wash: "bg-success/10" },
  { ink: "text-warning-interactive", wash: "bg-warning/10" },
] as const;

export async function CategoryCards({
  categories,
  /** Slug of the category being viewed, if any — that tile renders as current. */
  activeSlug,
  className,
}: {
  categories: ArticleFacetTerm[];
  activeSlug?: string;
  className?: string;
}) {
  const t = await getTranslations("news");
  const shown = categories.filter((category) => category.count > 0);
  if (shown.length === 0) return null;

  return (
    <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {shown.map((category, index) => {
        const accent = ACCENT[index % ACCENT.length]!;
        const current = category.slug === activeSlug;

        const inner = (
          <article
            className={cn(
              // `text-card-foreground` states the ink the tile is painted for.
              // It used to inherit it from the page, which was right until the
              // topics band turned `inverted` (changes-37) and the titles came
              // out white on a white card.
              "card-hover relative isolate flex h-full flex-col gap-3 overflow-hidden rounded-lg bg-card p-5 text-card-foreground ring-1 ring-foreground/10",
              current
                ? // The current tile is a statement, not a destination: it
                  // keeps the ring and the accent but drops every hover
                  // affordance, because a card that lifts and then navigates
                  // nowhere new promises an interaction it does not have.
                  "ring-2 ring-primary-interactive"
                : "hover-lift sheen group-hover:ring-primary/25 group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
            )}
          >
            {/* No accent rule along the top edge (changes-37, ADR-121 §5): the
                owner asked for it gone. What it carried survives elsewhere —
                the tile's colour is the count chip's wash below, and the
                current tile is marked by its 2px ring and the "You are here"
                line, neither of which needed the rule. */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums",
                  accent.wash,
                  accent.ink,
                )}
              >
                {t("topicsCount", { count: category.count })}
              </span>
              {current && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-interactive">
                  <Check aria-hidden className="size-3.5" />
                  {t("categoryCurrent")}
                </span>
              )}
            </div>

            <h3
              className={cn(
                "text-lg leading-snug font-semibold text-balance",
                !current && "transition-colors group-hover:text-primary-interactive",
              )}
            >
              {category.name}
            </h3>

            {!current && (
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary-interactive">
                {t("topicsCta")}
                <ArrowRight aria-hidden className="hover-arrow size-4 rtl:rotate-180" />
              </span>
            )}
          </article>
        );

        return (
          <li key={category.id}>
            {current ? (
              // `aria-current` on the article rather than a link: there is no
              // link here to carry it, and the tile still needs to announce
              // that it is the page being viewed.
              <div aria-current="page" className="block h-full">
                {inner}
              </div>
            ) : (
              // The whole card IS the link, unlike an article card: a topic
              // tile has one destination and no nested targets, so there is
              // nothing for a second link to compete with. `group` on the link
              // is what makes the arrow and the rule respond.
              <Link
                href={`/news/category/${category.slug}`}
                className="group block h-full focus-visible:outline-none"
              >
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
