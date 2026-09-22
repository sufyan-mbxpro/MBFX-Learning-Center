"use client";

// The config panels, one per tool (changes-25 T5, ADR-086 #2; three more in ADR-135).
//
// **This is where "maximum control from the admin side" actually lives.** The
// owner's B4 and B6 asked for it; ADR-086 #1 drew the line. What an admin can
// change here is every DEFAULT, LIMIT and INSTRUMENT LIST a tool reads. What
// they cannot change is what the tool computes, which inputs it has, or how
// many pivot methods exist — a calculator assembled out of admin fields is a
// programming language with no type checker, and the first wrong result looks
// exactly like a right one.
//
// One switch, eight small panels. Each edits the shape
// `TOOL_CONFIG_SCHEMAS[key]` describes, and the editor's `useFieldErrors` runs
// that same schema, so a value the service would reject is rejected here.
import {
  CORRELATION_WINDOWS,
  PIVOT_INTERVALS,
  RISK_DIRECTIONS,
  type ToolKey,
} from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Field as UiField, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useState } from "react";
import { CheckCheck, Plus, Search, Trash2, X } from "lucide-react";
import { humanizeKey } from "@repo/utils";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { Field } from "../../../_components/editor/editor-section.tsx";

export interface InstrumentOption {
  id: string;
  symbol: string;
  displayName: string;
  kind: string;
}

export interface ConfigPanelLabels {
  defaultAccountCurrency: string;
  defaultPair: string;
  defaultRisk: string;
  minRisk: string;
  maxRisk: string;
  pairs: string;
  accountCurrencies: string;
  defaultUnits: string;
  defaultStartBalance: string;
  decimals: string;
  intervals: string;
  defaultInterval: string;
  symbols: string;
  defaultSymbol: string;
  sessions: string;
  sessionName: string;
  sessionCity: string;
  sessionZone: string;
  sessionOpen: string;
  sessionClose: string;
  addSession: string;
  removeSession: string;
  mediumVolumeFrom: string;
  highVolumeFrom: string;
  currencies: string;
  defaultFrom: string;
  defaultTo: string;
  defaultAmount: string;
  rateMarkups: string;
  rateMarkupsHint: string;
  offeredRateTypes: string;
  windows: string;
  defaultWindow: string;
  instruments: string;
  components: string;
  componentsHint: string;
  addComponent: string;
  removeComponent: string;
  weight: string;
  direction: string;
  lookbackDays: string;
  riskOffBelow: string;
  riskOnAbove: string;
  defaultBalance: string;
  leverageOptions: string;
  defaultLeverage: string;
  leverageValue: string;
  defaultLots: string;
  conservativeMax: string;
  moderateMax: string;
  riskLevelsHint: string;
  minRecommendedRatio: string;
  minRecommendedRatioHint: string;
  none: string;
  selectedSuffix: string;
  selectAll: string;
  clearAll: string;
  filterInstruments: string;
  noInstrumentMatch: string;
}

type Config = Record<string, unknown>;

/** The leverage ratios the margin panel offers as checkboxes (ADR-135). */
const LEVERAGE_PRESETS = [1, 2, 5, 10, 20, 30, 50, 100, 200, 300, 400, 500, 1000];

/** A checkbox list, not a multi-select: a clearer control for thirty rows,
 *  keyboard-reachable by construction, and it shows the count it has picked.
 *
 *  changes-46 (image-113): "an option to choose all currencies". Select all /
 *  Clear all sit in the label row, and a filter narrows the grid once the list
 *  is long enough to scroll. Both buttons act on the FILTERED rows, so "type
 *  EUR, Select all" ticks the euro pairs and leaves the rest as they were. */
