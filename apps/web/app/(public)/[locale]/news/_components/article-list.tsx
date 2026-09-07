// Shared listing UI for /news, /analysis, the archives, the detail page's
// related strip and the homepage's latest-analysis section
// (changes-03-plan.md §6.3). One component, three variants — every caller
// picks one, so there is no second card implementation to keep in sync.
//
// The hover treatment (2026-09-07 design pass) is the same vocabulary the
// homepage's explore carousel already uses — `.card-hover` for the shared
// ring/shadow, `.hover-lift` + `.sheen` for the public-surface emphasis
// (ADR-051 §6), a rule sweeping from the inline start, `.media-zoom` on the
// cover and `.hover-arrow` on the read link. All of it is CSS over
// server-rendered markup: zero client JS, ADR-018 rule 1.
import { ArrowRight, Star, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ArticleListEntry } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

import { ArticleMedia } from "./article-media.tsx";

type ArticleCardsVariant = "standard" | "featured" | "compact";

// A container query condition matches the nearest ANCESTOR container, never
// the element carrying the condition itself — `@container` and `@2xl:…` on
// the same node silently never match (confirmed live: computed
// `gridTemplateColumns` stayed a single track at 985px). The `@container`
// context therefore lives on a separate wrapper (below), one level up from
// the element the responsive `grid-cols` classes apply to.
const GRID_CLASS: Record<ArticleCardsVariant, string> = {
  standard: "grid gap-6 @2xl:grid-cols-2 @6xl:grid-cols-3",
  // `featured` gives the first entry the full width and a taller image.
  featured: "grid gap-6 @2xl:grid-cols-2",
  compact: "flex flex-col gap-4",
};

