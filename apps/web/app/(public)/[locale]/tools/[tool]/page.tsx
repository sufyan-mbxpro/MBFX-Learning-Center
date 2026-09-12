import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
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
  getOhlc,
  getRateSnapshot,
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
        />
      }
      related={<RelatedStrip items={related} />}
      disclaimer={<RiskDisclaimer />}
    />
  );
}
