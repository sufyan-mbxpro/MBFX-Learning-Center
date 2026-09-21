"use client";

// Profit & loss (changes-41, ADR-135).
//
// One trade, two prices. Not the gain/loss tool, which works on an ACCOUNT
// in percentages; this one works on a POSITION in pips and money.
//
// **Three figures, and only the last needs a rate.** Pips need nothing; the
// result in the pair's quote currency needs nothing; the result in the
// reader's account currency needs the quote → account leg, and is a labelled
// dash without it.
//
// **Changing the pair resets both prices.** A USD/JPY price left in the fields
// after switching to EUR/USD is not a starting point, it is a 13,000-pip trade.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { pipSize, tradeProfit, type TradeDirection } from "@repo/utils";
import { Badge } from "@repo/ui/components/badge";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { ResultRow, WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import { RateFootnote, type RateSnapshotView } from "../_components/rate-footnote.tsx";
import { positive, priceAt, priceDecimals } from "../_components/price-defaults.ts";

export interface ProfitLossConfig {
  defaultAccountCurrency?: string;
  defaultPair?: string;
  defaultLots?: number;
  pairs?: { symbol: string; label: string; price: number | null }[];
  accountCurrencies?: string[];
}

/** The seeded example: a 50-pip move in the reader's favour. */
const EXAMPLE_MOVE_PIPS = 50;

export function ProfitLossWidget({
  config,
  snapshot,
}: {
  config: ProfitLossConfig;
  snapshot: RateSnapshotView | null;
}) {
  const t = useTranslations("tools");
  const pairs = config.pairs ?? [];
  const currencies = config.accountCurrencies?.length ? config.accountCurrencies : ["USD"];
  const priceOf = (symbol: string) => pairs.find((p) => p.symbol === symbol)?.price ?? null;

  const initialPair = config.defaultPair ?? pairs[0]?.symbol ?? "EUR/USD";
  const [accountCurrency, setAccountCurrency] = useState(
    config.defaultAccountCurrency ?? currencies[0] ?? "USD",
  );
  const [pairSymbol, setPairSymbol] = useState(initialPair);
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [lots, setLots] = useState(String(config.defaultLots ?? 1));
  const [open, setOpen] = useState(() => priceAt(initialPair, priceOf(initialPair)));
  const [close, setClose] = useState(() =>
    priceAt(initialPair, priceOf(initialPair), EXAMPLE_MOVE_PIPS),
  );

  const choosePair = (symbol: string) => {
    setPairSymbol(symbol);
    setOpen(priceAt(symbol, priceOf(symbol)));
    setClose(
      priceAt(
        symbol,
        priceOf(symbol),
        direction === "buy" ? EXAMPLE_MOVE_PIPS : -EXAMPLE_MOVE_PIPS,
      ),
    );
  };

  const result = useMemo(() => {
    const l = positive(lots);
    const o = positive(open);
    const c = positive(close);
    if (l === null || o === null || c === null) return null;
    return tradeProfit({
      pair: pairSymbol,
      direction,
      units: l * 100_000,
      open: o,
      close: c,
      accountCurrency,
      rates: snapshot?.rates ?? {},
    });
  }, [lots, open, close, pairSymbol, direction, accountCurrency, snapshot]);

  const money = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    });
  const step = String(pipSize(pairSymbol) / 10);
  const outcome = result === null ? null : Math.sign(result.inQuote);

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("profitLoss.accountCurrency")}</FieldLabel>
            <ToolCombobox
              value={accountCurrency}
              onValueChange={setAccountCurrency}
              options={currencies.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("profitLoss.pair")}</FieldLabel>
            <ToolCombobox
              value={pairSymbol}
              onValueChange={choosePair}
              options={pairs.map((p) => ({ value: p.symbol, label: p.label }))}
            />
            <FieldDescription>
              {t("profitLoss.pipSize", { size: pipSize(pairSymbol) })}
            </FieldDescription>
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("profitLoss.direction")}</legend>
            <RadioGroup
              value={direction}
              onValueChange={(next) => setDirection(next as TradeDirection)}
              className="flex flex-wrap gap-4"
            >
              {(["buy", "sell"] as const).map((option) => (
                // Wrapped, and named on the item — gain-loss.tsx records why.
                <label key={option} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={option} aria-label={t(`profitLoss.${option}`)} />
                  {t(`profitLoss.${option}`)}
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <Field>
            <FieldLabel>{t("profitLoss.lots")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              value={lots}
              onChange={(event) => setLots(event.target.value)}
            />
            <FieldDescription>{t("profitLoss.lotsHint")}</FieldDescription>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("profitLoss.open")}</FieldLabel>
              <Input
                type="number"
                inputMode="decimal"
                step={step}
                value={open}
                onChange={(event) => setOpen(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("profitLoss.close")}</FieldLabel>
              <Input
                type="number"
                inputMode="decimal"
                step={step}
                value={close}
                onChange={(event) => setClose(event.target.value)}
              />
            </Field>
          </div>
        </>
      }
      results={
        result === null ? (
          <p className="text-sm text-muted-foreground">{t("common.enterValues")}</p>
        ) : (
          <>
            {/* The word beside the colour, never the colour alone. */}
            <div>
              <Badge variant={outcome === 1 ? "success" : outcome === -1 ? "danger" : "outline"}>
                {t(
                  outcome === 1
                    ? "profitLoss.result.profit"
                    : outcome === -1
                      ? "profitLoss.result.loss"
                      : "profitLoss.result.flat",
                )}
              </Badge>
            </div>
            <ResultRow
              label={t("profitLoss.result.inAccount", { currency: accountCurrency })}
              value={
                result.inAccount === null ? "—" : `${money(result.inAccount)} ${accountCurrency}`
              }
              note={
                result.inAccount === null
                  ? t("common.noRateForPair")
                  : t("profitLoss.result.costsNote")
              }
              emphasis
            />
            <ResultRow
              label={t("profitLoss.result.pips")}
              value={result.pips.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
                signDisplay: "exceptZero",
              })}
            />
            {result.quoteCurrency !== accountCurrency && (
              <ResultRow
                label={t("profitLoss.result.inQuote", { currency: result.quoteCurrency })}
                value={`${money(result.inQuote)} ${result.quoteCurrency}`}
              />
            )}
            <ResultRow
              label={t("profitLoss.result.priceMove")}
              value={Math.abs(positive(close)! - positive(open)!).toFixed(
                priceDecimals(pairSymbol),
              )}
            />
            <RateFootnote snapshot={snapshot} />
          </>
        )
      }
    />
  );
}
