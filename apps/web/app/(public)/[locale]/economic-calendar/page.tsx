import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  CalendarClock,
  CalendarOff,
  ChartNoAxesCombined,
  ExternalLink,
  Flame,
  Gauge,
  History,
  Target,
  Waves,
  Wifi,
} from "lucide-react";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { ECONOMIC_CALENDAR_ATTRIBUTION_URL, economicCalendarWidgetUrl } from "@repo/utils";
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
import { AccentCard } from "./_components/accent-card.tsx";
import { CalendarMedia } from "./_components/calendar-media.tsx";
import { CALENDAR_MEDIA } from "./_content/calendar-media.ts";
import { RiskDisclaimer } from "../_sections/risk-disclaimer.tsx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/economic-calendar">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("economicCalendar"),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("title")),
    description: t("intro"),
  };
}

/**
 * The economic calendar (Module 13, ADR-050).
 *
 * The events themselves come from an embedded third-party widget rather
 * than our own synced models — an interim answer the ADR records in full,
 * including what it costs. What this file owns is everything AROUND the
 * frame: a masthead, a legend where colour carries the meaning, an
 * explainer for the three numbers, and a plan-your-week callout. That is
 * the part a beginner actually needs, and the part that survives the swap
 * to our own data.
 *
 * No client component anywhere on this page: every hover effect is CSS on a
 * server-rendered element, so the whole thing costs zero JS beyond the
 * frame's own.
 */
