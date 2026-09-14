// The `/learn` masthead (design pass 2026-09-09) — `NewsMasthead`'s sibling.
//
// The section front gets a banner with artwork; the pages beneath it keep
// their own, quieter headers. The distinction is the one /news already draws:
// a masthead is the section announcing itself, and repeating it on every page
// underneath turns it into a scroll tax.
//
// Built on `PageHero` rather than a hand-rolled band, so the tone/contrast
// decisions are made once in the primitive (its header comment records why a
// `bg-*` through className and `--muted-foreground` on a filled band are both
// traps).
//
// The two actions are in-page anchors, not navigations. On a phone the shelf
// and the video rail are several screens down, and a masthead that only
// repeats the page's name has not earned its height.
//
// No counted-figures strip under it (ADR-076 §3): totals of courses, lessons
// and hours are an operator's numbers, and they belong to the admin's
// dashboards, not to a reader's page.
import { ArrowDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { PageHero } from "@repo/ui/components/page-hero";

import { LearnBackdrop } from "./learn-art.tsx";

export async function LearnMasthead({
  hasVideos,
  heading,
  backdrop,
}: {
  /** Whether the video rail is on the page — an anchor to a band that is not
   * rendered is a button that silently does nothing. */
  hasVideos: boolean;
  /**
   * The school's own name and blurb (ADR-065 §1). Omitted on `/learn`, which
   * is the umbrella above both and keeps the area-level copy. Passed already
   * translated: the track's message keys live in the LEARN_TRACKS registry
   * relative to this namespace, and the page has resolved them to build its
   * shelf anyway.
   */
  heading?: { eyebrow: string; title: string; lead: string };
  /** Overrides the area banner — a track page uses its own generated panel. */
  backdrop?: React.ReactNode;
}) {
  const t = await getTranslations("learn");

  return (
    <PageHero
      // `priority` on this one piece: it is the LCP candidate on the route.
      // Every other image on the page — course covers included — stays lazy.
      backdrop={backdrop ?? <LearnBackdrop slot="banner" priority />}
      // Composed WITH the artwork rather than instead of it: the generated
      // banner is a soft wash and the glyph field is line art, so the two
      // occupy different frequencies. Dialled down because this band already
      // carries a backdrop.
      motif={<AmbientMotif variant="learn" intensity={0.7} />}
      eyebrow={heading?.eyebrow ?? t("index.eyebrow")}
      title={heading?.title ?? t("index.title")}
      lead={heading?.lead ?? t("index.intro")}
      // Both buttons ride on --primary-foreground, the one ink ADR-003
      // derives to be legible on the `brand` tone this hero defaults to.
      actions={
        <>
          <Button size="xl" shape="pill" variant="secondary" render={<a href="#courses" />}>
            {t("index.heroBrowse")}
            {/* Down, not inline-end: this scrolls the page rather than
                navigating, so it needs no RTL flip either. */}
            <ArrowDown aria-hidden />
          </Button>
          {hasVideos && (
            <Button
              size="xl"
              shape="pill"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              render={<a href="#videos" />}
            >
              {t("index.heroVideos")}
            </Button>
          )}
        </>
      }
    />
  );
}
