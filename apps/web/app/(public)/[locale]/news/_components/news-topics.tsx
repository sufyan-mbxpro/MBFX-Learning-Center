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
//
// ─── A photograph behind it (changes-37, ADR-121 §5) ─────────────────────
//
// The band used to lay generated vector art under the page ground at 14%,
// which read as a faint smudge. It now shows the owner's photography the way
// a masthead does since ADR-117: an `inverted` (`--secondary`) band, the
// picture at full strength, and a `--secondary` scrim between the picture and
// the words. The scrim is what carries the contrast guarantee — the heading
// is `--secondary-foreground` on `--secondary`, derived readable by
// construction (ADR-003), whatever the photograph happens to be. The cards
// are opaque `bg-card` tiles and carry their own.
import { getTranslations } from "next-intl/server";

import type { ArticleFacetTerm } from "@repo/core";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

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
    <Section id="topics" tone="inverted" spacing="lg" className="relative isolate overflow-hidden">
      {/* The backdrop is its own layer rather than a class on Section:
          Section composes its tone through `cn` (tailwind-merge), so a
          background passed in className REPLACES the tone's fill instead of
          layering over it — the trap PageHero's header comment records. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 select-none">
        <NewsBackdrop slot="topics" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-secondary/90 via-secondary/70 to-secondary/90"
      />

      <Container className="flex flex-col gap-(--section-gap)">
        {/* Hand-written rather than `SectionHeading`, for the reason the
            `connect` band gives: SectionHeading's eyebrow and lead are
            coloured for `--background`, and this band paints `--secondary`. */}
        <div className="flex flex-col items-start gap-3 text-start">
          <p className="text-xs font-semibold tracking-caps text-secondary-foreground/75 uppercase">
            {t("topicsEyebrow")}
          </p>
          <h2 className="font-display text-display-sm font-bold text-balance text-secondary-foreground">
            {t("topicsTitle")}
          </h2>
          <p className="max-w-2xl text-lg text-pretty text-secondary-foreground/80">
            {t("topicsLead")}
          </p>
        </div>

        <Reveal variant="up">
          <CategoryCards categories={categories} />
        </Reveal>
      </Container>
    </Section>
  );
}