export default async function EconomicCalendarPage({
  params,
}: PageProps<"/[locale]/economic-calendar">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Disabled feature → 404, not a blank page (same posture as /glossary).
  if (!(await isFeatureVisible("economic_calendar", null))) notFound();

  const [t, analysisEnabled] = await Promise.all([
    getTranslations("economicCalendar"),
    isFeatureVisible("analysis", null),
  ]);
  const widgetUrl = economicCalendarWidgetUrl({ locale });

  // Ordered loudest → quietest, so the row itself reads as the scale.
  const impacts = [
    {
      key: "high",
      tone: "destructive",
      icon: Flame,
      label: t("impactHigh"),
      body: t("impactHighBody"),
    },
    {
      key: "medium",
      tone: "warning",
      icon: ChartNoAxesCombined,
      label: t("impactMedium"),
      body: t("impactMediumBody"),
    },
    { key: "low", tone: "success", icon: Waves, label: t("impactLow"), body: t("impactLowBody") },
    {
      key: "holiday",
      tone: "muted",
      icon: CalendarOff,
      label: t("impactHoliday"),
      body: t("impactHolidayBody"),
    },
  ] as const;

  const columns = [
    { key: "actual", tone: "primary", icon: Gauge, label: t("actualLabel"), body: t("actualBody") },
    {
      key: "forecast",
      tone: "info",
      icon: Target,
      label: t("forecastLabel"),
      body: t("forecastBody"),
    },
    {
      key: "previous",
      tone: "muted",
      icon: History,
      label: t("previousLabel"),
      body: t("previousBody"),
    },
  ] as const;

  return (
    <main className="flex flex-col">
      <PageHero
        // No backdrop artwork on this hero, so the motif is the only
        // texture in the band and runs at full arrangement ink.
        motif={<AmbientMotif variant="chart" />}
        eyebrow={t("heroEyebrow")}
        title={t("title")}
        lead={t("intro")}
        footnote={t("heroFootnote")}
        actions={
          <>
            {/* A same-page anchor, so `render` takes a plain <a>: @repo/i18n's
                Link would locale-prefix a bare fragment. */}
            <Button size="xl" shape="pill" variant="secondary" render={<a href="#calendar" />}>
              {t("viewWeekAction")}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
            {analysisEnabled && (
              <Button
                size="xl"
                shape="pill"
                variant="outline"
                // The hero band is a --primary gradient, and every button
                // variant is designed against --background. Riding on
                // --primary-foreground is the one ink ADR-003 derives to be
                // legible here (the About heroes do the same).
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                render={<Link href={ROUTE_PATHS.analysis} />}
              >
                {t("readAnalysisAction")}
              </Button>
            )}
          </>
        }
        media={<CalendarMedia src={CALENDAR_MEDIA.hero} alt={t("heroMediaAlt")} tone="onBrand" />}
      />

      <Section spacing="lg" id="calendar" className="scroll-mt-(--height-header)">
        <Container className="flex flex-col gap-8">
          <Reveal variant="up">
            <SectionHeading
              eyebrow={t("calendarEyebrow")}
              title={t("calendarTitle")}
              lead={t("calendarLead")}
            />
          </Reveal>

          {/* The vendor widget renders light-only (ADR-050 consequence 1), so
              the frame is given an explicit light colour-scheme — that keeps
              its own scrollbars and form controls consistent with what is
              inside it instead of half-adopting our dark mode. */}
          <Reveal variant="up" delay={80}>
            <div className="overflow-hidden rounded-2xl bg-card shadow-md ring-1 ring-foreground/10">
              <iframe
                src={widgetUrl}
                title={t("frameTitle")}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-[45rem] w-full [color-scheme:light] sm:h-[52rem] lg:h-[58rem]"
              />
            </div>
          </Reveal>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              {t("attribution")}{" "}
              <a
                href={ECONOMIC_CALENDAR_ATTRIBUTION_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="link-underline hover:text-foreground"
              >
                MQL5
              </a>
            </p>
            <a
              href={widgetUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="link-underline inline-flex items-center gap-1.5 hover:text-foreground"
            >
              {t("openLabel")}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>
        </Container>
      </Section>

      <Section spacing="lg" tone="muted">
        <Container className="flex flex-col gap-10">
          <Reveal variant="up">
            <SectionHeading
              eyebrow={t("legendEyebrow")}
              title={t("legendTitle")}
              lead={t("legendIntro")}
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {impacts.map((impact, index) => (
              <Reveal key={impact.key} variant="up" delay={index * 60}>
                <AccentCard icon={impact.icon} tone={impact.tone} title={impact.label}>
                  {impact.body}
                </AccentCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section spacing="lg">
        <Container className="flex flex-col gap-10">
          <Reveal variant="up">
            <SectionHeading
              eyebrow={t("columnsEyebrow")}
              title={t("columnsTitle")}
              lead={t("columnsLead")}
            />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {columns.map((column, index) => (
              <Reveal key={column.key} variant="up" delay={index * 60}>
                <AccentCard icon={column.icon} tone={column.tone} title={column.label}>
                  {column.body}
                </AccentCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <SplitCallout
        spacing="lg"
        tone="muted"
        reverse
        eyebrow={t("howToEyebrow")}
        title={t("howToTitle")}
        media={<CalendarMedia src={CALENDAR_MEDIA.howTo} alt={t("howToMediaAlt")} />}
        actions={
          <Button size="lg" shape="pill" render={<a href="#calendar" />}>
            {t("viewWeekAction")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        }
      >
        <p>{t("howToLead")}</p>
        <CheckList
          items={[t("howToStepOne"), t("howToStepTwo"), t("howToStepThree"), t("howToStepFour")]}
        />
      </SplitCallout>

      <Section spacing="lg">
        <Container className="flex flex-col gap-10">
          <Reveal variant="up">
            <SectionHeading eyebrow={t("notesEyebrow")} title={t("notesTitle")} />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal variant="up">
              <AccentCard icon={CalendarClock} tone="info" title={t("timezoneTitle")}>
                {t("timezoneBody")}
              </AccentCard>
            </Reveal>
            <Reveal variant="up" delay={60}>
              <AccentCard icon={Wifi} tone="warning" title={t("unavailableTitle")}>
                {t("unavailableBody")}
              </AccentCard>
            </Reveal>
          </div>
        </Container>
      </Section>

      {analysisEnabled && (
        <Section spacing="md">
          <Container>
            <Reveal variant="up">
              <CtaBand title={t("ctaTitle")} description={t("ctaDescription")}>
                <Button
                  size="lg"
                  shape="pill"
                  variant="secondary"
                  render={<Link href={ROUTE_PATHS.analysis} />}
                >
                  {t("ctaAction")}
                  <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
                </Button>
              </CtaBand>
            </Reveal>
          </Container>
        </Section>
      )}

      <RiskDisclaimer />
    </main>
  );
}
