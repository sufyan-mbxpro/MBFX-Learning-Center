"use client";

// Pivot points (changes-25 T6, autofill in T7).
//
// **All five methods at once, in one table.** The reference shows them
// together, and it is the right call: the methods disagree, and seeing the
// spread is most of what the tool is for.
//
// **An absent level renders as a dash, never as zero.** DeMark has one level a
// side and Camarilla has four; `pivotPoints` returns `null` for the rest, and
// a zero would render as a price of zero — a number a reader could act on.
//
// The table scrolls inside its own container at 400px rather than pushing the
// page sideways.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PIVOT_METHODS, type PivotInterval } from "@repo/contracts";
import { pivotPoints, type PivotLevels, type PivotMethodName } from "@repo/utils";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { WidgetLayout } from "../_components/widget-layout.tsx";
import { ToolCombobox } from "../_components/tool-combobox.tsx";

export interface PivotOhlc {
  interval: string;
  symbol: string;
  from: string;
  to: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PivotPointsConfig {
  intervals?: string[];
  defaultInterval?: string;
  symbols?: { symbol: string; label: string }[];
}

const LEVELS = ["r4", "r3", "r2", "r1", "pp", "s1", "s2", "s3", "s4"] as const;

export function PivotPointsWidget({
  config,
  autofill,
  defaultSymbol,
}: {
  config: PivotPointsConfig;
  /**
   * The last COMPLETE period for each offered interval, when the platform has
   * bars. Absent (or empty) is the normal first-run state, and the widget
   * stays fully usable in manual mode — which is why manual is what it opens
   * on when nothing is available.
   */
  autofill: Record<string, PivotOhlc | null>;
  defaultSymbol: string;
}) {
  const t = useTranslations("tools");
  const intervals = config.intervals ?? ["1D", "1W", "1M", "1Y"];
  const symbols = config.symbols ?? [];

  const [symbol, setSymbol] = useState(defaultSymbol || symbols[0]?.symbol || "EUR/USD");
  const [interval, setInterval] = useState<string>(config.defaultInterval ?? intervals[0] ?? "1D");

  const fetched = autofill[interval] ?? null;
  const [manual, setManual] = useState(false);
  // Switching to Manual KEEPS the fetched numbers as the starting values
  // rather than clearing the form: a reader who wants to nudge one figure
  // should not have to retype the other three.
  const [ohlc, setOhlc] = useState({ open: "", high: "", low: "", close: "" });

  const effective = useMemo(() => {
    if (manual || !fetched) {
      return {
        open: Number(ohlc.open || fetched?.open || 0),
        high: Number(ohlc.high || fetched?.high || 0),
        low: Number(ohlc.low || fetched?.low || 0),
        close: Number(ohlc.close || fetched?.close || 0),
      };
    }
    return { open: fetched.open, high: fetched.high, low: fetched.low, close: fetched.close };
  }, [manual, fetched, ohlc]);

  const rows = useMemo(() => {
    const { open, high, low, close } = effective;
    if (![open, high, low, close].every((v) => Number.isFinite(v) && v > 0)) return null;
    if (high < low) return null;
    const out: Record<PivotMethodName, PivotLevels> = {} as Record<PivotMethodName, PivotLevels>;
    for (const method of PIVOT_METHODS) {
      try {
        out[method] = pivotPoints({ open, high, low, close, method });
      } catch {
        return null;
      }
    }
    return out;
  }, [effective]);

  const decimals = symbol.endsWith("/JPY") ? 3 : 5;
  const price = (n: number | null) => (n === null ? "—" : n.toFixed(decimals));

  const setField = (key: keyof typeof ohlc) => (event: { target: { value: string } }) => {
    setManual(true);
    setOhlc((prev) => ({
      // Seed the other three from the fetched bar on the first manual edit, so
      // switching mode does not empty the form.
      open: prev.open || String(fetched?.open ?? ""),
      high: prev.high || String(fetched?.high ?? ""),
      low: prev.low || String(fetched?.low ?? ""),
      close: prev.close || String(fetched?.close ?? ""),
      [key]: event.target.value,
    }));
  };

  return (
    <WidgetLayout
      inputs={
        <>
          <Field>
            <FieldLabel>{t("pivot.symbol")}</FieldLabel>
            <ToolCombobox
              value={symbol}
              onValueChange={setSymbol}
              options={symbols.map((s) => ({ value: s.symbol, label: s.label }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t("pivot.interval")}</FieldLabel>
            <ToolCombobox
              value={interval}
              onValueChange={(next) => setInterval(next as PivotInterval)}
              options={intervals.map((value) => ({ value, label: t(`pivot.intervals.${value}`) }))}
            />
            <FieldDescription>
              {fetched
                ? t("pivot.autofilled", { from: fetched.from, to: fetched.to })
                : t("pivot.manualOnly")}
            </FieldDescription>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {(["open", "high", "low", "close"] as const).map((key) => (
              <Field key={key}>
                <FieldLabel>{t(`pivot.${key}`)}</FieldLabel>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.00001"
                  value={
                    manual ? ohlc[key] : fetched ? String(fetched[key]) : (ohlc[key] ?? "")
                  }
                  placeholder={fetched ? String(fetched[key]) : undefined}
                  onChange={setField(key)}
                />
              </Field>
            ))}
          </div>
        </>
      }
      results={
        rows === null ? (
          <Alert variant="info">
            <AlertDescription>{t("pivot.needsOhlc")}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">{t("pivot.tableHint")}</p>
        )
      }
      wide={
        rows === null ? null : (
          // Its own scroll container: five methods × nine levels is the one
          // table on this page wider than a phone.
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <caption className="sr-only">{t("pivot.tableCaption")}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("pivot.level")}
                  </th>
                  {PIVOT_METHODS.map((method) => (
                    <th key={method} scope="col" className="py-2 text-end font-medium">
                      {t(`pivot.methods.${method}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((level) => (
                  <tr key={level} className="border-b border-border/50 last:border-0">
                    <th scope="row" className="py-1.5 text-start font-normal text-muted-foreground">
                      {t(`pivot.levels.${level}`)}
                    </th>
                    {PIVOT_METHODS.map((method) => (
                      <td
                        key={method}
                        className={`py-1.5 text-end tabular-nums ${
                          level === "pp" ? "font-semibold" : ""
                        }`}
                      >
                        {price(level === "pp" ? rows[method].pp : rows[method][level])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    />
  );
}
