import type { Metadata } from "next";
import { localizedPath, titleTemplate, titleFrom } from "../../../_lib/seo.ts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS, TOOLS, toolPath } from "@repo/contracts";
import { getEnabledTools } from "@repo/core";
import { isFeatureVisible } from "@repo/settings";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { RevealGroup } from "@repo/ui/components/reveal";
import { ToolsBackdrop } from "./_components/tools-backdrop.tsx";
import { Section } from "@repo/ui/components/section";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChartCandlestick,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { TOOL_ICONS } from "./_components/tool-icons.ts";

// `/tools` (changes-25 T6, ADR-086).
//
// This REPLACES the `ComingSoon` render ADR-081 #1 put here. The page is
// indexable now — the `robots: { index: false }` line goes with the
// placeholder, because there is something to index.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tools">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "tools" }),
    titleTemplate(),
  ]);
  return {
    title: titleFrom(template, t("index.title")),
    description: t("index.lead"),
    alternates: { canonical: localizedPath(locale, ROUTE_PATHS.tools) },
  };
}

/** What a card on this page is, whether or not a `Tool` row is behind it. */
interface ToolCard {
  key: string;
  href: string;
  title: string;
  tagline: string | null;
  Icon: LucideIcon;
  /** Screen-reader-only: what this needs before it can answer. */
  note: string;
}

export default async function ToolsPage({ params }: PageProps<"/[locale]/tools">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The flag gates the whole area. A flag-off section 404s rather than
  // rendering an empty shell (changes-11 D25's rule).
  if (!(await isFeatureVisible("calculators", null))) notFound();

  const [t, calendar, liveRates, marketNews, volatility, tools, calendarVisible, liveRatesVisible] =
    await Promise.all([
      getTranslations({ locale, namespace: "tools" }),
      getTranslations({ locale, namespace: "economicCalendar" }),
      getTranslations({ locale, namespace: "liveRates" }),
      getTranslations({ locale, namespace: "marketNews" }),
      getTranslations({ locale, namespace: "volatility" }),
      getEnabledTools(locale),
      isFeatureVisible("economic_calendar", null),
      isFeatureVisible("market_data", null),
    ]);

  const cards: ToolCard[] = tools.map((tool) => ({
    key: tool.key,
    href: toolPath(tool.key),
    title: tool.title,
    tagline: tool.tagline,
    Icon: TOOL_ICONS[tool.key],
    // What a tool needs, said plainly: five of the eight answer with no
    // market data at all, and a reader on a fresh instance should know which.
    note: t(`index.needs.${TOOLS[tool.key].needs}`),
  }));

  // The economic calendar, appended here rather than injected into
  // `getEnabledTools` (ADR-115 #3). It is NOT a `TOOLS` member: it keeps
  // `/economic-calendar`, its own flag and ADR-050's embedded widget, and has
  // no `Tool` row, no config schema and no island. Teaching the service about
  // a row that does not exist would make every other consumer of it — the
  // admin list, the drift guard — learn the same exception.
  if (calendarVisible) {
    cards.push({
      key: "economic-calendar",
      href: ROUTE_PATHS["economic-calendar"],
      title: calendar("title"),
      tagline: calendar("cardTagline"),
      Icon: CalendarDays,
      note: t("index.needs.external"),
    });
  }

  // The two market boards (ADR-136 §5), appended for the calendar's reason:
  // neither is a `TOOLS` member or has a `Tool` row. Volatility shares this
  // page's own flag, so it needs no gate of its own here.
  if (liveRatesVisible) {
    cards.push({
      key: "live-rates",
      href: ROUTE_PATHS["live-rates"],
      title: liveRates("title"),
      tagline: liveRates("cardTagline"),
      Icon: ChartCandlestick,
      note: t("index.needs.externalQuotes"),
    });
  }
  cards.push({
    key: "volatility",
    href: ROUTE_PATHS.volatility,
    title: volatility("title"),
    tagline: volatility("cardTagline"),
    Icon: Activity,
    note: t("index.needs.history"),
  });
  // The headline feed (changes-40), behind the same flag as the live board:
  // both are the vendor's market feed under our chrome.
  if (liveRatesVisible) {
    cards.push({
      key: "market-news",
      href: ROUTE_PATHS["market-news"],
      title: marketNews("title"),
      tagline: marketNews("cardTagline"),
      Icon: Newspaper,
      note: t("index.needs.externalQuotes"),
    });
  }

  return (
    <>
      {/* A compact banner, not a section front: the cards below are what the
          reader came for, and a full `section-lg` masthead over a
          three-column grid pushed the first row of them off a laptop screen.
          The same density the tool pages use, for the same reason. */}
      <PageHero
        size="compact"
        backdrop={<ToolsBackdrop slot="banner" />}
        eyebrow={t("eyebrow")}
        title={t("index.title")}
        lead={t("index.lead")}
      />

      <Section>
        <Container>
          {/* Staggered, like every other grid in the area (changes-40): the
              index was the one tools page whose content was simply there.
              `RevealGroup` IS the grid — each child is wrapped and the wrapper
              becomes the grid item — so the list semantics move onto it as
              roles rather than staying `<ul>`/`<li>`. */}
          <RevealGroup
            variant="up"
            role="list"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {cards.map((card) => (
              <div key={card.key} role="listitem" className="h-full">
                {/* A whole-card stretched link, like QuizCard: everything
                    in the card leads to the same one place, so there is no
                    second target to keep clickable. */}
                <Card className="group hover-lift sheen h-full">
                  {/* The card's own glyph once more, at the size of a
                      watermark — the reference's stat tiles, whose subject
                      is legible before a word is read.

                      `-z-10` is what makes it a BACKGROUND rather than a film
                      over the words: `.sheen` sets `isolation: isolate`, so
                      the card is its own stacking context and a negative
                      layer paints above the card's fill and below everything
                      in flow. It also puts the glyph under the stretched
                      link's `after:inset-0`, which a positioned box at
                      `z-index: auto` would have covered; `pointer-events-none`
                      says the same thing a second way. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-4 -end-4 -z-10 text-primary/10 transition-colors duration-(--duration-base) group-hover:text-primary/20"
                  >
                    <card.Icon className="size-28" strokeWidth={1} />
                  </span>
                  <CardContent className="flex h-full flex-col gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive">
                      <card.Icon aria-hidden className="size-5" />
                    </span>
                    <Link
                      href={card.href}
                      className="font-medium transition-colors duration-(--duration-base) group-hover:text-primary-interactive after:absolute after:inset-0"
                    >
                      {card.title}
                    </Link>
                    {card.tagline && (
                      <p className="text-sm text-muted-foreground">{card.tagline}</p>
                    )}
                    <span className="mt-auto flex items-center gap-1 pt-2 text-sm text-primary-interactive">
                      {t("index.open")}
                      <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                    </span>
                    <span className="sr-only">{card.note}</span>
                  </CardContent>
                </Card>
              </div>
            ))}
          </RevealGroup>
        </Container>
      </Section>
    </>
  );
}
