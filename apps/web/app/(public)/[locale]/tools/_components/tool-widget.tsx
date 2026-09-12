import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { getTranslations } from "next-intl/server";
import type { ToolKey } from "@repo/contracts";
import { crossRate } from "@repo/utils";
import { GainLossWidget } from "../_widgets/gain-loss.tsx";
import { MarketHoursWidget } from "../_widgets/market-hours.tsx";
import { PipValueWidget } from "../_widgets/pip-value.tsx";
import { PivotPointsWidget } from "../_widgets/pivot-points.tsx";
import { PositionSizeWidget } from "../_widgets/position-size.tsx";
import { CurrencyConverterWidget } from "../_widgets/currency-converter.tsx";
import type { PivotOhlc } from "../_widgets/pivot-points.tsx";
import type { RateSnapshotView } from "./rate-footnote.tsx";

export interface WidgetInstrument {
  id: string;
  symbol: string;
  displayName: string;
  kind: string;
}

// One switch, eight islands (changes-25 T6/T7/T8).
//
// **ONE island per page, never eight.** The switch runs on the SERVER, so a
// reader on `/tools/gain-loss` downloads the gain/loss island and nothing
// else — which is the mitigation ADR-086's risk #4 names for eight
// interactive widgets arriving on public routes.
//
// Correlation and the risk meter land in T8; until then they render an honest
// "not available yet" rather than a broken form.
export async function ToolWidget({
  toolKey,
  config,
  instruments,
  snapshot,
  autofill,
}: {
  toolKey: ToolKey;
  config: Record<string, unknown>;
  instruments: WidgetInstrument[];
  /** ADR-087 #7's one cached read; null for the tools that need no rates. */
  snapshot: RateSnapshotView | null;
  /** The last complete period per interval — pivot's autofill, empty for the rest. */
  autofill: Record<string, PivotOhlc | null>;
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

  switch (toolKey) {
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

    case "pivot-points":
      return (
        <PivotPointsWidget
          config={config}
          autofill={autofill}
          defaultSymbol={
            byId.get(String(config.defaultSymbolId ?? ""))?.symbol ??
            pick("symbolIds")[0]?.symbol ??
            "EUR/USD"
          }
        />
      );

    case "currency-converter":
      return (
        <CurrencyConverterWidget
          config={{
            ...config,
            currencies: (Array.isArray(config.currencyIds)
              ? (config.currencyIds as string[])
              : []
            )
              .map((id) => byId.get(id)?.symbol)
              .filter((s): s is string => Boolean(s)),
          }}
          snapshot={snapshot}
        />
      );

    default:
      // Correlation and the risk meter, until T8. Said plainly rather than
      // rendered as a form that cannot answer.
      return (
        <Alert variant="info">
          <AlertDescription>{t("common.comingWithData")}</AlertDescription>
        </Alert>
      );
  }
}
