import type { Metadata } from "next";
import { localizedPath } from "../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  CalendarClock,
  CalendarOff,
  ChartNoAxesCombined,
  Flame,
  Gauge,
  History,
  Target,
  Waves,
  Wifi,
} from "lucide-react";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { CheckList } from "@repo/ui/components/check-list";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { SplitCallout } from "@repo/ui/components/split-callout";
import { AccentCard } from "./_components/accent-card.tsx";
import { CalendarBoard } from "./_components/calendar-board.tsx";
import { CalendarBackdrop } from "./_components/calendar-media.tsx";
import { CalendarMedia } from "./_components/calendar-media.tsx";
import { CALENDAR_MEDIA } from "./_content/calendar-media.ts";

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
    alternates: { canonical: localizedPath(locale, ROUTE_PATHS["economic-calendar"]) },
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
      {/* changes-40: the same masthead every tool page has — `compact`, with
          a photograph behind it. It used to be a full-height `brand` band with
          a 4:3 picture in a column beside the words, which is a section FRONT's
          shape; a reader arrives here to look at this week's releases, and the
          widget was below the fold on a laptop. Supplying a `backdrop` resolves
          `tone` to ADR-117's `photo`, so the band is `--secondary` with the
          picture at full strength under the scrim. */}
      <PageHero
        size="compact"
        backdrop={<CalendarBackdrop />}
        // Dialled down: the backdrop already carries weight, as on every other
        // photographic masthead.
        motif={<AmbientMotif variant="chart" intensity={0.7} />}
        eyebrow={t("heroEyebrow")}
        title={t("title")}
        lead={t("intro")}
        footnote={t("heroFootnote")}
        actions={
          <>
            {/* A same-page anchor, so `render` takes a plain <a>: @repo/i18n's
                Link would locale-prefix a bare fragment. */}
            <Button size="xl" render={<a href="#calendar" />}>
              {t("viewWeekAction")}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
            {analysisEnabled && (
              // `inverted` is the class string this band used to spell out by
              // hand (ADR-117): opacities of `--secondary-foreground`, the one
              // ink ADR-003 derives readable on this fill.
              <Button size="xl" variant="inverted" render={<Link href={ROUTE_PATHS.analysis} />}>
                {t("readAnalysisAction")}
              </Button>
            )}
          </>
        }
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

          {/* The vendor swap (ADR-137). The calendar is TradingView's now, for
              the reason ADR-136 gave the two market boards: it follows the
              reader's colour mode, it takes filters we can drive from our own
              chips, and it is the vendor already in `frame-src`. */}
          <Reveal variant="up" delay={80}>
            <CalendarBoard locale={locale} />
          </Reveal>

          {/* How to WORK the calendar, directly under the calendar (ADR-137
              §4). Distinct from the "plan the week" callout further down: that
              one is about trading around releases, this one is about the
              control the reader is looking at — sorting, filtering, searching,
              opening an event, and reading the flags. A tool's instructions
              belong beside the tool, not four bands away. */}
          <Reveal variant="up" delay={160}>
            <Card>
              <CardContent className="flex flex-col gap-4">
                <h2 className="text-xl font-semibold tracking-tight">{t("usingTitle")}</h2>
                <CheckList
                  items={[
                    t("usingSort"),
                    t("usingFilter"),
                    t("usingSearch"),
                    t("usingDetail"),
                    t("usingFlags"),
                  ]}
                />
              </CardContent>
            </Card>
          </Reveal>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <Button size="lg" render={<a href="#calendar" />}>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Button size="lg" variant="secondary" render={<Link href={ROUTE_PATHS.analysis} />}>
                  {t("ctaAction")}
                  <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
                </Button>
              </CtaBand>
            </Reveal>
          </Container>
        </Section>
      )}
    </main>
  );
}
