import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { getTranslations } from "next-intl/server";
import type { ToolKey } from "@repo/contracts";
import { GainLossWidget } from "../_widgets/gain-loss.tsx";
import { MarketHoursWidget } from "../_widgets/market-hours.tsx";
import { PipValueWidget } from "../_widgets/pip-value.tsx";
import { PivotPointsWidget } from "../_widgets/pivot-points.tsx";
import { PositionSizeWidget } from "../_widgets/position-size.tsx";

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
// The three tools that need the market platform land in T7 and T8; until then
// they render an honest "not available yet" rather than a broken form.
export async function ToolWidget({
  toolKey,
  config,
  instruments,
}: {
  toolKey: ToolKey;
  config: Record<string, unknown>;
  instruments: WidgetInstrument[];
}) {
  const t = await getTranslations("tools");

  /** Config lists hold instrument IDS; a widget wants symbols and labels. */
  const byId = new Map(instruments.map((i) => [i.id, i]));
  const pick = (key: string) =>
    (Array.isArray(config[key]) ? (config[key] as string[]) : [])
      .map((id) => byId.get(id))
      .filter((i): i is WidgetInstrument => i !== undefined)
      .map((i) => ({ symbol: i.symbol, label: `${i.symbol} — ${i.displayName}`, price: null }));

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
          snapshot={null}
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
          snapshot={null}
        />
      );

    case "pivot-points":
      return (
        <PivotPointsWidget
          config={config}
          // Manual mode only until T7 wires `getOhlc`. The widget is fully
          // usable without it — which is why manual is what it opens on.
          autofill={{}}
          defaultSymbol={
            byId.get(String(config.defaultSymbolId ?? ""))?.symbol ??
            pick("symbolIds")[0]?.symbol ??
            "EUR/USD"
          }
        />
      );

    default:
      // The three data-backed tools, until T7/T8. Said plainly rather than
      // rendered as a form that cannot answer.
      return (
        <Alert variant="info">
          <AlertDescription>{t("common.comingWithData")}</AlertDescription>
        </Alert>
      );
  }
}
