"use client";

// Currency converter (changes-25 T7).
//
// **Client-side arithmetic on one cached snapshot** (ADR-087 #7). The
// reference posts back on every "Calculate"; we read every active
// instrument's latest rate once per page, pass it down, and do the
// cross-rate maths here. It costs one cached read rather than one request per
// keystroke, and it keeps working while the provider is down.
//
// **The rate-type control is arithmetic on the SAME numbers.** Bank, ATM,
// card and kiosk apply an admin-configured percentage to the mid-market rate.
// No second request, no second stored figure, and the stored mid-market value
// is never touched. The copy calls them typical markups and names no provider,
// because what a particular bank charges you on a particular day is between
// you and them.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight } from "lucide-react";
import { crossRate, quoteWithMarkup } from "@repo/utils";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ResultRow, WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import { RateFootnote, type RateSnapshotView } from "../_components/rate-footnote.tsx";

export type RateType = "market" | "bank" | "atm" | "card" | "kiosk";

export interface CurrencyConverterConfig {
  currencies?: string[];
  defaultFrom?: string;
  defaultTo?: string;
  defaultAmount?: number;
  decimals?: number;
  rateMarkups?: Partial<Record<Exclude<RateType, "market">, number>>;
  offeredRateTypes?: RateType[];
}

export function CurrencyConverterWidget({
  config,
  snapshot,
}: {
  config: CurrencyConverterConfig;
  snapshot: RateSnapshotView | null;
}) {
  const t = useTranslations("tools");
  const currencies = config.currencies?.length ? config.currencies : ["USD", "EUR", "GBP"];
  const decimals = config.decimals ?? 2;
  const offered: RateType[] = config.offeredRateTypes?.length
    ? config.offeredRateTypes
    : ["market"];

  const [amount, setAmount] = useState(String(config.defaultAmount ?? 100));
  const [from, setFrom] = useState(config.defaultFrom ?? currencies[0] ?? "USD");
  const [to, setTo] = useState(config.defaultTo ?? currencies[1] ?? "EUR");
  const [rateType, setRateType] = useState<RateType>(offered[0] ?? "market");

  const mid = useMemo(
    () => crossRate(from, to, snapshot?.rates ?? {}),
    [from, to, snapshot],
  );

  const markup = rateType === "market" ? 0 : (config.rateMarkups?.[rateType] ?? 0);

  const result = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || mid === null) return null;
    try {
      // The arithmetic lives in @repo/utils, under the 90% pure-logic floor:
      // it is the one piece of MONEY maths on the public side, and the sign
      // of the markup is the thing worth a test rather than a comment.
      return quoteWithMarkup({ amount: value, midRate: mid, markupPercent: markup });
    } catch {
      return null;
    }
  }, [amount, mid, markup]);

  const money = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  const rate = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("converter.amount")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-(--grid-field-swap-field)">
            <Field>
              <FieldLabel>{t("converter.from")}</FieldLabel>
              <ToolCombobox
                value={from}
                onValueChange={setFrom}
                options={currencies.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Button
              variant="outline"
              size="icon"
              onClick={swap}
              aria-label={t("converter.swap")}
              className="self-end"
            >
              <ArrowLeftRight aria-hidden />
            </Button>
            <Field>
              <FieldLabel>{t("converter.to")}</FieldLabel>
              <ToolCombobox
                value={to}
                onValueChange={setTo}
                options={currencies.map((value) => ({ value, label: value }))}
              />
            </Field>
          </div>

          {offered.length > 1 && (
            <Field>
              <FieldLabel>{t("converter.rateType")}</FieldLabel>
              <ToolCombobox
                value={rateType}
                onValueChange={(next) => setRateType(next as RateType)}
                options={offered.map((value) => ({
                  value,
                  label: t(`converter.rateTypes.${value}`),
                }))}
              />
              <FieldDescription>{t("converter.rateTypeHint")}</FieldDescription>
            </Field>
          )}
        </>
      }
      results={
        result === null ? (
          <>
            <p className="text-sm text-muted-foreground">
              {mid === null ? t("common.noRateForPair") : t("common.enterValues")}
            </p>
            <RateFootnote snapshot={snapshot} />
          </>
        ) : (
          <>
            <ResultRow
              label={t("converter.result.converted", { to })}
              value={`${money(result.converted)} ${to}`}
              emphasis
            />
            <ResultRow
              label={t("converter.result.rate")}
              value={`1 ${from} = ${rate(result.effectiveRate)} ${to}`}
              note={
                rateType === "market"
                  ? t("converter.result.midNote")
                  : t("converter.result.markupNote", { percent: markup })
              }
            />
            {/* What the markup COSTS, in the reader's own money. The
                mid-market figure stays on screen beside it rather than being
                replaced, so the comparison is visible rather than implied. */}
            {rateType !== "market" && (
              <ResultRow
                label={t("converter.result.cost")}
                value={`${money(result.cost)} ${to}`}
                note={t("converter.result.costNote", { atMid: money(result.atMid), to })}
              />
            )}
            <RateFootnote snapshot={snapshot} />
          </>
        )
      }
    />
  );
}
