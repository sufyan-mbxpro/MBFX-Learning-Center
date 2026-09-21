// The two article facet panels that are NOT specific to the news listing
// (changes-40).
//
// They were inline in `ArticleSidebar` until the glossary asked for the same
// two beside its own pages. Extracted rather than copied, for the reason
// `MarketNewsBand` is imported by two routes: a copy of "Latest posts" would
// be a second place for the cover-image fallback, the date format and the
// line-clamp to drift.
//
// `Panel` travels with them, because a panel that looks like a card on one
// surface and like a bare list on another is the same defect one level up.
import Image from "next/image";

import type { ArticleFacetTerm, ArticleListEntry } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { formatDate } from "@repo/utils";

import { canOptimizeImage } from "../../_lib/image-optimizer.ts";
import { TagChips } from "./archive-taxonomy.tsx";

// Built on the design system's Card (ADR-050), not on a copy of its class
// string. The copy this replaced had already drifted — it omitted
// `text-card-foreground` — and it was the reason these stacked panels had no
// header band while every other card was about to get one.
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        {/* The heading element stays real — Card/CardTitle are plain divs
            here, so the <h2> goes in directly rather than through a render
            prop this component does not have. */}
        <h2 className="text-sm leading-snug font-semibold">{title}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** "Latest posts" — the news cards a rail carries. Absent when there are none. */
export function LatestPostsPanel({
  title,
  entries,
  locale,
}: {
  title: string;
  entries: ArticleListEntry[];
  locale: string;
}) {
  if (entries.length === 0) return null;

  return (
    <Panel title={title}>
      <ul className="flex flex-col gap-4">
        {entries.map((entry) => (
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
                  unoptimized={!canOptimizeImage(entry.coverImageUrl)}
                  sizes="56px"
                  className="media-zoom object-cover"
                />
              </Link>
            )}
            {/* `min-w-0 flex-1`: a flex child's minimum width is its content,
                so without it one unbreakable run in a headline pushes the
                column past the card edge, where the card's `overflow-hidden`
                clips it mid-word (found in the changes-20 Phase 6 browser
                pass, once ADR-075's 24px card rhythm narrowed the sidebar).
                `wrap-break-word` lets that run break instead. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={`/news/${entry.slug}`}
                className="link-underline line-clamp-2 text-sm leading-snug font-medium wrap-break-word"
              >
                {entry.title}
              </Link>
              {entry.publishedAt && (
                <time className="text-xs text-muted-foreground">
                  {formatDate(entry.publishedAt, locale)}
                </time>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** "Popular tags". The one chip list the banner and the archive band also draw. */
export function PopularTagsPanel({
  title,
  tags,
  activeSlug,
}: {
  title: string;
  tags: ArticleFacetTerm[];
  activeSlug?: string;
}) {
  if (tags.length === 0) return null;

  return (
    <Panel title={title}>
      <TagChips tags={tags} activeSlug={activeSlug} />
    </Panel>
  );
}
