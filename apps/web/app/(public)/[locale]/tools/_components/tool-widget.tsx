import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { getTranslations } from "next-intl/server";
import type { ToolKey } from "@repo/contracts";
import { crossRate } from "@repo/utils";
import { GainLossWidget } from "../_widgets/gain-loss.tsx";
import { MarginWidget } from "../_widgets/margin.tsx";
import { ProfitLossWidget } from "../_widgets/profit-loss.tsx";
import { RiskRewardWidget } from "../_widgets/risk-reward.tsx";
import { MarketHoursWidget } from "../_widgets/market-hours.tsx";
import { PipValueWidget } from "../_widgets/pip-value.tsx";
import { PivotPointsWidget } from "../_widgets/pivot-points.tsx";
import { PositionSizeWidget } from "../_widgets/position-size.tsx";
import { CurrencyConverterWidget } from "../_widgets/currency-converter.tsx";
import type { PivotOhlc } from "../_widgets/pivot-points.tsx";
import { pivotSymbols } from "./pivot-symbols.ts";
import type { RateSnapshotView } from "./rate-footnote.tsx";
import { CorrelationPanel } from "../_widgets/correlation-panel.tsx";
import type { CorrelationData } from "../_widgets/correlation.tsx";
import { RiskSentimentWidget, type RiskSentimentData } from "../_widgets/risk-sentiment.tsx";

export interface WidgetInstrument {
  id: string;
  symbol: string;
  displayName: string;
  kind: string;
}

