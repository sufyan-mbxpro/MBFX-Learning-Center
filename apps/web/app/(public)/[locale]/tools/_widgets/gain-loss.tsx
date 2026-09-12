"use client";

// Gain & loss (changes-25 T6). The one calculator that needs no data at all —
// no rate, no bar, no provider — which is why it is the simplest island here
// and the one that proves the shell works without the market platform.
//
// **"Tell us one of three and we'll tell you the other two."** The control
// that picks WHICH of the three you are supplying is a radio group rather than
// three always-editable boxes: three editable fields make "all of them" and
// "none of them" reachable, and neither has a sensible answer.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { gainLoss, type GainLossDirection, type GainLossKnown } from "@repo/utils";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { ResultRow, WidgetLayout } from "../_components/widget-layout.tsx";

export interface GainLossConfig {
  defaultStartBalance?: number;
  decimals?: number;
}

type Known = "amount" | "percent" | "endingBalance";

export function GainLossWidget({ config }: { config: GainLossConfig }) {
  const t = useTranslations("tools");
  const decimals = config.decimals ?? 2;

  const [startBalance, setStartBalance] = useState(String(config.defaultStartBalance ?? 10000));
  const [direction, setDirection] = useState<GainLossDirection>("loss");
  const [known, setKnown] = useState<Known>("percent");
  const [value, setValue] = useState("50");

  const result = useMemo(() => {
    const start = Number(startBalance);
    const known_ = Number(value);
    if (!Number.isFinite(start) || start <= 0) return null;
    if (!Number.isFinite(known_) || known_ < 0) return null;
    try {
      return gainLoss({ startBalance: start, direction, known: { kind: known, value: known_ } as GainLossKnown });
    } catch {
      // The pure function throws a RangeError on a value it cannot use; a
      // widget renders an empty state for that rather than a stack trace.
      return null;
    }
  }, [startBalance, direction, known, value]);

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const percent = (n: number) => `${n.toFixed(decimals)}%`;

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("gainLoss.startBalance")}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              value={startBalance}
              onChange={(event) => setStartBalance(event.target.value)}
            />
            <FieldError />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("gainLoss.direction")}</legend>
            <RadioGroup
              value={direction}
              onValueChange={(next) => setDirection(next as GainLossDirection)}
              className="flex flex-wrap gap-4"
            >
              {(["gain", "loss"] as const).map((option) => (
                // The radio WRAPPED in its label, not pointed at by an
                // `htmlFor`: Base UI renders it as a button with
                // `role="radio"`, and a label's `for` does not name a button.
                // axe caught this as `aria-toggle-field-name`. A button IS a
                // labelable element, so wrapping is what gives it its name.
                <label key={option} className="flex items-center gap-2 text-sm">
                  {/* aria-label on the ITEM, not a wrapping label: Base UI
                      renders a span with role="radio" plus a hidden input, so
                      a label's labeled control is the INPUT and the span is
                      left unnamed. The visible text and the name are the same
                      string, so they cannot drift. */}
                  <RadioGroupItem value={option} aria-label={t(`gainLoss.${option}`)} />
                  {t(`gainLoss.${option}`)}
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("gainLoss.knownLegend")}</legend>
            <RadioGroup
              value={known}
              onValueChange={(next) => setKnown(next as Known)}
              className="flex flex-col gap-2"
            >
              {(["amount", "percent", "endingBalance"] as const).map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem
                    value={option}
                    aria-label={t(`gainLoss.known.${option}`)}
                  />
                  {t(`gainLoss.known.${option}`)}
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <Field>
            <FieldLabel>{t(`gainLoss.known.${known}`)}</FieldLabel>
            <Input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <FieldError />
          </Field>
        </>
      }
      results={
        result === null ? (
          <p className="text-sm text-muted-foreground">{t("common.enterValues")}</p>
        ) : (
          <>
            <ResultRow label={t("gainLoss.result.amount")} value={money(result.amount)} />
            <ResultRow label={t("gainLoss.result.percent")} value={percent(result.percent)} />
            <ResultRow
              label={t("gainLoss.result.endingBalance")}
              value={money(result.endingBalance)}
              emphasis
            />
            {/* The one number in this tool that surprises people, and the
                reason it exists: a 50% loss needs a 100% gain to get back.
                Rendered only for a loss, where it means something. */}
            {direction === "loss" && result.breakevenPercent > 0 && (
              <ResultRow
                label={t("gainLoss.result.breakeven")}
                value={percent(result.breakevenPercent)}
                note={t("gainLoss.result.breakevenNote")}
              />
            )}
          </>
        )
      }
    />
  );
}
