// Listing page header (changes-04 image-10): centred title with a
// breadcrumb trail beneath it, on a muted band.
//
// This is the plain header the ARCHIVES use — /analysis, /news/category/*,
// /news/tag/*. The /news landing itself opens on `NewsMasthead`, a full
// banner with artwork: an archive is a filtered view of a section, the
// section front is the section. The trail is the same component on both.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";

import { type Crumb, ListingCrumbs } from "./listing-crumbs.tsx";

export type { Crumb };

export function ListingHeader({
  title,
  intro,
  crumbs,
}: {
  title: string;
  intro?: string;
  crumbs?: Crumb[];
}) {
  return (
    <Section tone="muted" spacing="sm">
      <Container className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-display-sm font-semibold">{title}</h1>
        <ListingCrumbs crumbs={crumbs} className="flex justify-center" />
        {intro && <p className="max-w-2xl text-muted-foreground">{intro}</p>}
      </Container>
    </Section>
  );
}
