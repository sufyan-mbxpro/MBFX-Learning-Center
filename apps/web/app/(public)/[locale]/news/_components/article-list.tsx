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
import { Card, CardContent } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty";
import { cn } from "@repo/ui/lib/utils";

import { ArticleMedia } from "./article-media.tsx";
import { formatDate } from "@repo/utils";

type ArticleCardsVariant = "standard" | "featured" | "compact";

// A container query condition matches the nearest ANCESTOR container, never
// the element carrying the condition itself — `@container` and `@2xl:…` on
// the same node silently never match (confirmed live: computed
// `gridTemplateColumns` stayed a single track at 985px). The `@container`
// context therefore lives on a separate wrapper (below), one level up from
// the element the responsive `grid-cols` classes apply to.
//
// The one-column state is an EXPLICIT `grid-cols-1` (`minmax(0, 1fr)`), not
// the implicit `auto` track a bare `grid` gets. An auto track sizes to its
// items' min-content, and Chrome reports a `line-clamp` excerpt's min-content
// as its UNWRAPPED width — so on a phone one long excerpt made the column
// ~1300px and the homepage scrolled sideways (found in the changes-20
// Phase 6 browser pass, measured 1307px track in a 460px list).
//
// `standard` is sized to the home page's platform cards (changes-36, the
// owner's "same size like The platform cards"): a card is ~300px wide
// wherever it is drawn — four across a full-width band, three beside the
// listing sidebar, two on a tablet — with the same 16:10 cover and the same
// 16px title. The breakpoints are CONTAINER widths, so the column count
// follows the space a caller gives the grid rather than the viewport.
const GRID_CLASS: Record<ArticleCardsVariant, string> = {
  standard: "grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4",
  // `featured` gives the first entry the full width and a taller image.
  featured: "grid grid-cols-1 gap-6 @2xl:grid-cols-2",
  compact: "flex flex-col gap-4",
};

/** The standard grid, for the placeholders that must land over its cards. */
export const ARTICLE_CARDS_STANDARD_GRID = GRID_CLASS.standard;

export async function ArticleCards({
  entries,
  locale,
  showKind = false,
  showAuthor = false,
  variant = "standard",
  highlightFeatured = true,
  leadSizes,
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
  /**
   * The lead card's `sizes`, for a `featured` grid that is not full-bleed
   * (changes-35, ADR-116).
   *
   * Defaults to what `/news` has always rendered, `100vw`, which is right for
   * a full-width lead and wrong everywhere else: the home page's desk band
   * puts this card in ~55% of the width, so the optimizer would serve roughly
   * twice the pixels the slot paints — on the largest image on that page. A
   * prop rather than a second component, because the card is identical and
   * only its slot is not.
   *
   * There is deliberately no `leadRatio` beside it. 21/9 reads as a letterbox
   * only at full width; in a 770px column it is a 330px cover, which is an
   * ordinary feature proportion. A prop no call site passes is one code-style
   * #28 would have us leave out.
   */
  leadSizes?: string;
}) {
  const t = await getTranslations("news");
  const kindLabels: Record<string, string> = {
    NEWS: t("kindNews"),
    ANALYSIS: t("kindAnalysis"),
    TRADE_IDEA: t("kindTradeIdea"),
  };

  const resolved: ArticleCardsVariant =
    variant === "featured" || variant === "compact" ? variant : "standard";

  if (entries.length === 0) {
    return <EmptyState title={t("empty")} />;
  }

  return (
    <div className="@container">
      <ul className={GRID_CLASS[resolved]}>
        {entries.map((entry, index) => {
          const featuredFirst = resolved === "featured" && index === 0;
          // A standard card's body is the card's content part; a compact row
          // is already padded by the card, so its text column is a plain div.
          const Body = resolved === "compact" ? "div" : CardContent;

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
                // changes-20 Phase 5: the card's own rhythm, never hand
                // padding — a standard card is cover (card-media) + content,
                // a compact row is the 16px `sm` card laid out as a row.
                size={resolved === "compact" ? "sm" : "default"}
                className={cn(
                  // `group` (unnamed) is what every hover effect below keys
                  // off, so the whole card answers the pointer even though it
                  // is NOT one big link — the title, the category chip and
                  // the read affordance are separate targets, which is what
                  // keeps the chip clickable and the heading a real link in a
                  // screen reader's list of links.
                  "group relative isolate h-full",
                  resolved === "compact"
                    ? "flex-row items-center gap-3 px-(--card-spacing)"
                    : "hover-lift sheen hover:ring-primary/25",
                )}
              >
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
                    data-slot="card-media"
                    className="relative block"
                  >
                    <ArticleMedia
                      entry={entry}
                      // 16:10 is `HOME_MEDIA_SIZE`, the platform cards' own cover.
                      ratio={featuredFirst ? 21 / 9 : 16 / 10}
                      sizes={
                        featuredFirst
                          ? (leadSizes ?? "100vw")
                          : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      }
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

                <Body
                  className={cn(
                    "flex flex-1 flex-col gap-2",
                    // `min-w-0` is what stops a long headline from pushing
                    // the thumbnail out of the row now that compact is a
                    // flex ROW with two children rather than one.
                    resolved === "compact" && "min-w-0",
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
                      featuredFirst ? "text-2xl" : resolved === "compact" ? "text-sm" : "text-base",
                      // The heading's ink follows the CARD's hover, not only
                      // the link's own: on a card this size the pointer is
                      // rarely on the words themselves.
                      resolved !== "compact" && "group-hover:text-primary-interactive",
                    )}
                  >
                    <Link
                      href={`/news/${entry.slug}`}
                      className={cn(
                        "link-underline",
                        // Two lines on a standard card (changes-36): at ~300px a
                        // long headline ran to four, and the tallest card set
                        // the height of its whole row.
                        resolved === "compact" ? "line-clamp-3" : "line-clamp-2",
                      )}
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
                    <div className="mt-auto flex items-center gap-x-3 border-t pt-3 text-xs text-muted-foreground">
                      {showAuthor && entry.authorName && (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <UserRound aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate">{entry.authorName}</span>
                        </span>
                      )}
                      {entry.publishedAt && (
                        <time className="shrink-0">{formatDate(entry.publishedAt, locale)}</time>
                      )}
                      {/* aria-hidden and not focusable: the heading above is
                          already a link to the same place, and a second one
                          would make every card two identical stops in a
                          keyboard tour of the grid. This is an affordance for
                          the pointer, so it is announced to neither reader. */}
                      <span
                        aria-hidden
                        className="ms-auto inline-flex shrink-0 items-center gap-1.5 font-medium text-primary-interactive"
                      >
                        {/* The arrow alone, not "Read article" + arrow: at the
                            platform cards' ~300px width, author + date + the
                            words wrapped to a second row or truncated the
                            author (changes-36). The heading is the real link,
                            so the words were never announced anyway. */}
                        <ArrowRight aria-hidden className="hover-arrow size-3.5 rtl:rotate-180" />
                      </span>
                    </div>
                  )}

                  {/* The compact variant keeps the date inline — no byline row. */}
                  {resolved === "compact" && entry.publishedAt && (
                    <time className="text-xs text-muted-foreground">
                      {formatDate(entry.publishedAt, locale)}
                    </time>
                  )}
                </Body>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
