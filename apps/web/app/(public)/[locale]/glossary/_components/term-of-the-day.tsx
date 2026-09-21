// The glossary masthead's featured term (changes-11 PR 4.5, D29).
//
// Server component. The rotation is computed in `getTermOfTheDay`, a cached
// loader on a daily `cacheLife` — there is no cron, no `featuredOn` column and
// no admin screen behind this, and nothing here reads the clock.
//
// Deliberately NOT a "Topic of the day" pair yet: topics are a real model
// (D27) that lands in Phase 10, and a card fed by `GlossaryTerm.category` free
// text would render a raw identifier (ADR-044 #5's public counterpart).
import { Sparkles } from "lucide-react";
import { Link } from "@repo/i18n/navigation";
import { cn } from "@repo/ui/lib/utils";

export function TermOfTheDay({
  term,
  slug,
  explanation,
  labels,
  className,
}: {
  term: string;
  slug: string;
  explanation: string;
  labels: { eyebrow: string; readMore: string };
  /**
   * The home page's browse band passes `h-full` so the card fills its column
   * (changes-35). `/glossary`'s masthead passes nothing and is unchanged — a
   * card that is one of several stacked in a hero sizes to its own content.
   */
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-5",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary-interactive uppercase">
        <Sparkles aria-hidden className="size-3.5" />
        {labels.eyebrow}
      </p>
      <h2 className="text-lg font-semibold">
        <Link
          href={`/glossary/${slug}`}
          className="transition-colors duration-(--duration-fast) hover:text-primary-interactive"
        >
          {term}
        </Link>
      </h2>
      <p className="text-sm text-muted-foreground">{explanation}</p>
      {/* `mt-auto` only bites when a caller has made the card taller than its
          content (the home band's `h-full`); in the masthead it is inert. */}
      <Link
        href={`/glossary/${slug}`}
        className="link-underline mt-auto w-fit text-sm font-medium text-primary-interactive"
      >
        {labels.readMore}
      </Link>
    </article>
  );
}
