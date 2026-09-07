// /about/why-us — the reference's "Five reasons", rebuilt for a learning
// centre (ADR-047).
//
// Every reason links to something that already exists on this site, and
// each is gated on the same feature flag its destination is: a reason to
// use a feature that is switched off is not a reason, it is a 404 with a
// paragraph attached.
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
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

const COMMITMENTS = [
  "noAccount",
  "noSignals",
  "afterTheMove",
  "riskInline",
  "ownProducts",
] as const;

/**
 * `feature: null` means the destination is a coded route with no flag behind
 * it. `media` is part of the row so a reason that is flagged off takes its
 * artwork with it — the alternative, a parallel array indexed by position,
 * silently shifts every picture one place the first time a flag flips.
 *
 * `as const` is what type-checks the media names: each becomes a literal, and
 * `AboutArt`'s `slot` prop only accepts an `AboutMediaKey`, so a typo here is
 * a compile error rather than a missing picture.
 */
const REASONS = [
  { key: "curriculum", feature: "courses", href: ROUTE_PATHS.learn, media: "whyUsPlatforms" },
  { key: "glossary", feature: "glossary", href: ROUTE_PATHS.glossary, media: "whyUsData" },
  { key: "analysis", feature: "analysis", href: ROUTE_PATHS.analysis, media: "whyUsAnalysis" },
  { key: "tools", feature: "calculators", href: ROUTE_PATHS.tools, media: "whyUsTools" },
  { key: "support", feature: null, href: ROUTE_PATHS["about-support"], media: "whyUsSupport" },
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about/why-us">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("meta.whyUsTitle")),
    description: t("meta.whyUsDescription"),
  };
}

export default async function WhyUsPage({ params }: PageProps<"/[locale]/about/why-us">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "about" });
  const visibility = await Promise.all(
    REASONS.map((reason) => (reason.feature ? isFeatureVisible(reason.feature, null) : true)),
  );
  const reasons = REASONS.filter((_, index) => visibility[index]);

  return (
    <>
      <PageHero
        backdrop={<AboutBackdrop slot="whyUsHero" />}
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        eyebrow={t("whyUs.hero.eyebrow")}
        title={t("whyUs.hero.title")}
        lead={t("whyUs.hero.body")}
        actions={
          <HeroActions
            primary={{ label: t("whyUs.hero.primaryCta"), href: ROUTE_PATHS.learn }}
            secondary={{
              label: t("whyUs.hero.secondaryCta"),
              href: ROUTE_PATHS["about-transparency"],
            }}
          />
        }
      />

      <Section spacing="lg">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-16">
          <Reveal variant="up">
            <SectionHeading
              eyebrow={t("whyUs.commitments.eyebrow")}
              title={t("whyUs.commitments.title")}
              lead={t("whyUs.commitments.lead")}
            />
          </Reveal>
          <Reveal variant="up" delay={80}>
            <CheckList items={COMMITMENTS.map((key) => t(`whyUs.commitments.${key}`))} />
          </Reveal>
        </Container>
      </Section>

      <Section spacing="sm" tone="muted">
        <Container>
          <SectionHeading
            eyebrow={t("whyUs.reasons.eyebrow")}
            title={t("whyUs.reasons.title")}
            align="center"
            className="mx-auto"
          />
        </Container>
      </Section>

      {/* Tones alternate so consecutive callouts read as separate blocks,
          and the media column reverses on every other one — the reference's
          zig-zag, expressed as order rather than position so RTL mirrors it. */}
      {reasons.map((reason, index) => (
        <SplitCallout
          key={reason.key}
          step={index + 1}
          title={t(`whyUs.reasons.${reason.key}.title`)}
          reverse={index % 2 === 1}
          tone={index % 2 === 1 ? "muted" : "default"}
          spacing="lg"
          media={<AboutArt slot={reason.media} />}
          actions={
            <Button variant="outline" shape="pill" render={<Link href={reason.href} />}>
              {t(`whyUs.reasons.${reason.key}.cta`)}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
          }
        >
          <p>{t(`whyUs.reasons.${reason.key}.body`)}</p>
        </SplitCallout>
      ))}

      <Section spacing="md">
        <Container>
          <CtaBand title={t("whyUs.cta.title")} description={t("whyUs.cta.description")}>
            <Button
              size="lg"
              shape="pill"
              variant="secondary"
              render={<Link href={ROUTE_PATHS.learn} />}
            >
              {t("whyUs.cta.action")}
            </Button>
          </CtaBand>
        </Container>
      </Section>
    </>
  );
}
