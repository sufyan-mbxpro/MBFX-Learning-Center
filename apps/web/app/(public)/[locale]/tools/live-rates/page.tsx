import type { Metadata } from "next";
import { localizedPath, titleTemplate, titleFrom } from "../../../../_lib/seo.ts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Clock, ShieldAlert, SplitSquareHorizontal } from "lucide-react";
import {
  MARKET_BOARD_GROUPS,
  MARKET_BOARD_GROUP_KEYS,
  ROUTE_PATHS,
  toolPath,
} from "@repo/contracts";
import { isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal, RevealGroup } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { tradingViewWidgetUrl } from "@repo/utils";
import { AccentCard } from "../../economic-calendar/_components/accent-card.tsx";
import { ReviewsBand } from "../../_components/reviews-band.tsx";
import { LiveRatesBoard, type LiveRatesGroup } from "./_components/live-rates-board.tsx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tools/live-rates">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "liveRates" }),
    titleTemplate(),
  ]);
  return {
    title: titleFrom(template, t("title")),
    description: t("lead"),
    alternates: { canonical: localizedPath(locale, ROUTE_PATHS["live-rates"]) },
  };
}

/**
 * Live market rates (ADR-136 §2).
 *
 * The reference's bands in the reference's order: masthead, group chips over
 * a quotes card, three notes, then the reviews band. The quotes are
 * TradingView's, in a frame whose URL is built here rather than by a vendor
 * script. The reference's own table was a hard-coded array nudged by
 * `Math.random()`, and none of its numbers are reproduced.
 *
 * NOT a `TOOLS` member (ADR-136 §5): no `Tool` row and no editor, and its own
 * flag, `market_data`.
 */
export default async function LiveRatesPage({ params }: PageProps<"/[locale]/tools/live-rates">) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("market_data", null))) notFound();

  const t = await getTranslations({ locale, namespace: "liveRates" });

  const groups: LiveRatesGroup[] = MARKET_BOARD_GROUP_KEYS.map((key) => {
    const url = (colorTheme: "light" | "dark") =>
      tradingViewWidgetUrl({
        widget: "market-quotes",
        locale,
        colorTheme,
        settings: {
          group: {
            name: t(`groups.${key}.label`),
            symbols: MARKET_BOARD_GROUPS[key].map((instrument) => ({
              name: instrument.tradingView,
              displayName: instrument.symbol,
            })),
          },
        },
      });
    return {
      key,
      rows: MARKET_BOARD_GROUPS[key].length,
      urls: { light: url("light"), dark: url("dark") },
    };
  });

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
            <LiveRatesBoard groups={groups} />
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-8">
          <Reveal variant="up">
            <h2 className="text-2xl font-semibold tracking-tight">{t("notesTitle")}</h2>
          </Reveal>
          <RevealGroup variant="up" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AccentCard icon={Clock} tone="info" title={t("marketHoursTitle")}>
              {/* AccentCard wraps its children in a <p>, so this stays phrasing
                  content: the link is an inline anchor laid out as a block. */}
              {t("marketHoursBody")}
              <Link
                href={toolPath("market-hours")}
                className="link-underline mt-3 flex w-fit items-center gap-1 text-primary-interactive"
              >
                {t("marketHoursLink")}
                <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
              </Link>
            </AccentCard>
            <AccentCard icon={SplitSquareHorizontal} tone="primary" title={t("spreadTitle")}>
              {t("spreadBody")}
            </AccentCard>
            <AccentCard icon={ShieldAlert} tone="warning" title={t("riskTitle")}>
              {t("riskBody")}
            </AccentCard>
          </RevealGroup>
        </Container>
      </Section>

      <ReviewsBand tone="muted" />
    </>
  );
}