export async function ArticleCards({
  entries,
  locale,
  showKind = false,
  showAuthor = false,
  variant = "standard",
  highlightFeatured = true,
}: {
  entries: ArticleListEntry[];
  locale: string;
  showKind?: boolean;
  /** Gated by `articles.showAuthor` at the call site, like the detail page. */
  showAuthor?: boolean;
  variant?: string;
  /**
   * Give articles the editor flagged Featured the tinted, bordered card.
   *
   * On by default, and off for exactly one caller: a category archive whose
   * every article is flagged would be a wall of tinted cards, at which point
   * the treatment distinguishes nothing. Emphasis only reads as emphasis
   * against something unemphasised.
   */
  highlightFeatured?: boolean;
}) {
  const t = await getTranslations("news");
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const kindLabels: Record<string, string> = {
    NEWS: t("kindNews"),
    ANALYSIS: t("kindAnalysis"),
    TRADE_IDEA: t("kindTradeIdea"),
  };

  const resolved: ArticleCardsVariant =
    variant === "featured" || variant === "compact" ? variant : "standard";

  if (entries.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="@container">
      <ul className={GRID_CLASS[resolved]}>
        {entries.map((entry, index) => {
          const featuredFirst = resolved === "featured" && index === 0;

          return (
            <li
              key={entry.articleId}
              className={cn(featuredFirst && "sm:col-span-2", resolved === "compact" && "w-full")}
            >
              <Card
                // A flagged article carries the design system's own `featured`
                // treatment — the 2px `--primary-interactive` border over a
                // `bg-primary/10` tint — so it is distinguishable at a glance
                // from across the grid, before the Featured badge on its cover
                // is legible. That variant exists precisely for this and was
                // previously reachable only as "the first card of a featured
                // grid", which is a position, not an editorial decision.
                variant={
                  featuredFirst || (highlightFeatured && entry.isFeatured) ? "featured" : "default"
                }
                className={cn(
                  // `group` (unnamed) is what every hover effect below keys
                  // off, so the whole card answers the pointer even though it
                  // is NOT one big link — the title, the category chip and
                  // the read affordance are separate targets, which is what
                  // keeps the chip clickable and the heading a real link in a
                  // screen reader's list of links.
                  "group relative isolate h-full gap-0 py-0",
                  resolved === "compact"
                    ? "flex-row items-center gap-3 p-3"
                    : "hover-lift sheen hover:ring-primary/25",
                )}
              >
                {/* Rule sweeping from the inline START — `start-0` + `w-0` →
                    `w-full`, so it runs the correct way in RTL with no [dir]
                    rule. On a child, never on the Card: `.card-hover`
                    declares its own `transition-property` and, sitting later
                    in `@layer utilities` than Tailwind's generated classes,
                    it beats a transition utility written in the class
                    attribute — the card would jump rather than glide. */}
                {resolved !== "compact" && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-0 start-0 z-20 h-1 w-0 bg-primary transition-[width] duration-(--duration-slow) ease-(--ease-out-quint) group-hover:w-full"
                  />
                )}

                {resolved === "compact" ? (
                  // The rail beside the homepage lead used to be text-only,
                  // which made a list of headlines read as a sidebar rather
                  // than as articles. A square thumbnail is enough to say
                  // "these are stories too" without competing with the lead
                  // card's 21/9 cover. `shrink-0` keeps it square when a
                  // long headline pushes on the row; the Featured badge is
                  // deliberately absent — at 5rem it would cover the picture.
                  <Link
                    href={`/news/${entry.slug}`}
                    tabIndex={-1}
                    aria-hidden
                    className="relative block w-20 shrink-0"
                  >
                    <ArticleMedia
                      entry={entry}
                      ratio={1}
                      sizes="80px"
                      glyphClassName="size-7"
                      className="rounded-md"
                    />
                  </Link>
                ) : (
                  <Link
                    href={`/news/${entry.slug}`}
                    tabIndex={-1}
                    aria-hidden
                    className="relative block"
                  >
                    <ArticleMedia
                      entry={entry}
                      ratio={featuredFirst ? 21 / 9 : 16 / 9}
                      sizes={featuredFirst ? "100vw" : "(max-width: 640px) 100vw, 33vw"}
                    />
                    {highlightFeatured && entry.isFeatured && (
                      // The editor's Featured flag, finally visible to the
                      // reader it was always for. On the media rather than in
                      // the badge row below: that row carries taxonomy the
                      // reader can act on (kind, category), and an editorial
                      // marker is a different kind of statement.
                      <Badge
                        variant="default"
                        className="absolute top-3 start-3 z-10 h-6 gap-1.5 px-2.5 shadow-sm"
                      >
                        <Star aria-hidden />
                        {t("featuredBadge")}
                      </Badge>
                    )}
                  </Link>
                )}

                <div
                  className={cn(
                    "flex flex-1 flex-col gap-2",
                    // `min-w-0` is what stops a long headline from pushing
                    // the thumbnail out of the row now that compact is a
                    // flex ROW with two children rather than one.
                    resolved === "compact" ? "min-w-0 p-0" : "p-5",
                  )}
                >
                  {(showKind || entry.category) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {showKind && (
                        <Badge variant="pill">{kindLabels[entry.kind] ?? entry.kind}</Badge>
                      )}
                      {entry.category && (
                        <Badge
                          variant="pill"
                          render={<Link href={`/news/category/${entry.category.slug}`} />}
                        >
                          {entry.category.name}
                        </Badge>
                      )}
                    </div>
                  )}

                  <h3
                    className={cn(
                      "leading-snug font-semibold transition-colors",
                      featuredFirst ? "text-2xl" : resolved === "compact" ? "text-sm" : "text-lg",
                      // The heading's ink follows the CARD's hover, not only
                      // the link's own: on a card this size the pointer is
                      // rarely on the words themselves.
                      resolved !== "compact" && "group-hover:text-primary-interactive",
                    )}
                  >
                    <Link
                      href={`/news/${entry.slug}`}
                      className={cn("link-underline", resolved === "compact" && "line-clamp-3")}
                    >
                      {entry.title}
                    </Link>
                  </h3>

                  {entry.excerpt && resolved !== "compact" && (
                    <p
                      className={cn(
                        "text-sm text-muted-foreground",
                        featuredFirst ? "line-clamp-3" : "line-clamp-2",
                      )}
                    >
                      {entry.excerpt}
                    </p>
                  )}

                  {/* Byline row, divided off from the copy (image-10). Author
                    honours `articles.showAuthor`, resolved by the caller —
                    the same setting the detail page already respects. The
                    read affordance shares this row rather than adding a third
                    band of chrome to a card that is mostly chrome already. */}
                  {resolved !== "compact" && (
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
                      {showAuthor && entry.authorName && (
                        <span className="flex items-center gap-1.5">
                          <UserRound aria-hidden className="size-3.5" />
                          {entry.authorName}
                        </span>
                      )}
                      {entry.publishedAt && <time>{dateFormat.format(entry.publishedAt)}</time>}
                      {/* aria-hidden and not focusable: the heading above is
                          already a link to the same place, and a second one
                          would make every card two identical stops in a
                          keyboard tour of the grid. This is an affordance for
                          the pointer, so it is announced to neither reader. */}
                      <span
                        aria-hidden
                        className="ms-auto inline-flex items-center gap-1.5 font-medium text-primary-interactive"
                      >
                        {t("readArticle")}
                        <ArrowRight aria-hidden className="hover-arrow size-3.5 rtl:rotate-180" />
                      </span>
                    </div>
                  )}

                  {/* The compact variant keeps the date inline — no byline row. */}
                  {resolved === "compact" && entry.publishedAt && (
                    <time className="text-xs text-muted-foreground">
                      {dateFormat.format(entry.publishedAt)}
                    </time>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
