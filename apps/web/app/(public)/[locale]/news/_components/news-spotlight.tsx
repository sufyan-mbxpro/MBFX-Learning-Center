// The /news lead block: one large story plus two runners-up.
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
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
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
      {entry.publishedAt && <time>{dateFormat.format(entry.publishedAt)}</time>}
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
  const t = await getTranslations("news");
  const [lead, ...rest] = entries;
  // Nothing published yet: the listing below already says so once, and
  // saying it twice on one screen reads as two broken sections.
  if (!lead) return null;

  const runners = rest.slice(0, 2);

  return (
    <Section spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading eyebrow={t("spotlightEyebrow")} title={t("spotlightTitle")} />

        <Reveal variant="up">
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            {/* The lead. `article` + a heading link, not a card-sized <a>:
                the same reason ArticleCards gives — one link per destination
                keeps a keyboard tour of the page from doubling. */}
            <article className="group card-hover hover-lift sheen relative isolate flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 hover:ring-primary/25">
              <span
                aria-hidden
                className="pointer-events-none absolute top-0 start-0 z-20 h-1 w-0 bg-primary transition-[width] duration-(--duration-slow) ease-(--ease-out-quint) group-hover:w-full"
              />
              <Link href={`/news/${lead.slug}`} tabIndex={-1} aria-hidden className="block">
                <ArticleMedia
                  entry={lead}
                  ratio={16 / 9}
                  // The one cover on the route that is a plausible LCP
                  // element; everything else stays lazy.
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                />
              </Link>

              <div className="flex flex-1 flex-col gap-3 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="eyebrow">{t("leadStory")}</Badge>
                  {lead.category && (
                    <Badge
                      variant="pill"
                      render={<Link href={`/news/category/${lead.category.slug}`} />}
                    >
                      {lead.category.name}
                    </Badge>
                  )}
                </div>

                <h3 className="text-2xl leading-tight font-semibold text-balance transition-colors group-hover:text-primary-interactive md:text-3xl">
                  <Link href={`/news/${lead.slug}`} className="link-underline">
                    {lead.title}
                  </Link>
                </h3>

                {lead.excerpt && (
                  <p className="line-clamp-3 text-pretty text-muted-foreground">{lead.excerpt}</p>
                )}

                <Meta entry={lead} locale={locale} showAuthor={showAuthor} className="mt-auto" />
              </div>
            </article>

            {/* The runners-up: a numbered rail, horizontal, thumbnail-first.
                Numbers are `aria-hidden` — "01" is a visual rhythm, not a
                ranking anyone published, and reading it aloud implies an
                editorial claim the data does not make. */}
            <ol className="flex flex-col gap-4">
              {runners.map((entry, index) => (
                <li key={entry.articleId} className="flex-1">
                  <article className="group card-hover hover-lift relative flex h-full items-start gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary/25">
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
                      className="hover-arrow mt-1 size-4 shrink-0 text-primary-interactive rtl:rotate-180"
                    />
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
