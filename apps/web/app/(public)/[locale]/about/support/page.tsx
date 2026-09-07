// /about/support — the reference's "Trading Support", rebuilt for a
// learning centre (ADR-047).
//
// The channel list is data-gated: with no contact details recorded in
// ABOUT_FACTS, the page shows what we can help WITH and where to look
// first, and simply omits the "here is how to reach us" band rather than
// printing a placeholder address nobody reads.
import type { Metadata } from "next";
import {
  ArrowRight,
  BookA,
  CalendarDays,
  ChartLine,
  Clock,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { IconCard } from "@repo/ui/components/icon-card";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { AboutBackdrop } from "../_components/about-art.tsx";
import { HeroActions } from "../_components/hero-actions.tsx";
import { ABOUT_FACTS, type SupportChannel } from "../_content/about-facts.ts";

const HELP = ["gettingStarted", "lesson", "tools", "account"] as const;
const HELP_ICONS = {
  gettingStarted: ArrowRight,
  lesson: BookA,
  tools: ChartLine,
  account: MessageCircle,
} as const;

const CHANNEL_ICONS: Record<SupportChannel["kind"], typeof Mail> = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  hours: Clock,
};

const SELF_SERVE = [
  { key: "glossary", feature: "glossary", href: ROUTE_PATHS.glossary, icon: BookA },
  { key: "analysis", feature: "analysis", href: ROUTE_PATHS.analysis, icon: ChartLine },
  {
    key: "calendar",
    feature: "economic_calendar",
    href: ROUTE_PATHS["economic-calendar"],
    icon: CalendarDays,
  },
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about/support">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("meta.supportTitle")),
    description: t("meta.supportDescription"),
  };
}

export default async function SupportPage({ params }: PageProps<"/[locale]/about/support">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "about" });
  const visibility = await Promise.all(
    SELF_SERVE.map((entry) => isFeatureVisible(entry.feature, null)),
  );
  const selfServe = SELF_SERVE.filter((_, index) => visibility[index]);
  const channels = ABOUT_FACTS.support.channels;

  return (
    <>
      <PageHero
        backdrop={<AboutBackdrop slot="supportHero" />}
        eyebrow={t("support.hero.eyebrow")}
        title={t("support.hero.title")}
        lead={t("support.hero.body")}
        actions={
          <HeroActions
            primary={{ label: t("support.hero.primaryCta"), href: ROUTE_PATHS.glossary }}
            secondary={{ label: t("support.hero.secondaryCta"), href: ROUTE_PATHS.learn }}
          />
        }
      />

      {channels.length > 0 && (
        <Section spacing="md" tone="muted">
          <Container className="flex flex-col gap-6">
            <SectionHeading title={t("support.channels.title")} lead={t("support.channels.lead")} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {channels.map((channel) => {
                const Icon = CHANNEL_ICONS[channel.kind];
                return (
                  <li
                    key={`${channel.kind}-${channel.value}`}
                    className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="text-sm font-medium text-card-foreground">
                      {channel.value}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Container>
        </Section>
      )}

      <Section spacing="lg">
        <Container className="flex flex-col gap-10">
          <Reveal variant="up">
            <SectionHeading
              eyebrow={t("support.help.eyebrow")}
              title={t("support.help.title")}
              lead={t("support.help.lead")}
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HELP.map((key, index) => (
              <Reveal key={key} variant="up" delay={index * 60}>
                <IconCard
                  icon={HELP_ICONS[key]}
                  title={t(`support.help.${key}.title`)}
                  className="h-full"
                >
                  {t(`support.help.${key}.body`)}
                </IconCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {selfServe.length > 0 && (
        <Section spacing="lg" tone="muted">
          <Container className="flex flex-col gap-10">
            <Reveal variant="up">
              <SectionHeading
                title={t("support.selfServe.title")}
                lead={t("support.selfServe.lead")}
              />
            </Reveal>
            <div className="grid gap-4 md:grid-cols-3">
              {selfServe.map((entry, index) => (
                <Reveal key={entry.key} variant="up" delay={index * 60}>
                  <IconCard
                    icon={entry.icon}
                    title={t(`support.selfServe.${entry.key}Title`)}
                    render={<Link href={entry.href} />}
                    className="h-full"
                  >
                    {t(`support.selfServe.${entry.key}`)}
                  </IconCard>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      )}

      <Section spacing="md">
        <Container>
          <CtaBand title={t("support.cta.title")} description={t("support.cta.description")}>
            <Button
              size="lg"
              shape="pill"
              variant="secondary"
              render={<Link href={ROUTE_PATHS.learn} />}
            >
              {t("support.cta.action")}
            </Button>
          </CtaBand>
        </Container>
      </Section>
    </>
  );
}