// One switch, one island per tool (changes-25 T6/T7/T8; three more in changes-41).
//
// **ONE island per page, never all of them.** The switch runs on the SERVER, so a
// reader on `/tools/gain-loss` downloads the gain/loss island and nothing
// else — which is the mitigation ADR-086's risk #4 names for eight
// interactive widgets arriving on public routes.
//
// Every tool is wired as of T8. The default branch stays as the honest
// fallback for a registry key whose island has not been written yet — which is
// a state the type system allows and a deploy could reach.
export async function ToolWidget({
  toolKey,
  config,
  instruments,
  snapshot,
  autofill,
  correlation,
  risk,
  asOfLabel,
}: {
  toolKey: ToolKey;
  config: Record<string, unknown>;
  instruments: WidgetInstrument[];
  /** ADR-087 #7's one cached read; null for the tools that need no rates. */
  snapshot: RateSnapshotView | null;
  /** The last complete period per symbol and interval — pivot's autofill, empty for the rest. */
  autofill: Record<string, Record<string, PivotOhlc | null>>;
  /** Every offered window's matrix, from one read (T8). */
  correlation: {
    matrices: Record<string, CorrelationData>;
    windows: string[];
    defaultWindow: string;
  } | null;
  risk: RiskSentimentData | null;
  /** "Rates as of …", resolved on the server so the islands share one format. */
  asOfLabel: string | null;
}) {
  const t = await getTranslations("tools");

  /** Config lists hold instrument IDS; a widget wants symbols and labels. */
  const byId = new Map(instruments.map((i) => [i.id, i]));

  /**
   * A pair's current price, assembled from the snapshot's USD-based rates.
   *
   * The snapshot holds units-per-USD per CURRENCY, which is all a cross needs:
   * EUR/GBP is (GBP per USD) ÷ (EUR per USD). Null when either leg is missing,
   * which every widget already renders as a labelled empty state rather than
   * as a number it cannot stand behind.
   */
  const priceFor = (symbol: string): number | null => {
    const [base, quote] = symbol.split("/");
    if (!base || !quote || !snapshot) return null;
    return crossRate(base, quote, snapshot.rates);
  };

  const pick = (key: string) =>
    (Array.isArray(config[key]) ? (config[key] as string[]) : [])
      .map((id) => byId.get(id))
      .filter((i): i is WidgetInstrument => i !== undefined)
      .map((i) => ({
        symbol: i.symbol,
        label: `${i.symbol} — ${i.displayName}`,
        price: priceFor(i.symbol),
      }));

  const accountCurrencies = (
    Array.isArray(config.accountCurrencyIds) ? (config.accountCurrencyIds as string[]) : []
  )
    .map((id) => byId.get(id)?.symbol)
    .filter((s): s is string => Boolean(s));

  /** The admin's default pair, as a symbol — only when it is also offered. */
  const pairs = pick("pairIds");
  const defaultPair =
    pairs.find((p) => p.symbol === byId.get(String(config.defaultPairId ?? ""))?.symbol)?.symbol ??
    pairs[0]?.symbol;

  switch (toolKey) {
    case "margin":
      return (
        <MarginWidget
          config={{ ...config, pairs, defaultPair, accountCurrencies }}
          snapshot={snapshot}
        />
      );

    case "profit-loss":
      return (
        <ProfitLossWidget
          config={{ ...config, pairs, defaultPair, accountCurrencies }}
          snapshot={snapshot}
        />
      );

    case "risk-reward":
      return (
        <RiskRewardWidget
          config={{ ...config, pairs, defaultPair, accountCurrencies }}
          snapshot={snapshot}
        />
      );

    case "gain-loss":
      return <GainLossWidget config={config} />;

    case "market-hours":
      return <MarketHoursWidget config={config} />;

    case "position-size":
      return (
        <PositionSizeWidget
          config={{
            ...config,
            pairs: pick("pairIds"),
            accountCurrencies: (Array.isArray(config.accountCurrencyIds)
              ? (config.accountCurrencyIds as string[])
              : []
            )
              .map((id) => byId.get(id)?.symbol)
              .filter((s): s is string => Boolean(s)),
          }}
          snapshot={snapshot}
        />
      );

    case "pip-value":
      return (
        <PipValueWidget
          config={{
            ...config,
            pairs: pick("pairIds"),
            accountCurrencies: (Array.isArray(config.accountCurrencyIds)
              ? (config.accountCurrencyIds as string[])
              : []
            )
              .map((id) => byId.get(id)?.symbol)
              .filter((s): s is string => Boolean(s)),
          }}
          snapshot={snapshot}
        />
      );

    case "pivot-points": {
      // changes-46: `pivotSymbols` reads `symbolIds`, the key the registry
      // writes. The widget used to read `config.symbols`, which nothing ever
      // wrote, so the dropdown had no options and did not render.
      const pivot = pivotSymbols(config, instruments);
      return (
        <PivotPointsWidget
          config={config}
          symbols={pivot.options}
          autofill={autofill}
          defaultSymbol={pivot.defaultSymbol ?? "EUR/USD"}
        />
      );
    }

    case "currency-converter":
      return (
        <CurrencyConverterWidget
          config={{
            ...config,
            currencies: (Array.isArray(config.currencyIds) ? (config.currencyIds as string[]) : [])
              .map((id) => byId.get(id)?.symbol)
              .filter((s): s is string => Boolean(s)),
          }}
          snapshot={snapshot}
        />
      );

    case "correlation":
      return correlation ? (
        <CorrelationPanel
          matrices={correlation.matrices}
          windows={correlation.windows}
          defaultWindow={correlation.defaultWindow}
          asOfLabel={asOfLabel}
        />
      ) : (
        <Alert variant="info">
          <AlertDescription>{t("common.comingWithData")}</AlertDescription>
        </Alert>
      );

    case "risk-sentiment":
      return risk ? (
        <RiskSentimentWidget data={risk} asOfLabel={asOfLabel} />
      ) : (
        <Alert variant="info">
          <AlertDescription>{t("common.comingWithData")}</AlertDescription>
        </Alert>
      );

    default:
      // A registry key whose island has not been written yet. Said plainly
      // rather than rendered as a form that cannot answer.
      return (
        <Alert variant="info">
          <AlertDescription>{t("common.comingWithData")}</AlertDescription>
        </Alert>
      );
  }
}
