"use client";

// Position size (changes-25 T6/T7).
//
// **It works without a rate, and says which half is missing.** With a USD
// account on a USD-quoted pair there is no conversion to do, so the answer is
// exact with no provider at all. With a different account currency the
// account leg needs a rate, and when that rate is absent the widget renders a
// labelled empty state rather than a number it cannot stand behind
// (ADR-087 #11).
//
// **A stale rate is labelled, never hidden.** The snapshot carries its own
// "as of" and a `stale` flag, and both reach the screen in words.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { accountPipValue, pipSize, positionSize } from "@repo/utils";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ResultRow, WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import { RateFootnote, type RateSnapshotView } from "../_components/rate-footnote.tsx";

export interface PositionSizeConfig {
  defaultAccountCurrency?: string;
  defaultRiskPercent?: number;
  minRiskPercent?: number;
  maxRiskPercent?: number;
  pairs?: { symbol: string; label: string; price: number | null }[];
  accountCurrencies?: string[];
}

export function PositionSizeWidget({
  config,
  snapshot,
}: {
  config: PositionSizeConfig;
  snapshot: RateSnapshotView | null;
}) {
  const t = useTranslations("tools");
  const pairs = config.pairs ?? [];
  const currencies = config.accountCurrencies ?? ["USD"];

  const [accountCurrency, setAccountCurrency] = useState(
    config.defaultAccountCurrency ?? currencies[0] ?? "USD",
  );
  const [balance, setBalance] = useState("10000");
  const [riskPercent, setRiskPercent] = useState(String(config.defaultRiskPercent ?? 1));
  const [stopLossPips, setStopLossPips] = useState("50");
  const [pairSymbol, setPairSymbol] = useState(pairs[0]?.symbol ?? "EUR/USD");

  const pair = pairs.find((p) => p.symbol === pairSymbol);

  const result = useMemo(() => {
    const bal = Number(balance);
    const risk = Number(riskPercent);
    const stop = Number(stopLossPips);
    if (!Number.isFinite(bal) || bal <= 0) return null;
    if (!Number.isFinite(risk) || risk <= 0 || risk >= 100) return null;
    if (!Number.isFinite(stop) || stop <= 0) return null;

    const amountAtRisk = (bal * risk) / 100;
    const price = pair?.price ?? null;

    // Without a price we can still say what is at risk — that figure needs no
    // market data at all. Only the SIZE needs the pip value.
    if (price === null || price <= 0) {
      return { amountAtRisk, units: null, lots: null, pipValue: null };
    }

    const leg = accountPipValue({
      pair: pairSymbol,
      units: 100_000,
      price,
      accountCurrency,
      rates: snapshot?.rates ?? {},
    });
    const perLot = leg.accountCurrency;
    if (perLot === null || perLot <= 0) {
      return { amountAtRisk, units: null, lots: null, pipValue: null };
    }

    const lots = positionSize({
      balance: bal,
      riskFraction: risk / 100,
      stopLossPips: stop,
      pipValuePerLot: perLot,
    });
    return { amountAtRisk, units: lots * 100_000, lots, pipValue: perLot };
  }, [balance, riskPercent, stopLossPips, pair, pairSymbol, accountCurrency, snapshot]);

  const number = (n: number, digits = 2) =>
    n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("positionSize.accountCurrency")}</FieldLabel>
            <ToolCombobox
              value={accountCurrency}
              onValueChange={setAccountCurrency}
              options={currencies.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("positionSize.balance")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("positionSize.risk")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={config.minRiskPercent ?? 0.1}
              max={config.maxRiskPercent ?? 100}
              value={riskPercent}
              onChange={(event) => setRiskPercent(event.target.value)}
            />
            <FieldDescription>{t("positionSize.riskHint")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t("positionSize.stopLoss")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              value={stopLossPips}
              onChange={(event) => setStopLossPips(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("positionSize.pair")}</FieldLabel>
            <ToolCombobox
              value={pairSymbol}
              onValueChange={setPairSymbol}
              options={pairs.map((p) => ({ value: p.symbol, label: p.label }))}
            />
            <FieldDescription>
              {t("positionSize.pipSize", { size: pipSize(pairSymbol) })}
            </FieldDescription>
          </Field>
        </>
      }
      results={
        result === null ? (
          <p className="text-sm text-muted-foreground">{t("common.enterValues")}</p>
        ) : (
          <>
            <ResultRow
              label={t("positionSize.result.atRisk")}
              value={`${number(result.amountAtRisk)} ${accountCurrency}`}
            />
            {result.units === null ? (
              // The honest empty state: the figure above needs no market data
              // and is correct; the size below does, and we do not have it.
              <Alert variant="info">
                <AlertDescription>{t("positionSize.result.needsRate")}</AlertDescription>
              </Alert>
            ) : (
              <>
                <ResultRow
                  label={t("positionSize.result.units")}
                  value={number(result.units, 0)}
                  emphasis
                />
                <ResultRow
                  label={t("positionSize.result.lots")}
                  value={t("positionSize.result.lotsValue", {
                    standard: number(result.lots!, 2),
                    mini: number(result.lots! * 10, 2),
                    micro: number(result.lots! * 100, 2),
                  })}
                />
                {/* Shown, not hidden: the conversion is the step most
                    spreadsheets get wrong, so the tool prints it. */}
                <ResultRow
                  label={t("positionSize.result.pipValue")}
                  value={`${number(result.pipValue!)} ${accountCurrency}`}
                  note={t("positionSize.result.pipValueNote")}
                />
              </>
            )}
            <RateFootnote snapshot={snapshot} />
          </>
        )
      }
    />
  );
}
