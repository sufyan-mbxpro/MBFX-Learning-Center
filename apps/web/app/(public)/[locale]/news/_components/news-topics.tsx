// "Browse by topic" — the category index as a set of cards rather than as a
// list of links in a sidebar panel.
//
// The sidebar keeps its own compact list; this band is for the reader who
// arrived at the section front without a story in mind, which the sidebar
// (below the fold on a phone, beside the grid on a desktop) serves badly.
// Same destinations, same counts, same single `getArticleFacets` read — no
// second source of truth, so the two can never disagree.
//
// The tiles themselves are `CategoryCards`, shared with the two archives.
import { getTranslations } from "next-intl/server";

import type { ArticleFacetTerm } from "@repo/core";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";

import { CategoryCards } from "./category-cards.tsx";
import { NewsBackdrop } from "./news-art.tsx";

export async function NewsTopics({ categories }: { categories: ArticleFacetTerm[] }) {
  const t = await getTranslations("news");

  // A section with one topic is not a way to browse, it is a mislabelled
  // link. Two is the floor at which "browse by topic" is a true statement.
  if (categories.filter((category) => category.count > 0).length < 2) return null;

  return (
    // `id` is the masthead's second action target. On the section, not on the
    // heading: an in-page jump should land above the band, not with its top
    // rule already scrolled past.
    // `default` tone, not `muted`: the bands around this one can be muted, and
    // two muted bands in a row read as one flat expanse with a heading loose
    // in the middle. The backdrop below is what gives this band its surface.
    <Section id="topics" spacing="lg" className="relative isolate overflow-hidden">
      {/* The backdrop is its own layer rather than a class on Section:
          Section composes its tone through `cn` (tailwind-merge), so a
          background passed in className REPLACES `bg-muted/40` instead of
          layering over it — the trap PageHero's header comment records. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14]">
        <NewsBackdrop slot="topics" />
      </div>

      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          eyebrow={t("topicsEyebrow")}
          title={t("topicsTitle")}
          lead={t("topicsLead")}
        />

        <Reveal variant="up">
          <CategoryCards categories={categories} />
        </Reveal>
      </Container>
    </Section>
  );
}
