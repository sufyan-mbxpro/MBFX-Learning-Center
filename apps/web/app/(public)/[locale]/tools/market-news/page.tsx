import type { Metadata } from "next";
import { localizedPath } from "../../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CalendarClock, Newspaper, ShieldAlert } from "lucide-react";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal, RevealGroup } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { AccentCard } from "../../economic-calendar/_components/accent-card.tsx";
import { MarketNewsBand } from "../../analysis/_components/market-news-band.tsx";
import { ReviewsBand } from "../../_components/reviews-band.tsx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tools/market-news">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "marketNews" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("title")),
    description: t("lead"),
    alternates: { canonical: localizedPath(locale, ROUTE_PATHS["market-news"]) },
  };
}

/**
 * Around the markets — the vendor's headline feed, on a page of its own
 * (changes-40).
 *
 * It already existed as the last band of `/analysis` (ADR-136 §6), where it is
 * a supplement to our own editorial. The owner asked for it in the Tools menu
 * too, and both are right: on `/analysis` it is what to read AFTER our
 * analysis, and here it is a thing a reader goes to deliberately, beside the
 * rates and the calendar.
 *
 * **One band, rendered twice.** `MarketNewsBand` is imported rather than
 * copied, so the two surfaces cannot drift — and in particular so the sentence
 * saying nobody here reviewed these stories cannot be dropped from one of
 * them.
 *
 * NOT a `TOOLS` member, for the reason ADR-115 #2 gives and ADR-136 §5
 * repeats: a `Tool` row means a config schema, an admin editor and a
 * translation table, and there is nothing here to configure.
 */
export default async function MarketNewsPage({ params }: PageProps<"/[locale]/tools/market-news">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The same flag the live-rates board carries: both are the vendor's market
  // feed under our chrome, and an install that switches one off means both.
  if (!(await isFeatureVisible("market_data", null))) notFound();

  const [t, analysisEnabled, calendarEnabled] = await Promise.all([
    getTranslations({ locale, namespace: "marketNews" }),
    isFeatureVisible("analysis", null),
    isFeatureVisible("economic_calendar", null),
  ]);

  return (
    <>
      <PageHero
        size="compact"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        motif={<AmbientMotif variant="chart" intensity={0.7} />}
        // changes-49: no action in the masthead, so the banner is the same
        // height as every other tool page's. "Read our own analysis" moved
        // under the feed, where it follows the thing it is an alternative to.
      />

      <MarketNewsBand locale={locale} />

      {analysisEnabled && (
        <Container className="-mt-6 pb-4">
          <Button variant="outline" render={<Link href={ROUTE_PATHS.analysis} />}>
            {t("analysisAction")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </Container>
      )}

      <Section tone="muted">
        <Container className="flex flex-col gap-8">
          <Reveal variant="up">
            <h2 className="text-2xl font-semibold tracking-tight">{t("notesTitle")}</h2>
          </Reveal>
          <RevealGroup variant="up" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AccentCard icon={Newspaper} tone="info" title={t("sourcesTitle")}>
              {t("sourcesBody")}
            </AccentCard>
            <AccentCard icon={CalendarClock} tone="primary" title={t("scheduleTitle")}>
              {t("scheduleBody")}
              {calendarEnabled && (
                <Link
                  href={ROUTE_PATHS["economic-calendar"]}
                  className="link-underline mt-3 flex w-fit items-center gap-1 text-primary-interactive"
                >
                  {t("scheduleLink")}
                  <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                </Link>
              )}
            </AccentCard>
            <AccentCard icon={ShieldAlert} tone="warning" title={t("cautionTitle")}>
              {t("cautionBody")}
            </AccentCard>
          </RevealGroup>
        </Container>
      </Section>

      <ReviewsBand tone="default" />
    </>
  );
}
