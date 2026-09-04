// Shared listing UI for /news, /analysis, the archives and the homepage's
// latest-analysis section (changes-03-plan.md §6.3). One component, three
// variants — the homepage picks one from its section descriptor, so there
// is no second card implementation to keep in sync.
import Image from "next/image";
import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ArticleListEntry } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import { ImageReveal } from "@repo/ui/components/image-reveal";
import { cn } from "@repo/ui/lib/utils";

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
}: {
  entries: ArticleListEntry[];
  locale: string;
  showKind?: boolean;
  /** Gated by `articles.showAuthor` at the call site, like the detail page. */
  showAuthor?: boolean;
  variant?: string;
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
          const showImage = resolved !== "compact" && Boolean(entry.coverImageUrl);

          return (
            <li
              key={entry.articleId}
              className={cn(featuredFirst && "sm:col-span-2", resolved === "compact" && "w-full")}
            >
              <Card
                variant={featuredFirst ? "featured" : "default"}
                className={cn(
                  "h-full gap-0 py-0",
                  resolved === "compact" && "flex-row items-center gap-3 p-3",
                )}
              >
                {showImage && entry.coverImageUrl && (
                  <Link
                    href={`/news/${entry.slug}`}
                    tabIndex={-1}
                    aria-hidden
                    className="group block"
                  >
                    <ImageReveal ratio={featuredFirst ? 21 / 9 : 16 / 9} className="rounded-none">
                      {/* Cover URLs are admin-entered and arbitrary-host — skip
                        the optimizer rather than allowlist the world. */}
                      <Image
                        src={entry.coverImageUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes={featuredFirst ? "100vw" : "(max-width: 640px) 100vw, 33vw"}
                      />
                    </ImageReveal>
                  </Link>
                )}

                <div
                  className={cn(
                    "flex flex-1 flex-col gap-2",
                    resolved === "compact" ? "p-0" : "p-4",
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
                      "leading-snug font-semibold",
                      featuredFirst ? "text-2xl" : resolved === "compact" ? "text-sm" : "text-lg",
                    )}
                  >
                    <Link href={`/news/${entry.slug}`} className="link-underline">
                      {entry.title}
                    </Link>
                  </h3>

                  {entry.excerpt && resolved !== "compact" && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{entry.excerpt}</p>
                  )}

                  {/* Byline row, divided off from the copy (image-10). Author
                    honours `articles.showAuthor`, resolved by the caller —
                    the same setting the detail page already respects. */}
                  {resolved !== "compact" &&
                    (entry.publishedAt || (showAuthor && entry.authorName)) && (
                      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                        {showAuthor && entry.authorName && (
                          <span className="flex items-center gap-1.5">
                            <UserRound aria-hidden className="size-3.5" />
                            {entry.authorName}
                          </span>
                        )}
                        {entry.publishedAt && <time>{dateFormat.format(entry.publishedAt)}</time>}
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
