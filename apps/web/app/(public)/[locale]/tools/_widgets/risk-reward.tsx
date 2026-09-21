"use client";

// Risk & reward (changes-41, ADR-135).
//
// The position-size tool asks for a stop in PIPS. This one asks for three
// PRICES, which is how a chart presents a trade, and adds the take profit, so
// it can answer "is this trade worth taking" as well as "how big".
//
// **The side is read from the stop.** Below the entry is a buy, above is a
// sell. A take profit on the losing side is a state this form can reach, so it
// is a labelled warning, never a negative ratio.
//
// **The risk level is a word first.** The thresholds are the admin's
// (`conservativeMaxPercent` / `moderateMaxPercent`); the badge tone repeats
// the word and never replaces it.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { pipSize, riskLevel, riskReward, type RiskLevel } from "@repo/utils";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ResultRow, WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";
import { RateFootnote, type RateSnapshotView } from "../_components/rate-footnote.tsx";
import { positive, priceAt } from "../_components/price-defaults.ts";

export interface RiskRewardConfig {
  defaultAccountCurrency?: string;
  defaultPair?: string;
  defaultBalance?: number;
  defaultRiskPercent?: number;
  minRiskPercent?: number;
  maxRiskPercent?: number;
  conservativeMaxPercent?: number;
  moderateMaxPercent?: number;
  minRecommendedRatio?: number;
  pairs?: { symbol: string; label: string; price: number | null }[];
  accountCurrencies?: string[];
}

/** The seeded example: a 50-pip stop and a 100-pip target, the 1:2 the tips name. */
const EXAMPLE_STOP_PIPS = 50;
const EXAMPLE_TARGET_PIPS = 100;

const LEVEL_TONE: Record<RiskLevel, "success" | "warning" | "danger"> = {
  conservative: "success",
  moderate: "warning",
  aggressive: "danger",
};

export function RiskRewardWidget({
  config,
  snapshot,
}: {
  config: RiskRewardConfig;
  snapshot: RateSnapshotView | null;
}) {
  const t = useTranslations("tools");
  const pairs = config.pairs ?? [];
  const currencies = config.accountCurrencies?.length ? config.accountCurrencies : ["USD"];
  const priceOf = (symbol: string) => pairs.find((p) => p.symbol === symbol)?.price ?? null;
  const thresholds = {
    conservativeMax: config.conservativeMaxPercent ?? 1,
    moderateMax: config.moderateMaxPercent ?? 2,
  };
  const minRatio = config.minRecommendedRatio ?? 2;

  const initialPair = config.defaultPair ?? pairs[0]?.symbol ?? "EUR/USD";
  const [accountCurrency, setAccountCurrency] = useState(
    config.defaultAccountCurrency ?? currencies[0] ?? "USD",
  );
  const [balance, setBalance] = useState(String(config.defaultBalance ?? 10_000));
  const [riskPercent, setRiskPercent] = useState(String(config.defaultRiskPercent ?? 2));
  const [pairSymbol, setPairSymbol] = useState(initialPair);
  const [entry, setEntry] = useState(() => priceAt(initialPair, priceOf(initialPair)));
  const [stop, setStop] = useState(() =>
    priceAt(initialPair, priceOf(initialPair), -EXAMPLE_STOP_PIPS),
  );
  const [target, setTarget] = useState(() =>
    priceAt(initialPair, priceOf(initialPair), EXAMPLE_TARGET_PIPS),
  );

  const choosePair = (symbol: string) => {
    setPairSymbol(symbol);
    setEntry(priceAt(symbol, priceOf(symbol)));
    setStop(priceAt(symbol, priceOf(symbol), -EXAMPLE_STOP_PIPS));
    setTarget(priceAt(symbol, priceOf(symbol), EXAMPLE_TARGET_PIPS));
  };

  const risk = positive(riskPercent);
  const level = risk === null || risk >= 100 ? null : riskLevel(risk, thresholds);

  const result = useMemo(() => {
    const bal = positive(balance);
    const e = positive(entry);
    const s = positive(stop);
    if (bal === null || risk === null || risk >= 100 || e === null || s === null) return null;
    if (e === s) return null;
    return riskReward({
      balance: bal,
      riskPercent: risk,
      pair: pairSymbol,
      entry: e,
      stop: s,
      target: positive(target),
      accountCurrency,
      rates: snapshot?.rates ?? {},
    });
  }, [balance, risk, entry, stop, target, pairSymbol, accountCurrency, snapshot]);

  const number = (n: number, digits = 2) =>
    n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const step = String(pipSize(pairSymbol) / 10);

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("riskReward.accountCurrency")}</FieldLabel>
            <ToolCombobox
              value={accountCurrency}
              onValueChange={setAccountCurrency}
              options={currencies.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("riskReward.balance", { currency: accountCurrency })}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("riskReward.risk")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={config.minRiskPercent ?? 0.1}
              max={config.maxRiskPercent ?? 100}
              value={riskPercent}
              onChange={(event) => setRiskPercent(event.target.value)}
            />
            {level && (
              <FieldDescription className="flex items-center gap-2">
                {t("riskReward.levelLabel")}
                <Badge variant={LEVEL_TONE[level]}>{t(`riskReward.level.${level}`)}</Badge>
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel>{t("riskReward.pair")}</FieldLabel>
            <ToolCombobox
              value={pairSymbol}
              onValueChange={choosePair}
              options={pairs.map((p) => ({ value: p.symbol, label: p.label }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("riskReward.entry")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              step={step}
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("riskReward.stop")}</FieldLabel>
              <Input
                type="number"
                inputMode="decimal"
                step={step}
                value={stop}
                onChange={(event) => setStop(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("riskReward.target")}</FieldLabel>
              <Input
                type="number"
                inputMode="decimal"
                step={step}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
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
            <ResultRow
              label={t("riskReward.result.atRisk")}
              value={`${number(result.amountAtRisk)} ${accountCurrency}`}
              note={t("riskReward.result.atRiskNote", {
                percent: number(risk ?? 0),
                side: t(`riskReward.side.${result.side}`),
              })}
              emphasis
            />
            <ResultRow label={t("riskReward.result.stopPips")} value={number(result.stopPips, 1)} />
            {result.units === null ? (
              <Alert variant="info">
                <AlertDescription>{t("riskReward.result.needsRate")}</AlertDescription>
              </Alert>
            ) : (
              <ResultRow
                label={t("riskReward.result.size")}
                value={t("riskReward.result.sizeValue", {
                  units: number(result.units, 0),
                  lots: number(result.units / 100_000, 2),
                })}
              />
            )}
            {result.targetOnWrongSide ? (
              <Alert variant="warning">
                <AlertDescription>
                  {t(`riskReward.result.wrongSide.${result.side}`)}
                </AlertDescription>
              </Alert>
            ) : result.ratio !== null && result.reward !== null ? (
              <>
                <ResultRow
                  label={t("riskReward.result.ratio")}
                  value={t("riskReward.result.ratioValue", { ratio: number(result.ratio) })}
                  emphasis
                />
                <ResultRow
                  label={t("riskReward.result.reward")}
                  value={`${number(result.reward)} ${accountCurrency}`}
                  note={t("riskReward.result.targetPips", {
                    pips: number(result.targetPips ?? 0, 1),
                  })}
                />
                {result.ratio < minRatio && (
                  <Alert variant="info">
                    <AlertDescription>
                      {t("riskReward.result.belowMinimum", { ratio: number(minRatio, 1) })}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("riskReward.result.noTarget")}</p>
            )}
            <RateFootnote snapshot={snapshot} />
          </>
        )
      }
    />
  );
}
