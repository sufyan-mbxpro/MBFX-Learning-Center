import type { Metadata } from "next";
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
import { ToolShell } from "../_components/tool-shell.tsx";
import { ToolWidget } from "../_components/tool-widget.tsx";
import { RiskDisclaimer } from "../../_sections/risk-disclaimer.tsx";

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

  const [page, template] = await Promise.all([
    getToolPage(locale, tool),
    getSetting("seo.titleTemplate"),
  ]);
  if (!page) return {};

  return {
    title: (template ?? "%s").replace("%s", page.seoTitle || page.title),
    description: page.seoDescription ?? page.tagline ?? undefined,
    alternates: { canonical: toolPath(tool) },
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

  const [instruments, related, snapshot] = await Promise.all([
    // Only the tools that name instruments pay for them.
    needs === "none" ? Promise.resolve([]) : listActiveInstruments(),
    page.showRelated ? getToolRelated(locale, key, page.relatedCount) : Promise.resolve([]),
    // ONE snapshot per page (ADR-087 #7), cached and tagged `market`. The
    // island does the arithmetic; there is no endpoint per keystroke.
    needs === "none" ? Promise.resolve(null) : getRateSnapshot(),
  ]);

  // The pivot calculator's autofill: the last COMPLETE period for each
  // interval it offers. Read here rather than in the island because it is a
  // database read, and because a cached page can pay for it once.
  const autofill: Record<string, Awaited<ReturnType<typeof getOhlc>>> = {};
  if (key === "pivot-points") {
    const intervals = Array.isArray((config as { intervals?: unknown }).intervals)
      ? ((config as { intervals: string[] }).intervals as OhlcInterval[])
      : (["1D", "1W", "1M", "1Y"] as OhlcInterval[]);
    const defaultSymbolId = String((config as { defaultSymbolId?: unknown }).defaultSymbolId ?? "");
    const symbol =
      instruments.find((i) => i.id === defaultSymbolId)?.symbol ?? instruments[0]?.symbol ?? null;
    if (symbol) {
      const bars = await Promise.all(intervals.map((interval) => getOhlc(symbol, interval)));
      intervals.forEach((interval, index) => {
        autofill[interval] = bars[index] ?? null;
      });
    }
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
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(asOfSource)),
      })
    : null;

  return (
    <ToolShell
      title={page.title}
      tagline={page.tagline}
      intro={page.intro}
      body={page.body}
      faq={page.faq}
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
      related={<RelatedStrip items={related} />}
      disclaimer={<RiskDisclaimer />}
    />
  );
}
