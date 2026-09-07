// /about/transparency — the reference's "Financial transparency", rebuilt
// as editorial transparency (ADR-047).
//
// The reference page explains a broker's pricing and order handling. Ours
// explains the two things a learning centre can be honest about: where its
// numbers come from, and what it will not do with the reader's attention.
// Every claim here is either checkable on this site or a commitment the
// owner can revise in the catalog — none of it is a financial assertion.
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { CheckList } from "@repo/ui/components/check-list";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { SplitCallout } from "@repo/ui/components/split-callout";
import { AboutArt, AboutBackdrop } from "../_components/about-art.tsx";
import { HeroActions } from "../_components/hero-actions.tsx";

const DELIVERY = ["web", "articles", "glossary", "tools"] as const;
const NOT_DOING = ["noSignals", "noTargets", "noSilentEdits", "noPaidEditorial"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about/transparency">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("meta.transparencyTitle")),
    description: t("meta.transparencyDescription"),
  };
}

export default async function TransparencyPage({
  params,
}: PageProps<"/[locale]/about/transparency">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <>
      <PageHero
        eyebrow={t("transparency.hero.eyebrow")}
        backdrop={<AboutBackdrop slot="transparencyHero" />}
        motif={<AmbientMotif variant="chart" intensity={0.7} />}
        title={t("transparency.hero.title")}
        lead={t("transparency.hero.body")}
        actions={
          <HeroActions
            primary={{ label: t("transparency.hero.primaryCta"), href: ROUTE_PATHS.analysis }}
            secondary={{
              label: t("transparency.hero.secondaryCta"),
              href: ROUTE_PATHS["about-support"],
            }}
          />
        }
      />

      <SplitCallout
        title={t("transparency.sources.title")}
        spacing="lg"
        media={<AboutArt slot="transparencySources" />}
      >
        <p>{t("transparency.sources.body")}</p>
      </SplitCallout>

      <Section spacing="lg" tone="muted">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-16">
          <Reveal variant="up">
            <SectionHeading
              title={t("transparency.delivery.title")}
              lead={t("transparency.delivery.lead")}
            />
          </Reveal>
          <Reveal variant="up" delay={80}>
            <CheckList
              columns={2}
              items={DELIVERY.map((key) => t(`transparency.delivery.${key}`))}
            />
          </Reveal>
        </Container>
      </Section>

      <SplitCallout
        title={t("transparency.funding.title")}
        reverse
        spacing="lg"
        media={<AboutArt slot="transparencyFunding" />}
      >
        <p>{t("transparency.funding.body")}</p>
      </SplitCallout>

      <Section spacing="lg" tone="muted">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-16">
          <Reveal variant="up">
            <SectionHeading
              title={t("transparency.notDoing.title")}
              lead={t("transparency.notDoing.lead")}
            />
          </Reveal>
          <Reveal variant="up" delay={80}>
            <CheckList items={NOT_DOING.map((key) => t(`transparency.notDoing.${key}`))} />
          </Reveal>
        </Container>
      </Section>

      {/* The worked example, as the page's one piece of arithmetic — the
          same "show the numbers" claim the copy makes, made visible. */}
      <Section spacing="lg">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal variant="up" className="flex flex-col gap-4">
            <h2 className="text-display-sm font-semibold text-balance">
              {t("transparency.example.title")}
            </h2>
            <p className="text-pretty text-muted-foreground">{t("transparency.example.body")}</p>
            <div>
              <Button variant="outline" shape="pill" render={<Link href={ROUTE_PATHS.tools} />}>
                {t("transparency.example.cta")}
                <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
              </Button>
            </div>
          </Reveal>
          <Reveal
            variant="end"
            delay={80}
            className="flex flex-col items-center gap-2 rounded-2xl bg-primary p-10 text-center text-primary-foreground"
          >
            <p className="text-sm opacity-80">{t("transparency.example.caption")}</p>
            <p className="text-display-sm font-semibold">{t("transparency.example.value")}</p>
          </Reveal>
        </Container>
      </Section>

      <SplitCallout
        title={t("transparency.corrections.title")}
        tone="muted"
        spacing="lg"
        media={<AboutArt slot="transparencyCorrections" />}
      >
        <p>{t("transparency.corrections.body")}</p>
      </SplitCallout>

      <Section spacing="md">
        <Container>
          <CtaBand
            title={t("transparency.cta.title")}
            description={t("transparency.cta.description")}
          >
            <Button
              size="lg"
              shape="pill"
              variant="secondary"
              render={<Link href={ROUTE_PATHS["about-support"]} />}
            >
              {t("transparency.cta.action")}
            </Button>
          </CtaBand>
        </Container>
      </Section>
    </>
  );
}
