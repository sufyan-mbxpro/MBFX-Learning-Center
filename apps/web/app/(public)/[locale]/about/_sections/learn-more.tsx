// The reference's "Want to know more?" trio — three cards into the rest of
// the section. Labels reuse `about.nav.*`, so the card, the sub-nav and the
// mega-menu panel all call each page the same thing.
import { BadgeCheck, Headset, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { IconCard } from "@repo/ui/components/icon-card";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";

const CARDS = [
  {
    key: "whyUs",
    navKey: "nav.whyUs",
    href: ROUTE_PATHS["about-why-us"],
    icon: BadgeCheck,
  },
  {
    key: "transparency",
    navKey: "nav.transparency",
    href: ROUTE_PATHS["about-transparency"],
    icon: Scale,
  },
  {
    key: "support",
    navKey: "nav.support",
    href: ROUTE_PATHS["about-support"],
    icon: Headset,
  },
] as const;

export async function LearnMore({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <Section spacing="lg">
      <Container className="flex flex-col gap-10">
        <Reveal variant="up">
          <SectionHeading
            title={t("overview.learnMore.title")}
            align="center"
            className="mx-auto"
          />
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map((card, index) => (
            <Reveal key={card.key} variant="up" delay={index * 60}>
              <IconCard
                icon={card.icon}
                title={t(card.navKey)}
                render={<Link href={card.href} />}
                className="h-full"
              >
                {t(`overview.learnMore.${card.key}`)}
              </IconCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
