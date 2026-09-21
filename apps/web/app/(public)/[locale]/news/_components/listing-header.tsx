// Listing page header (changes-04 image-10): centred title with a
// breadcrumb trail beneath it, on a muted band.
//
// Since changes-38 only the article DETAIL page uses it: every listing —
// /news, /analysis, /news/category/*, /news/tag/* — opens on `NewsMasthead`,
// because the owner asked for the four to share one shape. The trail is the
// same component on both.
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";

import { type Crumb, ListingCrumbs } from "./listing-crumbs.tsx";

export type { Crumb };

export function ListingHeader({
  title,
  titleLang,
  titleDir,
  intro,
  crumbs,
}: {
  title: string;
  /** ADR-127: the title's own language, when it differs from the page's. */
  titleLang?: string;
  titleDir?: "ltr" | "rtl";
  intro?: string;
  crumbs?: Crumb[];
}) {
  return (
    // The archives get the same `chart` field as the section front, at a
    // lower ink: this band is a third the masthead's height, so the same
    // arrangement sits proportionally closer to the title. The three
    // positioning classes are what AmbientMotif anchors to and is clipped
    // by; Section provides none of them.
    <Section tone="muted" spacing="sm" className="relative isolate overflow-hidden">
      <AmbientMotif variant="chart" intensity={0.75} />
      <Container className="flex flex-col items-center gap-2 text-center">
        <h1 lang={titleLang} dir={titleDir} className="text-display-sm font-semibold">
          {title}
        </h1>
        <ListingCrumbs crumbs={crumbs} className="flex justify-center" />
        {intro && <p className="max-w-2xl text-muted-foreground">{intro}</p>}
      </Container>
    </Section>
  );
}
