// The glossary masthead (ADR-069's public half) — `LearnMasthead`'s sibling.
//
// Built on `PageHero` rather than a hand-rolled band, so the tone/contrast
// decisions are made once in the primitive (its header records why a `bg-*`
// through className and `--muted-foreground` on a filled band are both traps).
//
// Replaces a `Section spacing="sm" tone="muted"` with an `h1` in it. The
// glossary is a destination in its own right — it is linked from both schools'
// menus and from every lesson — and a section front that looks like a
// subsection of something else undersells it.
//
// The action is an in-page anchor, not a navigation: on a phone the A–Z is
// several screens down, and a masthead that only repeats the page's name has
// not earned its height.
//
// No counted-figures strip under it (ADR-076 §3): totals of terms, letters and
// topics are an operator's numbers, not a reader's.
import { ArrowDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Section } from "@repo/ui/components/section";

import { GlossaryBackdrop } from "./glossary-art.tsx";

export async function GlossaryMasthead({
  featured,
}: {
  /** The Term-of-the-day / Topic-of-the-day pair, composed by the page. */
  featured?: React.ReactNode;
}) {
  const t = await getTranslations("glossary");

  return (
    <>
      <PageHero
        // `priority` on this one piece: it is the LCP candidate on the route.
        backdrop={<GlossaryBackdrop slot="banner" priority />}
        // Composed WITH the artwork rather than instead of it: the generated
        // banner is a soft wash and the glyph field is line art, so the two
        // occupy different frequencies. Dialled down because this band already
        // carries a backdrop.
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("intro")}
        actions={
          // The band is `--secondary` now that it shows its photograph
          // (ADR-117), so the default brand FILL is what carries the primary
          // action — a small element with its own paired `--primary-foreground`
          // ink, which is exactly what ADR-018 rule 5 allows and what the
          // whole-band gradient never was.
          <Button size="xl" render={<a href="#glossary-browse" />}>
            {t("heroBrowse")}
            {/* Down, not inline-end: this scrolls the page rather than
                navigating, so it needs no RTL flip either. */}
            <ArrowDown aria-hidden />
          </Button>
        }
      />

      {/* The two featured cards sit BELOW the hero rather than inside it. In
          the hero they would ride on the band's own fill, where their
          `bg-primary/5` and `bg-info/5` surfaces are not contrast-checked
          against that ground (ADR-018 #5) — as true of the photographic
          band ADR-117 gave this masthead as it was of the brand one. */}
      {featured && (
        <Section spacing="sm" tone="muted">
          <Container>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{featured}</div>
          </Container>
        </Section>
      )}
    </>
  );
}
