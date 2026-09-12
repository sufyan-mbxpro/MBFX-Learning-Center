"use client";

// Pip value (changes-25 T6/T7).
//
// Two figures, and only the second needs a rate: a pip in the pair's QUOTE
// currency is `pipSize × units` and needs nothing at all, while the same pip
// in the reader's ACCOUNT currency needs the quote → account leg. Rendering
// them as two rows rather than one is what lets the tool answer at all when
// the provider is down.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { accountPipValue, pipSize } from "@repo/utils";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ResultRow, WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import { RateFootnote, type RateSnapshotView } from "../_components/rate-footnote.tsx";

export interface PipValueConfig {
  defaultAccountCurrency?: string;
  defaultUnits?: number;
  pairs?: { symbol: string; label: string; price: number | null }[];
  accountCurrencies?: string[];
}

export function PipValueWidget({
  config,
  snapshot,
}: {
  config: PipValueConfig;
  snapshot: RateSnapshotView | null;
}) {
  const t = useTranslations("tools");
  const pairs = config.pairs ?? [];
  const currencies = config.accountCurrencies ?? ["USD"];

  const [pairSymbol, setPairSymbol] = useState(pairs[0]?.symbol ?? "EUR/USD");
  const [accountCurrency, setAccountCurrency] = useState(
    config.defaultAccountCurrency ?? currencies[0] ?? "USD",
  );
  const [units, setUnits] = useState(String(config.defaultUnits ?? 100_000));
  const pair = pairs.find((p) => p.symbol === pairSymbol);
  const [price, setPrice] = useState("");

  // The provider's price is the DEFAULT, not the value: the reference lets a
  // reader type the ask they were actually quoted, and overwriting that on
  // every re-render would make the field unusable.
  const effectivePrice = price !== "" ? Number(price) : (pair?.price ?? null);

  const result = useMemo(() => {
    const u = Number(units);
    if (!Number.isFinite(u) || u <= 0) return null;
    if (effectivePrice === null || !Number.isFinite(effectivePrice) || effectivePrice <= 0) {
      return null;
    }
    return accountPipValue({
      pair: pairSymbol,
      units: u,
      price: effectivePrice,
      accountCurrency,
      rates: snapshot?.rates ?? {},
    });
  }, [units, effectivePrice, pairSymbol, accountCurrency, snapshot]);

  const quoteCurrency = pairSymbol.split("/")[1] ?? "USD";
  const number = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 });

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("pipValue.pair")}</FieldLabel>
            <ToolCombobox
              value={pairSymbol}
              onValueChange={setPairSymbol}
              options={pairs.map((p) => ({ value: p.symbol, label: p.label }))}
            />
            <FieldDescription>
              {t("pipValue.pipSize", { size: pipSize(pairSymbol) })}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t("pipValue.price")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              step="0.00001"
              placeholder={pair?.price ? String(pair.price) : undefined}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <FieldDescription>{t("pipValue.priceHint")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t("pipValue.units")}</FieldLabel>
            <Input
              type="number"
              inputMode="numeric"
              value={units}
              onChange={(event) => setUnits(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("pipValue.accountCurrency")}</FieldLabel>
            <ToolCombobox
              value={accountCurrency}
              onValueChange={setAccountCurrency}
              options={currencies.map((value) => ({ value, label: value }))}
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
              label={t("pipValue.result.inQuote", { currency: quoteCurrency })}
              value={`${number(result.quoteCurrency)} ${quoteCurrency}`}
              emphasis={accountCurrency === quoteCurrency}
            />
            {accountCurrency !== quoteCurrency && (
              <ResultRow
                label={t("pipValue.result.inAccount", { currency: accountCurrency })}
                value={
                  result.accountCurrency === null
                    ? "—"
                    : `${number(result.accountCurrency)} ${accountCurrency}`
                }
                // A dash, never a NaN and never a zero: we do not know, and
                // saying so is the only honest option.
                note={result.accountCurrency === null ? t("common.noRateForPair") : undefined}
                emphasis={result.accountCurrency !== null}
              />
            )}
            <RateFootnote snapshot={snapshot} />
          </>
        )
      }
    />
  );
}
