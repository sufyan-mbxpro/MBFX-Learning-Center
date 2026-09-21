// What a reader gets at the BOTTOM of a category or tag archive: every other
// category as a card, and the tags that actually occur in what they are
// reading, as chips.
//
// The archives used to end at the last article with no way onward except the
// browser's back button — the section's own taxonomy was reachable from
// /news and nowhere else. This is that taxonomy, on the pages where a reader
// has most obviously expressed an interest in it.
//
// The counts come from `getArticleFacets`, whose `categoryId` option scopes
// the tags to the archive being viewed while leaving the category counts
// global — the asymmetry is documented on `ArticleFacetOptions`, and it is
// what makes this component correct: "3 articles" on a category card means
// three in that category, not three in the intersection of two filters.
import { getTranslations } from "next-intl/server";

import type { ArticleFacetTerm } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { CategoryCards } from "./category-cards.tsx";
import { NewsBackdrop } from "./news-art.tsx";

/**
 * The tag chips. Their own export because the archives put them in two
 * places: a refinement row directly under the header, and this band.
 */
export async function TagChips({
  tags,
  activeSlug,
}: {
  tags: ArticleFacetTerm[];
  activeSlug?: string;
}) {
  if (tags.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const current = tag.slug === activeSlug;
        return (
          <li key={tag.id}>
            {current ? (
              // The tag being viewed is not a link to itself. It keeps the
              // filled variant so it reads as the active filter, and carries
              // `aria-current` so that is not a purely visual statement.
              <Badge variant="default" aria-current="page" className="h-7 px-3">
                {tag.name}
              </Badge>
            ) : (
              <Badge
                variant="pill"
                className="h-7 px-3 transition-colors"
                render={<Link href={`/news/tag/${tag.slug}`} />}
              >
                {tag.name}
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export async function ArchiveTaxonomy({
  categories,
  tags,
  activeCategorySlug,
  activeTagSlug,
}: {
  categories: ArticleFacetTerm[];
  tags: ArticleFacetTerm[];
  activeCategorySlug?: string;
  activeTagSlug?: string;
}) {
  const t = await getTranslations("news");

  const hasCategories = categories.some((category) => category.count > 0);
  if (!hasCategories && tags.length === 0) return null;

  return (
    // `id="topics"`: the listing masthead's "Browse topics" action anchors
    // here on every page that is not the section front (changes-38).
    //
    // ─── The same band as `NewsTopics` (changes-40) ─────────────────────
    //
    // This and `NewsTopics` are the SAME band to a reader: "Topics / Keep
    // exploring" at the foot of a listing. One of them showed a photograph and
    // the other a flat `muted` ground, so /analysis and every archive looked
    // unfinished beside /news for no reason anybody chose. It now takes
    // ADR-117's treatment exactly as `NewsTopics` does — an `inverted`
    // (`--secondary`) band, the picture at full strength, a `--secondary`
    // scrim carrying the contrast guarantee whatever the photograph is.
    <Section id="topics" tone="inverted" spacing="lg" className="relative isolate overflow-hidden">
      {/* Its own layer rather than a class on Section: Section composes its
          tone through `cn` (tailwind-merge), so a background passed in
          className REPLACES the tone's fill instead of layering over it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 select-none">
        <NewsBackdrop slot="topics" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-secondary/90 via-secondary/70 to-secondary/90"
      />

      <Container className="flex flex-col gap-(--section-gap)">
        {/* Hand-written rather than `SectionHeading`, for `NewsTopics`' own
            reason: SectionHeading's eyebrow and lead are coloured for
            `--background`, and this band paints `--secondary`. */}
        <div className="flex flex-col items-start gap-3 text-start">
          <p className="text-xs font-semibold tracking-caps text-secondary-foreground/75 uppercase">
            {t("topicsEyebrow")}
          </p>
          <h2 className="font-display text-display-sm font-bold text-balance text-secondary-foreground">
            {t("exploreTitle")}
          </h2>
          <p className="max-w-2xl text-lg text-pretty text-secondary-foreground/80">
            {t("exploreLead")}
          </p>
        </div>

        <Reveal variant="up">
          <div className="flex flex-col gap-8">
            {hasCategories && (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold tracking-wide text-secondary-foreground/75 uppercase">
                  {t("categories")}
                </h3>
                <CategoryCards categories={categories} activeSlug={activeCategorySlug} />
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold tracking-wide text-secondary-foreground/75 uppercase">
                  {t("popularTags")}
                </h3>
                <TagChips tags={tags} activeSlug={activeTagSlug} />
              </div>
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
