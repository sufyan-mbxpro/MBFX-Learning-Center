// The /news lead block: one large story plus three runners-up (changes-46,
// owner: "add 3 suggestions on the right side").
//
// What fills it is `getSpotlightArticles` — the editor's Featured flags
// first, topped up with the newest articles when fewer than three are
// flagged. The top-up is why this can be part of the page's LAYOUT rather
// than a section that appears and disappears: a site with nothing flagged
// still opens on its three most recent stories, which is what a reader
// expects from a newsroom front anyway.
//
// Deliberately NOT `ArticleCards variant="featured"`. That variant makes the
// first card wider and stops there; a lead story earns a different SHAPE —
// its own ratio, a full excerpt, the byline promoted out of the footer row —
// and the two beside it earn a third shape again, horizontal and numbered.
// Three shapes on one page is a hierarchy; one shape at three sizes is a
// grid with a big cell.
import { ArrowRight, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { ArticleListEntry } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { cn } from "@repo/ui/lib/utils";

import { ArticleMedia } from "./article-media.tsx";
import { formatDate } from "@repo/utils";

function Meta({
  entry,
  locale,
  showAuthor,
  className,
}: {
  entry: ArticleListEntry;
  locale: string;
  showAuthor: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {showAuthor && entry.authorName && (
        <span className="flex items-center gap-1.5">
          <UserRound aria-hidden className="size-3.5" />
          {entry.authorName}
        </span>
      )}
      {entry.publishedAt && <time>{formatDate(entry.publishedAt, locale)}</time>}
    </div>
  );
}

export async function NewsSpotlight({
  entries,
  locale,
  showAuthor,
}: {
  entries: ArticleListEntry[];
  locale: string;
  showAuthor: boolean;
}) {
  // Nothing published yet: the listing below already says so once, and
  // saying it twice on one screen reads as two broken sections.
  if (entries.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "news" });

  return (
    <Section spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading eyebrow={t("spotlightEyebrow")} title={t("spotlightTitle")} />
        {/* Three in the rail, the home desk's count, so the rail ends on the
            lead's bottom edge instead of stopping two-thirds of the way down
            (changes-46). `SPOTLIGHT_COUNT` in the page is 1 + this. */}
        <SpotlightGrid
          entries={entries}
          locale={locale}
          showAuthor={showAuthor}
          runnerCount={3}
          alignRail
          priority
        />
      </Container>
    </Section>
  );
}

/**
 * The lead story beside a numbered rail — the spotlight's body without its
 * heading, so the home page's news & analysis band draws the SAME shape under
 * its own heading and calls to action (changes-39) rather than a copy of it.
 */
