// "What's here" — the four-to-six ways into the Learning Center.
//
// Every card is gated on the same feature flag its navigation entry uses
// (see seed.ts's NAV). A card for a disabled feature would link to a route
// that 404s by design (Module 12: disabled features 404, never blank), so
// the honest thing is not to offer it. With every flag off this section
// renders nothing at all, exactly like the facts-gated ones.
import { BookA, Calculator, CalendarDays, ChartLine, GraduationCap, Newspaper } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { IconCard } from "@repo/ui/components/icon-card";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";

const CARDS = [
  { key: "courses", feature: "courses", href: ROUTE_PATHS.learn, icon: GraduationCap },
  { key: "glossary", feature: "glossary", href: ROUTE_PATHS.glossary, icon: BookA },
  { key: "analysis", feature: "analysis", href: ROUTE_PATHS.analysis, icon: ChartLine },
  { key: "news", feature: "news", href: ROUTE_PATHS.news, icon: Newspaper },
  { key: "tools", feature: "calculators", href: ROUTE_PATHS.tools, icon: Calculator },
  {
    key: "calendar",
    feature: "economic_calendar",
    href: ROUTE_PATHS["economic-calendar"],
    icon: CalendarDays,
  },
] as const;

export async function OfferGrid({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "about" });
  const visibility = await Promise.all(CARDS.map((card) => isFeatureVisible(card.feature, null)));
  const visible = CARDS.filter((_, index) => visibility[index]);

  if (visible.length === 0) return null;

  return (
    <Section spacing="lg">
      <Container className="flex flex-col gap-10">
        <Reveal variant="up">
          <SectionHeading
            eyebrow={t("overview.offer.eyebrow")}
            title={t("overview.offer.title")}
            lead={t("overview.offer.lead")}
          />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((card, index) => (
            <Reveal key={card.key} variant="up" delay={index * 60}>
              <IconCard
                icon={card.icon}
                title={t(`overview.offer.${card.key}.title`)}
                render={<Link href={card.href} />}
                className="h-full"
              >
                {t(`overview.offer.${card.key}.body`)}
              </IconCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