function InstrumentPicker({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: InstrumentOption[];
  value: string[];
  onChange: (next: string[]) => void;
  labels: Pick<
    ConfigPanelLabels,
    "selectedSuffix" | "selectAll" | "clearAll" | "filterInstruments" | "noInstrumentMatch"
  >;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter(
        (option) =>
          option.symbol.toLowerCase().includes(needle) ||
          option.displayName.toLowerCase().includes(needle),
      )
    : options;
  const visibleIds = new Set(visible.map((option) => option.id));
  const allVisibleSelected = visible.length > 0 && visible.every((o) => selected.has(o.id));
  const noneVisibleSelected = visible.every((o) => !selected.has(o.id));

  // Rebuilt in the OPTIONS' order, like `EnumPicker`, so a select-all does
  // not leave the stored list in whatever order the boxes were ticked.
  const selectVisible = () =>
    onChange(options.filter((o) => selected.has(o.id) || visibleIds.has(o.id)).map((o) => o.id));
  const clearVisible = () => onChange(value.filter((id) => !visibleIds.has(id)));

  return (
    <Field
      label={`${label} (${value.length} ${labels.selectedSuffix})`}
      adornment={
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={allVisibleSelected}
            onClick={selectVisible}
          >
            <CheckCheck data-icon="inline-start" aria-hidden />
            {labels.selectAll}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={noneVisibleSelected}
            onClick={clearVisible}
          >
            <X data-icon="inline-start" aria-hidden />
            {labels.clearAll}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {options.length > 8 && (
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.filterInstruments}
              aria-label={labels.filterInstruments}
              className="ps-9"
            />
          </div>
        )}
        <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.length === 0 ? (
            <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
              {labels.noInstrumentMatch}
            </p>
          ) : (
            visible.map((option) => (
              // A UiField per row, never a bare HTML label element (ADR-077):
              // the Field wires the label to its control, which is the thing a
              // hand-written one gets wrong often enough to be worth a rule.
              <UiField key={option.id} orientation="horizontal">
                <Checkbox
                  checked={selected.has(option.id)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked ? [...value, option.id] : value.filter((id) => id !== option.id),
                    )
                  }
                />
                <FieldLabel className="min-w-0 font-normal">
                  <span className="min-w-0 truncate">{option.symbol}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {option.displayName}
                  </span>
                </FieldLabel>
              </UiField>
            ))
          )}
        </div>
      </div>
    </Field>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  step,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (next: number) => void;
  step?: string;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

/** A checkbox row over a fixed enum — the windows and interval lists. */
function EnumPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const selected = new Set(value);
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <UiField key={option} orientation="horizontal" className="w-auto">
            <Checkbox
              checked={selected.has(option)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? // Rebuilt from the ENUM's order, not appended: the list a
                      // tool offers should read 5d, 10d, 30d… whatever order the
                      // boxes were ticked in.
                      options.filter((o) => selected.has(o) || o === option)
                    : value.filter((v) => v !== option),
                )
              }
            />
            <FieldLabel className="font-normal">{option}</FieldLabel>
          </UiField>
        ))}
      </div>
    </Field>
  );
}