export async function SpotlightGrid({
  entries,
  locale,
  showAuthor,
  runnerCount = 2,
  alignRail = false,
  priority = false,
}: {
  entries: ArticleListEntry[];
  locale: string;
  showAuthor: boolean;
  /** How many stories the rail beside the lead carries. */
  runnerCount?: number;
  /**
   * End the rail on the lead's bottom edge by sharing the row height between
   * its cards. Only worth it where the rail is nearly as tall as the lead
   * already (the home desk's three runners); with /news's two it would pad
   * each card to twice its content — the changes-22 problem below.
   */
  alignRail?: boolean;
  /** Only where the lead cover is a plausible LCP element (the /news front). */
  priority?: boolean;
}) {
  const [lead, ...rest] = entries;
  if (!lead) return null;
  const t = await getTranslations({ locale, namespace: "news" });

  const runners = rest.slice(0, runnerCount);

  return (
    <Reveal variant="up">
      {/* `grid-cols-1` below lg, not the implicit `auto` track: the lead's
              line-clamped excerpt reports its UNWRAPPED width as min-content,
              so an auto track grew past a phone screen (85px of sideways
              scroll at 390px — changes-20 Phase 6 browser pass). */}
      <div
        className={cn("grid grid-cols-1 gap-6", runners.length > 0 && "lg:grid-cols-(--grid-3-2)")}
      >
        {/* The lead. `article` + a heading link, not a card-sized <a>:
                the same reason ArticleCards gives — one link per destination
                keeps a keyboard tour of the page from doubling. */}
        {/* Picture ABOVE the words at every width. changes-36 put it
                beside them with the media cell stretched to the row
                (`md:h-full`), but the cover keeps its `aspect-ratio`, so a
                stretched HEIGHT derived a WIDTH wider than its half and the
                picture painted over the headline. Stacked, the height is held
                down instead by a 16:6 BANNER (~225px across the lead column,
                where 16:9 was ~340px), and by a compact text block: the byline
                shares the badge row, and headline and excerpt clamp at two
                lines each, so a long story cannot grow the card either. */}
        <article className="group card-hover hover-lift sheen relative isolate flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
          <Link href={`/news/${lead.slug}`} tabIndex={-1} aria-hidden className="block">
            <ArticleMedia
              entry={lead}
              ratio={16 / 6}
              // The one cover on the /news route that is a plausible LCP
              // element; everything else stays lazy.
              priority={priority}
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </Link>

          <div className="flex min-w-0 flex-col gap-2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Which label depends on WHY this story is here. A flagged
                      article says "Featured" — the editor's word for it, and
                      the only place a reader ever sees that flag, since the
                      spotlight is exactly where flagged articles end up and
                      the grid's own Featured badge therefore only fires when
                      there are more flags than the spotlight can hold. An
                      unflagged top-up says "Lead story", which is a claim
                      about position and is true of it. */}
              <Badge variant="eyebrow">
                {lead.isFeatured ? t("featuredBadge") : t("leadStory")}
              </Badge>
              {lead.category && (
                <Badge
                  variant="pill"
                  render={<Link href={`/news/category/${lead.category.slug}`} />}
                >
                  {lead.category.name}
                </Badge>
              )}
              {/* The byline rides the badge row's END rather than taking a
                      row of its own under the excerpt — one line fewer, and
                      it wraps under the badges on a narrow card. */}
              <Meta entry={lead} locale={locale} showAuthor={showAuthor} className="ms-auto" />
            </div>

            <h3 className="line-clamp-2 text-xl leading-tight font-semibold text-balance transition-colors group-hover:text-primary-interactive lg:text-2xl">
              <Link href={`/news/${lead.slug}`} className="link-underline">
                {lead.title}
              </Link>
            </h3>

            {lead.excerpt && (
              <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
                {lead.excerpt}
              </p>
            )}
          </div>
        </article>

        {/* The runners-up: a numbered rail, horizontal, thumbnail-first.
                Numbers are `aria-hidden` — "01" is a visual rhythm, not a
                ranking anyone published, and reading it aloud implies an
                editorial claim the data does not make. */}
        {/* `self-start`, and no `flex-1` on the items: the rail used to
                stretch each card to half the lead's height, which on a real
                front left most of both cards empty — a card padded out to
                twice the height of its own content reads as a card that
                failed to load, not as breathing room (changes-22). Sized to
                content, the column simply ends where its two stories do. */}
        {runners.length > 0 && (
          <ol className={cn("flex flex-col gap-4", !alignRail && "self-start")}>
            {runners.map((entry, index) => (
              <li key={entry.articleId} className={cn(alignRail && "flex flex-1")}>
                <article
                  className={cn(
                    "group card-hover hover-lift sheen relative flex items-center gap-4 rounded-lg bg-card p-4 ring-1 ring-foreground/10",
                    alignRail && "flex-1",
                  )}
                >
                  <Link
                    href={`/news/${entry.slug}`}
                    tabIndex={-1}
                    aria-hidden
                    className="relative w-28 shrink-0 overflow-hidden rounded-lg"
                  >
                    <ArticleMedia entry={entry} ratio={4 / 3} sizes="112px" />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="text-sm font-semibold tabular-nums text-primary-interactive"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {entry.category && (
                        <span className="truncate text-xs text-muted-foreground">
                          {entry.category.name}
                        </span>
                      )}
                    </div>

                    <h3 className="line-clamp-3 text-sm leading-snug font-semibold transition-colors group-hover:text-primary-interactive">
                      <Link href={`/news/${entry.slug}`} className="link-underline">
                        {entry.title}
                      </Link>
                    </h3>

                    <Meta
                      entry={entry}
                      locale={locale}
                      showAuthor={showAuthor}
                      className="mt-auto"
                    />
                  </div>

                  <ArrowRight
                    aria-hidden
                    className="hover-arrow size-4 shrink-0 text-primary-interactive rtl:rotate-180"
                  />
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Reveal>
  );
}
