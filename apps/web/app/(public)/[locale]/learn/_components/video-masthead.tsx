// The video index's masthead (changes-16 PR 7/10) — `QuizMasthead`'s sibling,
// on the same `PageHero` for the same reason: the tone and contrast decisions
// are made once in the primitive.
//
// A separate component rather than a `QuizMasthead` prop because its artwork
// and its anchor are its own: the video banner, and a jump to the video grid.
//
// No counted-figures strip under it (ADR-076 §3): totals of topics, videos and
// categories are an operator's numbers, not a reader's.
import { ArrowDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { PageHero } from "@repo/ui/components/page-hero";

import { LearnBackdrop } from "./learn-art.tsx";

export async function VideoMasthead({
  heading,
}: {
  /** The school's own name, so "Learn Crypto → Videos" lands on a banner that
   * says which school it is (ADR-065 §1). Passed already translated. */
  heading: { eyebrow: string; title: string; lead: string };
}) {
  const t = await getTranslations("learn");

  return (
    <PageHero
      // changes-49: the News banner's density on every Learn listing.
      size="medium"
      // `priority` on this one piece: it is the LCP candidate on the route.
      // Every video panel below it stays lazy.
      backdrop={<LearnBackdrop slot="videoBanner" priority />}
      // Composed WITH the artwork rather than instead of it: the generated
      // banner is a soft wash and the glyph field is line art, so the two
      // occupy different frequencies. Dialled down because this band already
      // carries a backdrop.
      motif={<AmbientMotif variant="learn" intensity={0.7} />}
      eyebrow={heading.eyebrow}
      title={heading.title}
      lead={heading.lead}
      actions={
        // An in-page anchor, not a navigation: on a phone the grid is a
        // screen down, and a masthead that only repeats the page's name has
        // not earned its height. The band is `--secondary` now that it shows
        // its photograph (ADR-117), so the action keeps the brand FILL — a
        // small element with its own paired ink, ADR-018 rule 5's case.
        <Button size="xl" render={<a href="#videos" />}>
          {t("videos.heroBrowse")}
          {/* Down, not inline-end: this scrolls the page rather than
              navigating, so it needs no RTL flip either. */}
          <ArrowDown aria-hidden />
        </Button>
      }
    />
  );
}
