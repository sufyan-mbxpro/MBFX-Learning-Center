import { getTranslations } from "next-intl/server";
import { AlertTriangle, Coins, CircleAlert, Gauge, Sparkles, Wallet } from "lucide-react";
import { AI_FEATURES, aiUsageFilterSchema } from "@repo/contracts";
import { formatUsd } from "@repo/ai";
import {
  loadAiLimitsView,
  loadAiUsageRows,
  loadAiUsageSeries,
  loadAiUsageSummary,
  loadPricesUpdatedAt,
  listAiProviders,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { MetricCard } from "@repo/ui/components/metric-card";
import { Progress } from "@repo/ui/components/progress";
import { AdminPage, AdminSection } from "../_components/admin-page.tsx";
import { AiBreakdownChart, AiSpendChart } from "./usage-charts.tsx";
import { AiUsageTable, type AiUsageTableLabels, type AiUsageTableRow } from "./usage-table.tsx";
import { formatCount, formatDuration, isAiRange, rangeStart, type AiRange } from "./_lib/ai-ui.ts";

/**
 * The spend tile's glyph ink.
 *
 * A thin 16px glyph takes each hue's `-interactive` ink — the raw hue is a
 * fill colour only (ADR-018 rule 5), and raw red fails 4.5:1 on the dark
 * ground (ADR-077's ink rule).
 */
const BUDGET_INK: Record<string, string> = {
  ok: "text-primary-interactive",
  warning: "text-warning-interactive",
  capped: "text-destructive-interactive",
};

// **Usage is the landing screen** (the brief's P9): everything Phase 2 adds
// reports into it, so it is what `/admin/ai` opens on rather than Providers.
//
// Every figure says "estimated" and carries the date the prices behind it last
// changed (ADR-100 #2 and #4). The whole screen renders correctly with zero
// rows, because a fresh install has zero rows.
export default async function AiUsagePage({ searchParams }: PageProps<"/admin/ai">) {
  await requirePermission("ai.usage.view");
  const t = await getTranslations("admin");
  const tAi = await getTranslations("admin.ai");
  const params = await searchParams;

  const one = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // Parsed, never cast (security.md #6). A bad search param falls back to the
  // default view rather than 500ing a read-only screen.
  const parsed = aiUsageFilterSchema.safeParse({
    feature: one(params.feature),
    status: one(params.status),
    range: one(params.range),
  });
  const filter = parsed.success ? parsed.data : {};
  const range: AiRange = isAiRange(filter.range ?? undefined) ? filter.range! : "month";
  const since = rangeStart(range);

  const [limits, summary, series, page, pricedAt, providers] = await Promise.all([
    loadAiLimitsView(),
    loadAiUsageSummary(since),
    loadAiUsageSeries(since),
    loadAiUsageRows({ since, filter, cursor: one(params.cursor) ?? null }),
    loadPricesUpdatedAt(),
    listAiProviders(),
  ]);

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const dateTimeFormat = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const pricesNote = pricedAt
    ? tAi("estimatedNote", { date: dateFormat.format(pricedAt) })
    : tAi("estimatedNoteUnknown");

  // One line per day, summed across features — the rollup already holds
  // (day, feature, provider, model), so the chart never scans a raw row.
  const byDay = new Map<string, number>();
  for (const point of series) {
    const key = point.date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + point.costUsd);
  }
  const spendPoints = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, costUsd]) => ({
      date,
      label: dateFormat.format(new Date(`${date}T00:00:00.000Z`)),
      costUsd,
    }));

  const featureName = (key: string): string =>
    tAi.has(`featureNames.${key}`) ? tAi(`featureNames.${key}`) : key;

  function breakdown(keyOf: (p: (typeof series)[number]) => string, label: (k: string) => string) {
    const map = new Map<string, { costUsd: number; calls: number }>();
    for (const point of series) {
      const key = keyOf(point);
      const entry = map.get(key) ?? { costUsd: 0, calls: 0 };
      entry.costUsd += point.costUsd;
      entry.calls += point.calls;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([key, value]) => ({ name: label(key), ...value }))
      .sort((a, b) => b.costUsd - a.costUsd);
  }

  const budget = limits.budget;
  const percent = budget.unlimited
    ? 0
    : Math.min(100, Math.round((budget.spentUsd / Math.max(budget.budgetUsd, 0.000001)) * 100));

  const labels: AiUsageTableLabels = {
    search: tAi("searchPlaceholder"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    colTime: tAi("colTime"),
    colFeature: tAi("colFeature"),
    colModel: tAi("colModel"),
    colStaff: tAi("colStaff"),
    colTokens: tAi("colTokens"),
    colCost: tAi("colCost"),
    colDuration: tAi("colDuration"),
    colStatus: tAi("colStatus"),
    colEntity: tAi("colEntity"),
    filterFeature: tAi("filterFeature"),
    filterFeatureAll: tAi("filterFeatureAll"),
    filterStatus: tAi("filterStatus"),
    filterStatusAll: tAi("filterStatusAll"),
    statusOK: tAi("statusOK"),
    statusFAILED: tAi("statusFAILED"),
    statusABORTED: tAi("statusABORTED"),
    statusREFUSED: tAi("statusREFUSED"),
    clear: tAi("clearFilters"),
    loadMore: tAi("loadMore"),
    emptyTitle: tAi("recentEmpty"),
    emptyBody: tAi("recentDescription"),
    noStaff: tAi("noStaff"),
  };

  const rows: AiUsageTableRow[] = page.rows.map((row) => ({
    id: row.id,
    featureLabel: featureName(row.feature),
    modelId: row.modelId,
    status: row.status,
    statusLabel: tAi(`status${row.status}` as "statusOK"),
    reasonLabel:
      row.reason && tAi.has(`reasons.${row.reason}`) ? tAi(`reasons.${row.reason}`) : row.reason,
    tokensLabel: `${formatCount(row.inputTokens)} / ${formatCount(row.outputTokens)}`,
    costLabel: formatUsd(row.costUsd),
    durationLabel: formatDuration(row.durationMs),
    timeLabel: dateTimeFormat.format(row.createdAt),
    actorName: row.actorName,
    entityLabel: row.entityType ? row.entityType : null,
  }));

  const noRealProvider = providers.every((p) => p.kind === "ECHO" || !p.isEnabled);

  return (
    <AdminPage title={tAi("title")} description={tAi("description")}>
      {/* The two states worth interrupting for, in the order that matters: a
          capped platform stops work, an unconfigured one only makes it
          pretend. */}
      {budget.status === "capped" && (
        <Alert variant={limits.capBehavior === "DISABLE" ? "destructive" : "warning"}>
          <AlertTriangle aria-hidden />
          <AlertTitle>{tAi("budgetCapped")}</AlertTitle>
          <AlertDescription>
            {limits.capBehavior === "DISABLE"
              ? tAi("budgetCappedBody")
              : tAi("budgetCappedNotifyOnly")}
          </AlertDescription>
        </Alert>
      )}
      {!limits.enabled && (
        <Alert variant="info">
          <Sparkles aria-hidden />
          <AlertTitle>{tAi("off")}</AlertTitle>
          <AlertDescription>{tAi("offBody")}</AlertDescription>
        </Alert>
      )}
      {limits.enabled && noRealProvider && (
        <Alert variant="info">
          <CircleAlert aria-hidden />
          <AlertTitle>{tAi("noProvider")}</AlertTitle>
          <AlertDescription>{tAi("noProviderBody")}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Wallet aria-hidden className={BUDGET_INK[budget.status]} />}
          label={tAi("tileSpend")}
          value={formatUsd(budget.spentUsd)}
          meta={
            budget.unlimited
              ? tAi("tileSpendUnlimited")
              : tAi("tileSpendOf", { budget: formatUsd(budget.budgetUsd) })
          }
          footer={!budget.unlimited && <Progress value={percent} />}
        />
        {/* "Available to spend", not only "spent" — the pre-flight check uses
            worst-case output tokens, so the last few dollars of a period go
            unused. Showing the gap is what keeps it from being a surprise
            (ADR-100's consequence). */}
        <MetricCard
          icon={<Gauge aria-hidden className="text-info-interactive" />}
          label={tAi("tileAvailable")}
          value={budget.unlimited ? "—" : formatUsd(budget.availableUsd)}
          detail={tAi("tileAvailableHint")}
        />
        <MetricCard
          icon={<Sparkles aria-hidden className="text-primary-interactive" />}
          label={tAi("tileCalls")}
          value={formatCount(summary.calls)}
          meta={`${formatCount(summary.failures)} · ${tAi("tileFailures")}`}
        />
        <MetricCard
          icon={<Coins aria-hidden className="text-success-interactive" />}
          label={tAi("tileAverage")}
          value={formatUsd(summary.averageCostUsd)}
          meta={`${formatCount(summary.inputTokens + summary.outputTokens)} ${tAi("tileTokens")}`}
        />
      </div>

      <p className="text-xs text-muted-foreground">{pricesNote}</p>

      <AdminSection title={tAi("chartSpend")}>
        <AiSpendChart
          data={spendPoints}
          seriesLabel={tAi("chartSpend")}
          emptyTitle={tAi("chartEmpty")}
          emptyDescription={tAi("recentDescription")}
        />
      </AdminSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AdminSection title={tAi("chartByFeature")}>
          <AiBreakdownChart
            data={breakdown((p) => p.feature, featureName)}
            seriesLabel={tAi("chartByFeature")}
            emptyTitle={tAi("chartEmpty")}
            emptyDescription={tAi("recentDescription")}
          />
        </AdminSection>
        <AdminSection title={tAi("chartByModel")}>
          <AiBreakdownChart
            data={breakdown((p) => `${p.provider} · ${p.modelId}`, (k) => k)}
            seriesLabel={tAi("chartByModel")}
            emptyTitle={tAi("chartEmpty")}
            emptyDescription={tAi("recentDescription")}
          />
        </AdminSection>
      </div>

      <AdminSection title={tAi("recentTitle")}>
        <p className="text-sm text-muted-foreground">{tAi("recentDescription")}</p>
        <AiUsageTable
          rows={rows}
          nextCursor={page.nextCursor}
          features={AI_FEATURES.map((f) => ({ value: f.key, label: featureName(f.key) }))}
          labels={labels}
        />
      </AdminSection>
    </AdminPage>
  );
}
