"use client";

// Margin (changes-41, ADR-135).
//
// **The deposit is measured in the BASE currency**, so a USD account opening
// USD/JPY needs no exchange rate at all and the answer is exact without a
// provider. Any other combination needs one rate, and without it the account
// figure is a labelled dash while the base-currency figure still stands —
// position-size's honest empty state, one tool over.
//
// **Free margin and margin level are measured against the BALANCE**, because
// with no position open yet equity and balance are the same thing. The note
// under the level says so rather than implying a P/L we do not have.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { accountMargin } from "@repo/utils";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ResultRow, WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import { RateFootnote, type RateSnapshotView } from "../_components/rate-footnote.tsx";
import { positive } from "../_components/price-defaults.ts";

export interface MarginConfig {
  defaultAccountCurrency?: string;
  defaultPair?: string;
  defaultUnits?: number;
  defaultBalance?: number;
  leverageOptions?: number[];
  defaultLeverage?: number;
  pairs?: { symbol: string; label: string; price: number | null }[];
  accountCurrencies?: string[];
}

export function MarginWidget({
  config,
  snapshot,
}: {
  config: MarginConfig;
  snapshot: RateSnapshotView | null;
}) {
  const t = useTranslations("tools");
  const pairs = config.pairs ?? [];
  const currencies = config.accountCurrencies?.length ? config.accountCurrencies : ["USD"];
  const leverageOptions = config.leverageOptions?.length ? config.leverageOptions : [100];

  const [accountCurrency, setAccountCurrency] = useState(
    config.defaultAccountCurrency ?? currencies[0] ?? "USD",
  );
  const [pairSymbol, setPairSymbol] = useState(config.defaultPair ?? pairs[0]?.symbol ?? "EUR/USD");
  const [units, setUnits] = useState(String(config.defaultUnits ?? 100_000));
  const [leverage, setLeverage] = useState(
    String(config.defaultLeverage ?? leverageOptions[0] ?? 100),
  );
  const [balance, setBalance] = useState(String(config.defaultBalance ?? 10_000));

  const result = useMemo(() => {
    const u = positive(units);
    const lev = positive(leverage);
    if (u === null || lev === null) return null;
    const bal = balance.trim() === "" ? null : Number(balance);
    if (bal !== null && (!Number.isFinite(bal) || bal < 0)) return null;
    return accountMargin({
      pair: pairSymbol,
      units: u,
      leverage: lev,
      accountCurrency,
      rates: snapshot?.rates ?? {},
      balance: bal,
    });
  }, [units, leverage, balance, pairSymbol, accountCurrency, snapshot]);

  const number = (n: number, digits = 2) =>
    n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("margin.accountCurrency")}</FieldLabel>
            <ToolCombobox
              value={accountCurrency}
              onValueChange={setAccountCurrency}
              options={currencies.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("margin.pair")}</FieldLabel>
            <ToolCombobox
              value={pairSymbol}
              onValueChange={setPairSymbol}
              options={pairs.map((p) => ({ value: p.symbol, label: p.label }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("margin.units")}</FieldLabel>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={units}
              onChange={(event) => setUnits(event.target.value)}
            />
            <FieldDescription>{t("margin.unitsHint")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t("margin.leverage")}</FieldLabel>
            <ToolCombobox
              value={leverage}
              onValueChange={setLeverage}
              options={leverageOptions.map((n) => ({
                value: String(n),
                label: t("margin.leverageValue", { ratio: n }),
              }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("margin.balance", { currency: accountCurrency })}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
            />
          </Field>
        </>
      }
      results={
        result === null ? (
          <p className="text-sm text-muted-foreground">{t("common.enterValues")}</p>
        ) : (
          <>
            <ResultRow
              label={t("margin.result.required")}
              value={
                result.inAccount === null ? "—" : `${number(result.inAccount)} ${accountCurrency}`
              }
              note={result.inAccount === null ? t("common.noRateForPair") : undefined}
              emphasis
            />
            {result.baseCurrency !== accountCurrency && (
              <ResultRow
                label={t("margin.result.inBase", { currency: result.baseCurrency })}
                value={`${number(result.inBase)} ${result.baseCurrency}`}
              />
            )}
            {result.freeMargin !== null && (
              <ResultRow
                label={t("margin.result.free")}
                value={`${number(result.freeMargin)} ${accountCurrency}`}
              />
            )}
            {result.marginLevel !== null && (
              <ResultRow
                label={t("margin.result.level")}
                value={`${number(result.marginLevel)}%`}
                note={t("margin.result.levelNote")}
              />
            )}
            {result.freeMargin !== null && result.freeMargin < 0 && (
              <Alert variant="warning">
                <AlertDescription>{t("margin.result.insufficient")}</AlertDescription>
              </Alert>
            )}
            <RateFootnote snapshot={snapshot} />
          </>
        )
      }
    />
  );
}
