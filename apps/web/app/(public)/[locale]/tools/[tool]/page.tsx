import type { Metadata } from "next";
import { descriptionFrom, jsonLd, localizedPath, shareMetadata } from "../../../../_lib/seo.ts";
import { siteUrl } from "../../../../_lib/site-url.ts";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  TOOLS,
  TOOL_KEYS,
  isToolKey,
  parseToolConfig,
  toolFlag,
  toolPath,
  type ToolKey,
} from "@repo/contracts";
import {
  getCorrelationMatrices,
  getOhlc,
  getRateSnapshot,
  getRiskSentiment,
  getToolPage,
  getToolRelated,
  listActiveInstruments,
} from "@repo/core";
import type { OhlcInterval } from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { RelatedStrip } from "../_components/related-strip.tsx";
import { ReviewsBand } from "../../_components/reviews-band.tsx";
import { ToolShell } from "../_components/tool-shell.tsx";
import { ToolWidget } from "../_components/tool-widget.tsx";
import { PIVOT_AUTOFILL_LIMIT, pivotSymbols } from "../_components/pivot-symbols.ts";
import { formatDate } from "@repo/utils";

// One tool page (changes-25 T6, ADR-086 #9).
//
// **`generateStaticParams` over the REGISTRY**, not over the table: the set of
// tools is code, so every page is known at build time and a row is only ever
// what a tool says.
//
// **A disabled tool 404s** (ADR-086 #5) — the same `notFound()` an unknown key
// gets, so the page cannot accidentally tell one from the other.
//
// **No session read** (ADR-056 #1): this page is cached, and a widget's state
// is the reader's own, held in the island.
export function generateStaticParams(): { tool: string }[] {
  return TOOL_KEYS.map((tool) => ({ tool }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tools/[tool]">): Promise<Metadata> {
  const { locale, tool } = await params;
  setRequestLocale(locale);
  if (!isToolKey(tool)) return {};

  const [page, template, tCommon] = await Promise.all([
    getToolPage(locale, tool),
    getSetting("seo.titleTemplate"),
    getTranslations({ locale, namespace: "common" }),
  ]);
  if (!page) return {};

  const ownPath = localizedPath(locale, toolPath(tool));
  return {
    title: (template ?? "%s").replace("%s", page.seoTitle || page.title),
    ...descriptionFrom(page.seoDescription, page.tagline),
    alternates: { canonical: ownPath },
    // The editor's Cover image is the masthead AND the share card.
    ...(await shareMetadata({
      locale,
      siteName: tCommon("siteName"),
      url: ownPath,
      title: page.seoTitle || page.title,
      description: page.seoDescription ?? page.tagline,
      image: page.coverUrl,
    })),
  };
}

export default async function ToolPage({ params }: PageProps<"/[locale]/tools/[tool]">) {
  const { locale, tool } = await params;
  setRequestLocale(locale);
  if (!isToolKey(tool)) notFound();
  const key: ToolKey = tool;

  // Two gates, and both 404: the area's flag and the tool's own.
  const flag = toolFlag(key);
  const flagVisible = flag ? await isFeatureVisible(flag, null) : true;
  if (!flagVisible) notFound();

  const t = await getTranslations({ locale, namespace: "tools" });
  const page = await getToolPage(locale, key);
  if (!page) notFound();

  const parsed = parseToolConfig(key, page.config);
  // A config an older deploy wrote that no longer parses is not a 500: the
  // widget falls back to its own defaults and the page still reads.
  const config = parsed.ok ? (parsed.config as Record<string, unknown>) : {};

  const needs = TOOLS[key].needs;

  const [instruments, curatedRelated, snapshot] = await Promise.all([
    // Only the tools that name instruments pay for them.
    needs === "none" ? Promise.resolve([]) : listActiveInstruments(),
    page.showRelated ? getToolRelated(locale, key, page.relatedCount) : Promise.resolve([]),
    // ONE snapshot per page (ADR-087 #7), cached and tagged `market`. The
    // island does the arithmetic; there is no endpoint per keystroke.
    needs === "none" ? Promise.resolve(null) : getRateSnapshot(),
  ]);

  // "More about this" links only to routes that will answer (changes-46). The
  // core read already applies each module's publish rule; the FLAG half is a
  // viewer-scoped check a cached read cannot make, so it happens here, against
  // the same anonymous subject the destination pages gate with.
  const relatedFeatures = [...new Set(curatedRelated.map((item) => item.feature))];
  const featureOn = new Map(
    await Promise.all(
      relatedFeatures.map(async (flag) => [flag, await isFeatureVisible(flag, null)] as const),
    ),
  );
  const related = curatedRelated.filter((item) => featureOn.get(item.feature) === true);

  // The pivot calculator's autofill: the last COMPLETE period for each
  // interval it offers. Read here rather than in the island because it is a
  // database read, and because a cached page can pay for it once.
  //
  // Per SYMBOL as well as per interval (changes-46): the dropdown offers every
  // configured instrument, so the periods have to follow the reader's pick.
  // The symbols come from the same `pivotSymbols` the widget uses, so the two
  // cannot disagree about what is offered.
  const autofill: Record<string, Record<string, Awaited<ReturnType<typeof getOhlc>>>> = {};
  if (key === "pivot-points") {
    const intervals = Array.isArray((config as { intervals?: unknown }).intervals)
      ? ((config as { intervals: string[] }).intervals as OhlcInterval[])
      : (["1D", "1W", "1M", "1Y"] as OhlcInterval[]);
    const symbols = pivotSymbols(config, instruments)
      .options.slice(0, PIVOT_AUTOFILL_LIMIT)
      .map((option) => option.symbol);
    const bars = await Promise.all(
      symbols.flatMap((symbol) => intervals.map((interval) => getOhlc(symbol, interval))),
    );
    symbols.forEach((symbol, s) => {
      const periods: Record<string, Awaited<ReturnType<typeof getOhlc>>> = {};
      intervals.forEach((interval, i) => {
        periods[interval] = bars[s * intervals.length + i] ?? null;
      });
      autofill[symbol] = periods;
    });
  }

  // The two history-backed tools, each read once on the server so the island
  // holds no fetching of its own (ADR-056 #1's rule extended: a cached page
  // reads, an island renders).
  const correlationConfig = config as {
    windows?: string[];
    defaultWindow?: string;
    instrumentIds?: string[];
  };
  const correlation =
    key === "correlation"
      ? await (async () => {
          const windows = correlationConfig.windows ?? ["30d"];
          const matrices = await getCorrelationMatrices(
            windows,
            correlationConfig.instrumentIds ?? [],
          );
          return {
            matrices,
            windows,
            defaultWindow: correlationConfig.defaultWindow ?? windows[0] ?? "30d",
          };
        })()
      : null;

  const riskConfig = config as {
    components?: { instrumentId: string; weight: number; direction: "risk-on" | "risk-off" }[];
    lookbackDays?: number;
    riskOffBelow?: number;
    riskOnAbove?: number;
  };
  const risk =
    key === "risk-sentiment"
      ? await getRiskSentiment(riskConfig.components ?? [], {
          lookbackDays: riskConfig.lookbackDays ?? 60,
          riskOffBelow: riskConfig.riskOffBelow ?? 35,
          riskOnAbove: riskConfig.riskOnAbove ?? 65,
        })
      : null;

  // One "as of" string, formatted on the server so every island on the page
  // says it the same way.
  const asOfSource = correlation?.matrices[correlation.defaultWindow]?.asOf ?? risk?.asOf ?? null;
  const asOfLabel = asOfSource
    ? // `dataAsOf`, not `asOf`: neither a correlation grid nor a sentiment
      // score is a RATE, and saying so would be a small lie in a caption.
      t("common.dataAsOf", {
        date: formatDate(asOfSource, locale),
      })
    : null;

  // Structured data (changes-46 SEO check: the tool pages carried none). A
  // calculator is a `WebApplication` a reader uses in the browser, free; the
  // FAQ the page draws is a `FAQPage`, only when it has entries — the rule the
  // article and support pages follow. No `BreadcrumbList`: the page draws no
  // visible trail, and the markup must describe navigation a reader can see.
  const ownUrl = `${siteUrl()}${localizedPath(locale, toolPath(key))}`;
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: page.title,
      url: ownUrl,
      ...(page.seoDescription || page.tagline
        ? { description: page.seoDescription || page.tagline }
        : {}),
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    },
    ...(page.faq.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      {structured.map((graph) => (
        <script
          key={String(graph["@type"])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(graph) }}
        />
      ))}
      <ToolShell
        title={page.title}
        tagline={page.tagline}
        intro={page.intro}
        body={page.body}
        faq={page.faq}
        highlights={page.highlights}
        // The editor's Cover image (Tools → Media). Present, it turns the
        // masthead into ADR-117's photo band; absent, the brand fill stays.
        // `alt=""` for the same reason as every masthead backdrop: texture
        // behind a headline that already says what the page is.
        backdrop={
          page.coverUrl ? (
            <Image
              src={page.coverUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              unoptimized={page.coverUrl.endsWith(".svg")}
            />
          ) : undefined
        }
        widget={
          <ToolWidget
            toolKey={key}
            config={config}
            instruments={instruments.map((i) => ({
              id: i.id,
              symbol: i.symbol,
              displayName: i.displayName,
              kind: i.kind,
            }))}
            snapshot={snapshot}
            autofill={autofill}
            correlation={correlation}
            risk={risk}
            asOfLabel={asOfLabel}
          />
        }
        // Default ground: the highlights above and the related strip below are
        // both muted, so this band is what separates them.
        reviews={<ReviewsBand />}
        related={<RelatedStrip items={related} />}
      />
    </>
  );
}
