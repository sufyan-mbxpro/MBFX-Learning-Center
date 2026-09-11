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
// The figures under it are COUNTED from the entries the page already loaded —
// never a claim typed into a catalog. A glossary with nothing published shows
// no strip at all rather than three zeroes, exactly as the learn and quiz
// mastheads do.
import { ArrowDown, BookOpen, FolderTree, Layers } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Section } from "@repo/ui/components/section";
import { StatCard } from "@repo/ui/components/stat-card";

import { GlossaryBackdrop } from "./glossary-art.tsx";

export interface GlossaryStats {
  terms: number;
  topics: number;
  /** Distinct first letters that actually have a term under them. */
  letters: number;
}

export async function GlossaryMasthead({
  stats,
  featured,
}: {
  stats: GlossaryStats;
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
          // `secondary` rides on --primary-foreground, the one ink ADR-003
          // derives to be legible on the `brand` tone this hero defaults to.
          <Button size="xl" shape="pill" variant="secondary" render={<a href="#glossary-browse" />}>
            {t("heroBrowse")}
            {/* Down, not inline-end: this scrolls the page rather than
                navigating, so it needs no RTL flip either. */}
            <ArrowDown aria-hidden />
          </Button>
        }
      />

      {/* The two featured cards sit BELOW the hero rather than inside it. In
          the hero they would ride on the brand fill, where their own
          `bg-primary/5` and `bg-info/5` surfaces are not contrast-checked
          against that ground (ADR-018 #5) — the same reason the stat strip is
          its own muted band. */}
      {featured && (
        <Section spacing="sm" tone="muted">
          <Container>
            <div className="grid gap-4 md:grid-cols-2">{featured}</div>
          </Container>
        </Section>
      )}

      {stats.terms > 0 && (
        <Section spacing="sm">
          <Container>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
              <StatItem
                icon={<BookOpen aria-hidden className="size-5" />}
                value={stats.terms}
                label={t("statTerms")}
              />
              <StatItem
                icon={<Layers aria-hidden className="size-5" />}
                value={stats.letters}
                label={t("statLetters")}
              />
              {/* Absent, not zero: a glossary whose terms are unfiled has no
                  topics to count and the strip narrows to two. */}
              {stats.topics > 0 && (
                <StatItem
                  icon={<FolderTree aria-hidden className="size-5" />}
                  value={stats.topics}
                  label={t("statTopics")}
                />
              )}
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}

/** StatCard plus the glyph above it — the count-up itself is StatCard's. */
function StatItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-interactive">
        {icon}
      </span>
      <StatCard value={value} label={label} />
    </div>
  );
}
