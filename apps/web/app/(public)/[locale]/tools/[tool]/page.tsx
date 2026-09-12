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
import { getToolPage, getToolRelated, listActiveInstruments } from "@repo/core";
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

  const [instruments, related] = await Promise.all([
    // Only the tools that name instruments pay for them.
    TOOLS[key].needs === "none" ? Promise.resolve([]) : listActiveInstruments(),
    page.showRelated ? getToolRelated(locale, key, page.relatedCount) : Promise.resolve([]),
  ]);

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
        />
      }
      related={<RelatedStrip items={related} />}
      disclaimer={<RiskDisclaimer />}
    />
  );
}
