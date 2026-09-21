import type { Metadata } from "next";
import { localizedPath } from "../../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarClock, Gauge, Rocket, Scale } from "lucide-react";
import { ROUTE_PATHS } from "@repo/contracts";
import { getVolatilityBoard } from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { formatDate } from "@repo/utils";
import { ReviewsBand } from "../../_components/reviews-band.tsx";
import { Methodology } from "../_components/methodology.tsx";
import { VolatilityBoard } from "./_components/volatility-board.tsx";
import { VOLATILITY_LEVEL_BADGE, VOLATILITY_LEVEL_ORDER } from "./_components/volatility-level.ts";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tools/volatility">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "volatility" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("title")),
    description: t("lead"),
    alternates: { canonical: localizedPath(locale, ROUTE_PATHS.volatility) },
  };
}

/**
 * The volatility tracker (ADR-136 §3).
 *
 * The reference's bands in the reference's order: masthead, group and
 * timeframe chips over a card of per-pair tiles, then "Understanding
 * volatility" beside "Trading with volatility". The reference's figures were a
 * hard-coded array. Ours are computed from stored daily bars, so this page
 * states its method and its "as of" date, and it says neither "live" nor
 * "real-time" (ADR-088 #7).
 *
 * NOT a `TOOLS` member (ADR-136 §5). It sits behind the Tools area's flag.
 */
export default async function VolatilityPage({ params }: PageProps<"/[locale]/tools/volatility">) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("calculators", null))) notFound();

  const [t, board] = await Promise.all([
    getTranslations({ locale, namespace: "volatility" }),
    getVolatilityBoard(),
  ]);

  const asOfLabel = board.asOf ? t("asOf", { date: formatDate(board.asOf, locale) }) : null;

  const tips = [
    { key: "high", icon: Gauge, title: t("tips.highTitle"), body: t("tips.highBody") },
    { key: "low", icon: Scale, title: t("tips.lowTitle"), body: t("tips.lowBody") },
    { key: "breakout", icon: Rocket, title: t("tips.breakoutTitle"), body: t("tips.breakoutBody") },
    { key: "news", icon: CalendarClock, title: t("tips.newsTitle"), body: t("tips.newsBody") },
  ];

  return (
    <>
      <PageHero
        size="compact"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        motif={<AmbientMotif variant="chart" intensity={0.7} />}
      />

      <Section tone="muted">
        <Container>
          <Reveal variant="up">
            <VolatilityBoard groups={board.groups} asOfLabel={asOfLabel} />
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-6">
          {/* `items-stretch` (the default) and `h-full` down both branches:
              the two cards are a PAIR making one argument, and a left card
              that runs 60px past the right one reads as an alignment bug
              rather than as two lengths of prose. `items-start` was right
              when a card sat beside a much taller widget (the tool shell
              still uses it); here both columns are cards. */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal variant="start" className="min-w-0 md:h-full">
              <Card className="md:h-full">
                <CardContent className="flex flex-col gap-4">
                  <h2 className="text-xl font-semibold tracking-tight">{t("understandTitle")}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t("understandLead")}
                  </p>
                  <ul className="flex flex-col gap-3">
                    {VOLATILITY_LEVEL_ORDER.map((level) => (
                      <li key={level} className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-3">
                        <Badge variant={VOLATILITY_LEVEL_BADGE[level]} className="w-fit shrink-0">
                          {t(`levelBands.${level}`)}
                        </Badge>
                        <span className="text-muted-foreground">{t(`levelBodies.${level}`)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>

            <Reveal variant="end" className="min-w-0 md:h-full">
              <Card variant="featured" className="md:h-full">
                <CardContent className="flex flex-col gap-4">
                  <h2 className="text-xl font-semibold tracking-tight">{t("tradingTitle")}</h2>
                  <ul className="flex flex-col gap-4">
                    {tips.map((tip) => (
                      <li key={tip.key} className="flex gap-3 text-sm">
                        <tip.icon
                          aria-hidden
                          className="mt-0.5 size-5 shrink-0 text-primary-interactive"
                        />
                        <span>
                          <span className="font-semibold">{tip.title}</span>{" "}
                          <span className="text-muted-foreground">{tip.body}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
          </div>

          <Methodology
            points={[
              t("methodology.range"),
              t("methodology.windows"),
              t("methodology.average"),
              t("methodology.cadence"),
            ]}
          />
        </Container>
      </Section>

      <ReviewsBand tone="muted" />
    </>
  );
}
