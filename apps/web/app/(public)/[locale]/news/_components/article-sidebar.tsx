// Listing sidebar (changes-03-plan.md §6.3, image-10.png): search,
// categories, latest posts, popular tags, archives. All four facets come
// from ONE cached read (getArticleFacets) so they revalidate together with
// the articles they describe.
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import type { ArticleFacets } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-hover flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export async function ArticleSidebar({
  facets,
  locale,
  basePath,
  query,
}: {
  facets: ArticleFacets;
  locale: string;
  /** Where the search form submits — /news or /analysis. */
  basePath: string;
  query?: string;
}) {
  const t = await getTranslations("news");
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });

  return (
    <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
      {/* A plain GET form: no JS needed, and the resulting URL is
          shareable and cacheable. `q` is parsed server-side through
          publicArticleSearchSchema before it reaches @repo/core. */}
      <form action={basePath} className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          className="flex-1"
        />
        <Button type="submit" size="icon" aria-label={t("searchLabel")}>
          <Search aria-hidden className="size-4" />
        </Button>
      </form>

      {facets.categories.length > 0 && (
        <Panel title={t("categories")}>
          <ul className="flex flex-col gap-2">
            {facets.categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/news/category/${category.slug}`}
                  className="link-underline text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {category.name}
                </Link>
                <span className="text-xs text-muted-foreground">{category.count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {facets.latest.length > 0 && (
        <Panel title={t("latestPosts")}>
          <ul className="flex flex-col gap-4">
            {facets.latest.map((entry) => (
              <li key={entry.articleId} className="group flex items-start gap-3">
                {entry.coverImageUrl && (
                  <Link
                    href={`/news/${entry.slug}`}
                    tabIndex={-1}
                    aria-hidden
                    className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted"
                  >
                    <Image
                      src={entry.coverImageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="56px"
                      className="media-zoom object-cover"
                    />
                  </Link>
                )}
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/news/${entry.slug}`}
                    className="link-underline line-clamp-2 text-sm leading-snug font-medium"
                  >
                    {entry.title}
                  </Link>
                  {entry.publishedAt && (
                    <time className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                        entry.publishedAt,
                      )}
                    </time>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {facets.tags.length > 0 && (
        <Panel title={t("popularTags")}>
          <ul className="flex flex-wrap gap-2">
            {facets.tags.map((tag) => (
              <li key={tag.id}>
                <Badge variant="pill" render={<Link href={`/news/tag/${tag.slug}`} />}>
                  {tag.name}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {facets.archives.length > 0 && (
        <Panel title={t("archives")}>
          <ul className="flex flex-col gap-2">
            {facets.archives.slice(0, 12).map((entry) => (
              <li
                key={entry.month.toISOString()}
                className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
              >
                <span>{monthFormat.format(entry.month)}</span>
                <span className="text-xs">{entry.count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </aside>
  );
}
