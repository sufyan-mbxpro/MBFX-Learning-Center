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
import { SectionHeading } from "@repo/ui/components/section-heading";

import { CategoryCards } from "./category-cards.tsx";

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
    <Section tone="muted" spacing="lg">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          eyebrow={t("topicsEyebrow")}
          title={t("exploreTitle")}
          lead={t("exploreLead")}
        />

        <Reveal variant="up">
          <div className="flex flex-col gap-8">
            {hasCategories && (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("categories")}
                </h3>
                <CategoryCards categories={categories} activeSlug={activeCategorySlug} />
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
