// The thin band under the masthead: how much is here, across how many
// topics, and how fresh it is.
//
// Every figure is derived from the facets the sidebar already reads — no
// extra query, and nothing here can disagree with the categories listed
// beside the grid, because it is the same numbers. A stat band that needs
// its own read is a stat band that eventually contradicts the page it sits
// on.
//
// The counts are real or the band does not render. There is no seeded
// "500+ articles" here and there will not be one: an empty newsroom that
// claims a number is the one thing this section cannot recover from.
import { getTranslations } from "next-intl/server";

import type { ArticleFacets } from "@repo/core";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { StatCard } from "@repo/ui/components/stat-card";

export async function NewsStats({ facets, locale }: { facets: ArticleFacets; locale: string }) {
  const t = await getTranslations("news");

  // Every article has exactly one category (the relation is required), so
  // the category counts sum to the visible total for these kinds — the same
  // set `getPublishedArticles` paginates, without paying for a second count.
  const total = facets.categories.reduce((sum, category) => sum + category.count, 0);
  if (total === 0) return null;

  const latest = facets.latest[0]?.publishedAt ?? null;

  return (
    <Section tone="muted" spacing="sm">
      <Container className="flex flex-col items-center gap-4">
        <Reveal variant="up" className="w-full">
          {/* A plain grid, not a <dl>: StatCard is a div of two <p>s, and a
              <dl> whose children are neither dt/dd nor div-wrapped pairs is
              invalid markup that assistive tech reads unpredictably. The
              figure and its label are one component by design (the count-up
              animation lives on the figure), so bending it into a definition
              list would cost more than the semantics buy. */}
          <div className="grid gap-6 sm:grid-cols-3">
            <StatCard value={total} label={t("statArticles")} />
            <StatCard value={facets.categories.length} label={t("statTopics")} />
            <StatCard value={facets.archives.length} label={t("statMonths")} />
          </div>
        </Reveal>

        {latest && (
          <p className="text-sm text-muted-foreground">
            {t("statUpdated", {
              date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(latest),
            })}
          </p>
        )}
      </Container>
    </Section>
  );
}
