// /about — the section's overview page (ADR-047).
//
// Composition is fixed in code, not admin-configurable (ADR-042). Four of
// the eight sections below are data-gated and render nothing when ABOUT_FACTS
// is empty; that is the designed state, not a stub, and it is still what
// happens in "real" mode (ADR-051 §2).
//
// The below-the-fold sections stream (ADR-051 §6). Each reads settings or
// feature flags, and `OfferGrid` alone awaits six flag lookups — without a
// boundary the hero waits for all of them before a single pixel paints. The
// fallbacks match the real sections' proportions so nothing jumps when the
// content lands, and the HTML still contains everything for a crawler: this
// is Next's streaming, not client-side deferral.
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { PageHero } from "@repo/ui/components/page-hero";
import { Section } from "@repo/ui/components/section";
import { AboutBackdrop } from "./_components/about-art.tsx";
import { SectionFallback } from "./_components/section-fallback.tsx";
import { History, KeyFigures, Payments, Recognition } from "./_sections/facts-sections.tsx";
import { LearnMore } from "./_sections/learn-more.tsx";
import { OfferGrid } from "./_sections/offer-grid.tsx";
import { HeroActions } from "./_components/hero-actions.tsx";
import { Principles } from "./_sections/principles.tsx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("meta.aboutUsTitle")),
    description: t("meta.aboutUsDescription"),
  };
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <>
      <PageHero
        backdrop={<AboutBackdrop slot="overviewHero" />}
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        eyebrow={t("overview.hero.eyebrow")}
        title={t("overview.hero.title")}
        lead={t("overview.hero.body")}
        actions={
          <HeroActions
            primary={{ label: t("overview.hero.primaryCta"), href: ROUTE_PATHS.learn }}
            secondary={{ label: t("overview.hero.secondaryCta"), href: ROUTE_PATHS.glossary }}
          />
        }
      />

      <Suspense fallback={<SectionFallback variant="band" />}>
        <KeyFigures locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionFallback variant="grid" />}>
        <OfferGrid locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionFallback variant="split" tone="muted" />}>
        <Principles locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionFallback variant="list" />}>
        <History locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionFallback variant="grid" tone="muted" />}>
        <Recognition locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionFallback variant="band" />}>
        <Payments locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionFallback variant="grid" />}>
        <LearnMore locale={locale} />
      </Suspense>

      <Section spacing="md">
        <Container>
          <CtaBand title={t("overview.cta.title")} description={t("overview.cta.description")}>
            <Button
              size="lg"
              shape="pill"
              variant="secondary"
              render={<Link href={ROUTE_PATHS.learn} />}
            >
              {t("overview.cta.action")}
            </Button>
          </CtaBand>
        </Container>
      </Section>
    </>
  );
}
