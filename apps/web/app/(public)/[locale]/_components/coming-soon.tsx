// The page a destination shows while it is still being built (changes-22).
//
// `/tools` and `/markets` are in the header, in the footer and on the
// homepage's explore carousel, and neither had a route: both fell through the
// `[...slug]` catch-all, found no published CMS page, and rendered the site's
// 404 — an error page with a "Back home" button, reached by following the
// site's own navigation. A reader cannot tell that from a broken link.
//
// So they get a real page. The shape is deliberate and is the whole argument
// for building this rather than shipping a one-line stub:
//
//   1. It says what is coming, specifically. "Coming soon" on its own is
//      indistinguishable from a dead end; three concrete bullets are a reason
//      to come back.
//   2. It hands the reader somewhere to go NOW — the four finished sections,
//      as real cards, not a single "back home" button that undoes their
//      navigation.
//   3. It is `noindex, follow` at each call site. A page with no content of
//      its own should not be in an index, but the links out of it should be
//      followed.
//
// One component, two routes: a second copy is how the two would end up
// describing the site differently. Adding a third destination is a
// `COMING_SOON_SECTIONS` entry and a three-line route file.
//
// When a section actually lands, its route file stops rendering this — and
// `explore-destinations.test.ts` reads the route file to check that the
// carousel's `status` agrees, so a shipped feature cannot leave its card
// advertising a page that no longer says "coming soon".
import { BookA, CalendarDays, GraduationCap, Newspaper } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { IconCard } from "@repo/ui/components/icon-card";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";

/**
 * The sections that render this page.
 *
 * Keyed by a catalog prefix rather than by free text, so the title and the
 * three bullets are `public.<key>Title` / `public.<key>Point1..3` and no copy
 * lives in this file (code-style.md #2).
 */
// `tools` left this list in changes-25 T6, when the section shipped.
export const COMING_SOON_SECTIONS = ["markets"] as const;

export type ComingSoonSection = (typeof COMING_SOON_SECTIONS)[number];

/** The finished sections offered as the way onward. Order is "learn first". */
const ELSEWHERE = [
  { key: "goLearn", href: ROUTE_PATHS.learn, icon: GraduationCap },
  { key: "goGlossary", href: ROUTE_PATHS.glossary, icon: BookA },
  { key: "goCalendar", href: ROUTE_PATHS["economic-calendar"], icon: CalendarDays },
  { key: "goNews", href: ROUTE_PATHS.news, icon: Newspaper },
] as const;

export async function ComingSoon({ section }: { section: ComingSoonSection }) {
  const t = await getTranslations("public");
  const sectionName = t(`${section}Title`);

  return (
    <main>
      <PageHero
        // `compact`, like the glossary term banner: this page's job is to
        // explain itself and move the reader on, and a full section masthead
        // over three bullets is a lot of band for a little news.
        size="compact"
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        eyebrow={t("comingSoonEyebrow")}
        title={t("comingSoonTitle", { section: sectionName })}
        lead={t("comingSoonLead")}
      />

      <Section spacing="md">
        <Container size="narrow" className="flex flex-col gap-4">
          <SectionHeading title={t("comingSoonPlanTitle")} />
          <ul className="flex flex-col gap-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="flex items-start gap-3">
                {/* A mark, not a bullet glyph: the tint + `-interactive` ink
                    pairing ADR-073 derives readable in both modes. */}
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-interactive"
                />
                <span className="text-pretty text-muted-foreground">
                  {t(`${section}Point${n}`)}
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section spacing="md" tone="muted">
        <Container className="flex flex-col gap-6">
          <SectionHeading
            title={t("comingSoonElsewhereTitle")}
            lead={t("comingSoonElsewhereLead")}
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ELSEWHERE.map((entry, index) => (
              <li key={entry.key} className="flex">
                <Reveal variant="up" delay={Math.min(index, 5) * 60} className="flex w-full">
                  <IconCard
                    className="w-full"
                    icon={entry.icon}
                    title={t(entry.key)}
                    render={<Link href={entry.href} />}
                  >
                    {/* No arrow glyph: IconCard's own lift and icon fill are
                        the affordance, and `.hover-arrow` keys off a bare
                        `.group`, which IconCard's NAMED `group/icon-card`
                        does not emit — it would have sat still. */}
                    <span className="text-sm text-muted-foreground">{t(`${entry.key}Body`)}</span>
                  </IconCard>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </main>
  );
}