export function ConfigPanel({
  toolKey,
  config,
  onChange,
  instruments,
  labels,
}: {
  toolKey: ToolKey;
  config: Config;
  onChange: (next: Config) => void;
  instruments: InstrumentOption[];
  labels: ConfigPanelLabels;
}) {
  const set = (patch: Config) => onChange({ ...config, ...patch });

  const currencies = instruments.filter((i) => i.kind === "CURRENCY");
  const pairs = instruments.filter((i) => i.kind === "PAIR");
  const currencyCodes = currencies.map((c) => ({ value: c.symbol, label: c.displayName }));
  const instrumentOptions = [
    { value: "", label: labels.none },
    ...instruments.map((i) => ({ value: i.id, label: `${i.symbol} — ${i.displayName}` })),
  ];

  const arr = (key: string): string[] =>
    Array.isArray(config[key]) ? (config[key] as string[]) : [];
  // Pivot points: the default is picked FROM the offered symbols, so the two
  // controls cannot disagree. With nothing ticked yet, every instrument.
  const offeredSymbols = new Set(arr("symbolIds"));
  const defaultSymbolOptions =
    offeredSymbols.size === 0
      ? instrumentOptions
      : instrumentOptions.filter((o) => o.value === "" || offeredSymbols.has(o.value));
  const num = (key: string): number | undefined =>
    typeof config[key] === "number" ? (config[key] as number) : undefined;
  const str = (key: string): string =>
    typeof config[key] === "string" ? (config[key] as string) : "";

  /** The account-currency and pair pickers three calculators share. */
  const pairAndCurrencyPickers = (
    <>
      <InstrumentPicker
        label={labels.pairs}
        options={pairs}
        value={arr("pairIds")}
        onChange={(v) => set({ pairIds: v })}
        labels={labels}
      />
      <InstrumentPicker
        label={labels.accountCurrencies}
        options={currencies}
        value={arr("accountCurrencyIds")}
        onChange={(v) => set({ accountCurrencyIds: v })}
        labels={labels}
      />
    </>
  );
  const defaultCurrencyAndPair = (
    <>
      <Field label={labels.defaultAccountCurrency}>
        <AdminCombobox
          value={str("defaultAccountCurrency")}
          onValueChange={(v) => set({ defaultAccountCurrency: v })}
          options={currencyCodes}
        />
      </Field>
      <Field label={labels.defaultPair}>
        <AdminCombobox
          value={str("defaultPairId")}
          onValueChange={(v) => set({ defaultPairId: v || null })}
          options={instrumentOptions}
        />
      </Field>
    </>
  );

  switch (toolKey) {
    case "margin": {
      // The offered leverages are a checkbox row over the common ratios PLUS
      // whatever is already stored, so a value outside the presets that an
      // older save wrote is shown and can be unticked, never silently kept.
      const stored = Array.isArray(config.leverageOptions)
        ? (config.leverageOptions as number[])
        : [];
      const presets = [...new Set([...LEVERAGE_PRESETS, ...stored])].sort((a, b) => a - b);
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{defaultCurrencyAndPair}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label={labels.defaultUnits}
              value={num("defaultUnits")}
              onChange={(v) => set({ defaultUnits: v })}
            />
            <NumberField
              label={labels.defaultBalance}
              value={num("defaultBalance")}
              onChange={(v) => set({ defaultBalance: v })}
            />
            <Field label={labels.defaultLeverage}>
              <AdminCombobox
                value={num("defaultLeverage") === undefined ? "" : String(num("defaultLeverage"))}
                onValueChange={(v) => set({ defaultLeverage: Number(v) })}
                options={stored.map((n) => ({
                  value: String(n),
                  label: labels.leverageValue.replace("{ratio}", String(n)),
                }))}
              />
            </Field>
          </div>
          <EnumPicker
            label={labels.leverageOptions}
            options={presets.map(String)}
            value={stored.map(String)}
            onChange={(next) => set({ leverageOptions: next.map(Number) })}
          />
          {pairAndCurrencyPickers}
        </div>
      );
    }

    case "profit-loss":
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {defaultCurrencyAndPair}
            <NumberField
              label={labels.defaultLots}
              value={num("defaultLots")}
              onChange={(v) => set({ defaultLots: v })}
              step="0.01"
            />
          </div>
          {pairAndCurrencyPickers}
        </div>
      );

    case "risk-reward":
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{defaultCurrencyAndPair}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              label={labels.defaultBalance}
              value={num("defaultBalance")}
              onChange={(v) => set({ defaultBalance: v })}
            />
            <NumberField
              label={labels.defaultRisk}
              value={num("defaultRiskPercent")}
              onChange={(v) => set({ defaultRiskPercent: v })}
              step="0.1"
            />
            <NumberField
              label={labels.minRisk}
              value={num("minRiskPercent")}
              onChange={(v) => set({ minRiskPercent: v })}
              step="0.1"
            />
            <NumberField
              label={labels.maxRisk}
              value={num("maxRiskPercent")}
              onChange={(v) => set({ maxRiskPercent: v })}
              step="0.1"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label={labels.conservativeMax}
              hint={labels.riskLevelsHint}
              value={num("conservativeMaxPercent")}
              onChange={(v) => set({ conservativeMaxPercent: v })}
              step="0.1"
            />
            <NumberField
              label={labels.moderateMax}
              value={num("moderateMaxPercent")}
              onChange={(v) => set({ moderateMaxPercent: v })}
              step="0.1"
            />
            <NumberField
              label={labels.minRecommendedRatio}
              hint={labels.minRecommendedRatioHint}
              value={num("minRecommendedRatio")}
              onChange={(v) => set({ minRecommendedRatio: v })}
              step="0.1"
            />
          </div>
          {pairAndCurrencyPickers}
        </div>
      );

    case "position-size":
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={labels.defaultAccountCurrency}>
              <AdminCombobox
                value={str("defaultAccountCurrency")}
                onValueChange={(v) => set({ defaultAccountCurrency: v })}
                options={currencyCodes}
              />
            </Field>
            <Field label={labels.defaultPair}>
              <AdminCombobox
                value={str("defaultPairId")}
                onValueChange={(v) => set({ defaultPairId: v || null })}
                options={instrumentOptions}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label={labels.defaultRisk}
              value={num("defaultRiskPercent")}
              onChange={(v) => set({ defaultRiskPercent: v })}
              step="0.1"
            />
            <NumberField
              label={labels.minRisk}
              value={num("minRiskPercent")}
              onChange={(v) => set({ minRiskPercent: v })}
              step="0.1"
            />
            <NumberField
              label={labels.maxRisk}
              value={num("maxRiskPercent")}
              onChange={(v) => set({ maxRiskPercent: v })}
              step="0.1"
            />
          </div>
          <InstrumentPicker
            label={labels.pairs}
            options={pairs}
            value={arr("pairIds")}
            onChange={(v) => set({ pairIds: v })}
            labels={labels}
          />
          <InstrumentPicker
            label={labels.accountCurrencies}
            options={currencies}
            value={arr("accountCurrencyIds")}
            onChange={(v) => set({ accountCurrencyIds: v })}
            labels={labels}
          />
        </div>
      );

    case "pip-value":
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={labels.defaultAccountCurrency}>
              <AdminCombobox
                value={str("defaultAccountCurrency")}
                onValueChange={(v) => set({ defaultAccountCurrency: v })}
                options={currencyCodes}
              />
            </Field>
            <Field label={labels.defaultPair}>
              <AdminCombobox
                value={str("defaultPairId")}
                onValueChange={(v) => set({ defaultPairId: v || null })}
                options={instrumentOptions}
              />
            </Field>
            <NumberField
              label={labels.defaultUnits}
              value={num("defaultUnits")}
              onChange={(v) => set({ defaultUnits: v })}
            />
          </div>
          <InstrumentPicker
            label={labels.pairs}
            options={pairs}
            value={arr("pairIds")}
            onChange={(v) => set({ pairIds: v })}
            labels={labels}
          />
          <InstrumentPicker
            label={labels.accountCurrencies}
            options={currencies}
            value={arr("accountCurrencyIds")}
            onChange={(v) => set({ accountCurrencyIds: v })}
            labels={labels}
          />
        </div>
      );

    case "gain-loss":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label={labels.defaultStartBalance}
            value={num("defaultStartBalance")}
            onChange={(v) => set({ defaultStartBalance: v })}
          />
          <NumberField
            label={labels.decimals}
            value={num("decimals")}
            onChange={(v) => set({ decimals: v })}
          />
        </div>
      );

    case "pivot-points":
      return (
        <div className="flex flex-col gap-4">
          <EnumPicker
            label={labels.intervals}
            options={PIVOT_INTERVALS}
            value={arr("intervals")}
            onChange={(v) => set({ intervals: v })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={labels.defaultInterval}>
              <AdminCombobox
                value={str("defaultInterval")}
                onValueChange={(v) => set({ defaultInterval: v })}
                options={PIVOT_INTERVALS.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label={labels.defaultSymbol}>
              <AdminCombobox
                value={str("defaultSymbolId")}
                onValueChange={(v) => set({ defaultSymbolId: v || null })}
                options={defaultSymbolOptions}
              />
            </Field>
          </div>
          <InstrumentPicker
            label={labels.symbols}
            options={instruments}
            value={arr("symbolIds")}
            // The default must be one of the offered symbols. Unticking it
            // (or clearing the list) drops the default rather than leaving a
            // saved default the public picker does not list.
            onChange={(v) =>
              set({
                symbolIds: v,
                ...(str("defaultSymbolId") && !v.includes(str("defaultSymbolId"))
                  ? { defaultSymbolId: null }
                  : {}),
              })
            }
            labels={labels}
          />
        </div>
      );

    case "market-hours": {
      const sessions = Array.isArray(config.sessions)
        ? (config.sessions as Record<string, string>[])
        : [];
      const patchSession = (index: number, patch: Record<string, string>) =>
        set({ sessions: sessions.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
      return (
        <div className="flex flex-col gap-4">
          <Field label={labels.sessions}>
            <div className="flex flex-col gap-3">
              {sessions.map((session, index) => (
                // Index keys are correct here and only here: the rows have no
                // id, and reordering is not offered — add and remove are the
                // only mutations, and remove rebuilds the list.
                <div
                  key={index}
                  className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-6"
                >
                  <Input
                    aria-label={labels.sessionName}
                    placeholder={labels.sessionName}
                    value={session.name ?? ""}
                    onChange={(e) => patchSession(index, { name: e.target.value })}
                  />
                  <Input
                    aria-label={labels.sessionCity}
                    placeholder={labels.sessionCity}
                    value={session.city ?? ""}
                    onChange={(e) => patchSession(index, { city: e.target.value })}
                  />
                  <Input
                    aria-label={labels.sessionZone}
                    placeholder="Europe/London"
                    className="sm:col-span-2"
                    value={session.timeZone ?? ""}
                    onChange={(e) => patchSession(index, { timeZone: e.target.value })}
                  />
                  <Input
                    aria-label={labels.sessionOpen}
                    placeholder="08:00"
                    value={session.open ?? ""}
                    onChange={(e) => patchSession(index, { open: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={labels.sessionClose}
                      placeholder="17:00"
                      value={session.close ?? ""}
                      onChange={(e) => patchSession(index, { close: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={labels.removeSession}
                      onClick={() => set({ sessions: sessions.filter((_, i) => i !== index) })}
                    >
                      <Trash2 aria-hidden className="text-destructive-interactive" />
                    </Button>
                  </div>
                </div>
              ))}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      sessions: [
                        ...sessions,
                        { name: "", city: "", timeZone: "UTC", open: "08:00", close: "17:00" },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden data-icon="inline-start" />
                  {labels.addSession}
                </Button>
              </div>
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label={labels.mediumVolumeFrom}
              value={num("mediumVolumeFrom")}
              onChange={(v) => set({ mediumVolumeFrom: v })}
            />
            <NumberField
              label={labels.highVolumeFrom}
              value={num("highVolumeFrom")}
              onChange={(v) => set({ highVolumeFrom: v })}
            />
          </div>
        </div>
      );
    }

    case "currency-converter": {
      const markups = (config.rateMarkups ?? {}) as Record<string, number>;
      const offered = arr("offeredRateTypes");
      return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label={labels.defaultFrom}>
              <AdminCombobox
                value={str("defaultFrom")}
                onValueChange={(v) => set({ defaultFrom: v })}
                options={currencyCodes}
              />
            </Field>
            <Field label={labels.defaultTo}>
              <AdminCombobox
                value={str("defaultTo")}
                onValueChange={(v) => set({ defaultTo: v })}
                options={currencyCodes}
              />
            </Field>
            <NumberField
              label={labels.defaultAmount}
              value={num("defaultAmount")}
              onChange={(v) => set({ defaultAmount: v })}
            />
            <NumberField
              label={labels.decimals}
              value={num("decimals")}
              onChange={(v) => set({ decimals: v })}
            />
          </div>
          <Field label={labels.rateMarkups} hint={labels.rateMarkupsHint}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {(["bank", "atm", "card", "kiosk"] as const).map((kind) => (
                <UiField key={kind}>
                  <FieldLabel className="font-normal">{humanizeKey(kind)} %</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    value={markups[kind] ?? ""}
                    onChange={(e) =>
                      set({ rateMarkups: { ...markups, [kind]: Number(e.target.value) } })
                    }
                  />
                </UiField>
              ))}
            </div>
          </Field>
          <EnumPicker
            label={labels.offeredRateTypes}
            options={["market", "bank", "atm", "card", "kiosk"]}
            value={offered}
            onChange={(v) => set({ offeredRateTypes: v })}
          />
          <InstrumentPicker
            label={labels.currencies}
            options={currencies}
            value={arr("currencyIds")}
            onChange={(v) => set({ currencyIds: v })}
            labels={labels}
          />
        </div>
      );
    }

    case "correlation":
      return (
        <div className="flex flex-col gap-4">
          <EnumPicker
            label={labels.windows}
            options={CORRELATION_WINDOWS}
            value={arr("windows")}
            onChange={(v) => set({ windows: v })}
          />
          <Field label={labels.defaultWindow}>
            <AdminCombobox
              value={str("defaultWindow")}
              onValueChange={(v) => set({ defaultWindow: v })}
              options={CORRELATION_WINDOWS.map((value) => ({ value, label: value }))}
            />
          </Field>
          <InstrumentPicker
            label={labels.instruments}
            options={instruments}
            value={arr("instrumentIds")}
            onChange={(v) => set({ instrumentIds: v })}
            labels={labels}
          />
        </div>
      );

    case "risk-sentiment": {
      const components = Array.isArray(config.components)
        ? (config.components as Record<string, unknown>[])
        : [];
      const patch = (index: number, value: Record<string, unknown>) =>
        set({ components: components.map((c, i) => (i === index ? { ...c, ...value } : c)) });
      return (
        <div className="flex flex-col gap-4">
          <Field label={labels.components} hint={labels.componentsHint}>
            <div className="flex flex-col gap-2">
              {components.map((component, index) => (
                <div key={index} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-8">
                  <div className="sm:col-span-4">
                    <AdminCombobox
                      aria-label={labels.instruments}
                      value={String(component.instrumentId ?? "")}
                      onValueChange={(v) => patch(index, { instrumentId: v })}
                      options={instrumentOptions}
                    />
                  </div>
                  <Input
                    aria-label={labels.weight}
                    type="number"
                    step="0.5"
                    value={String(component.weight ?? "")}
                    onChange={(e) => patch(index, { weight: Number(e.target.value) })}
                  />
                  <div className="sm:col-span-2">
                    <AdminCombobox
                      aria-label={labels.direction}
                      value={String(component.direction ?? "risk-on")}
                      onValueChange={(v) => patch(index, { direction: v })}
                      options={RISK_DIRECTIONS.map((value) => ({
                        value,
                        label: humanizeKey(value),
                      }))}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.removeComponent}
                    onClick={() => set({ components: components.filter((_, i) => i !== index) })}
                  >
                    <Trash2 aria-hidden className="text-destructive-interactive" />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      components: [
                        ...components,
                        { instrumentId: "", weight: 1, direction: "risk-on" },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden data-icon="inline-start" />
                  {labels.addComponent}
                </Button>
              </div>
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label={labels.lookbackDays}
              value={num("lookbackDays")}
              onChange={(v) => set({ lookbackDays: v })}
            />
            <NumberField
              label={labels.riskOffBelow}
              value={num("riskOffBelow")}
              onChange={(v) => set({ riskOffBelow: v })}
            />
            <NumberField
              label={labels.riskOnAbove}
              value={num("riskOnAbove")}
              onChange={(v) => set({ riskOnAbove: v })}
            />
          </div>
        </div>
      );
    }
  }
}
