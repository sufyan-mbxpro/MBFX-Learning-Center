"use client";

// Create / edit one instrument (changes-25 T4).
//
// **Base and quote appear only for a PAIR**, which is the one conditional in
// the form and the one refinement in `marketInstrumentSchema`. The two agree
// because they are the same schema: `useFieldErrors` runs what the action
// parses with (ADR-077), so a pair missing a leg fails in the dialog rather
// than as a toast from the server.
//
// **Pip size is an override, not a required field.** Null means "derive it
// from the quote currency" — 0.01 for JPY, 0.0001 otherwise — which is right
// for every ordinary pair and wrong only for the handful that are not.
import { useState } from "react";
import { MARKET_INSTRUMENT_KINDS, marketInstrumentSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { humanizeKey } from "@repo/utils";
import { saveInstrumentAction } from "../_actions/market-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

export interface InstrumentDialogLabels {
  newTitle: string;
  newDescription: string;
  editTitle: string;
  editDescription: string;
  kindField: string;
  symbolField: string;
  symbolHint: string;
  displayNameField: string;
  baseField: string;
  quoteField: string;
  providerSymbolField: string;
  providerSymbolHint: string;
  pipSizeField: string;
  pipSizeHint: string;
  decimalsField: string;
  activeField: string;
  save: string;
  cancel: string;
}

export interface InstrumentDraft {
  id: string;
  kind: string;
  symbol: string;
  displayName: string;
  base: string | null;
  quote: string | null;
  providerSymbol: string | null;
  pipSize: number | null;
  decimals: number;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Mounted only while open — the caller renders it conditionally, so the state
 * below is seeded from props on every open.
 *
 * The alternative was an effect syncing nine pieces of state whenever `open`
 * flipped, which is a cascading render the lint rules refuse
 * (react-hooks/set-state-in-effect) and which they are right to refuse: a
 * remount says "this form is new" once, where the effect says it nine times.
 */
export function InstrumentDialog({
  open,
  onOpenChange,
  instrument,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent for a create. */
  instrument?: InstrumentDraft;
  labels: InstrumentDialogLabels;
}) {
  const { run, pending } = useServerAction();

  const [kind, setKind] = useState(instrument?.kind ?? "PAIR");
  const [symbol, setSymbol] = useState(instrument?.symbol ?? "");
  const [displayName, setDisplayName] = useState(instrument?.displayName ?? "");
  const [base, setBase] = useState(instrument?.base ?? "");
  const [quote, setQuote] = useState(instrument?.quote ?? "");
  const [providerSymbol, setProviderSymbol] = useState(instrument?.providerSymbol ?? "");
  const [pipSize, setPipSize] = useState(instrument?.pipSize?.toString() ?? "");
  const [decimals, setDecimals] = useState(String(instrument?.decimals ?? 5));
  const [isActive, setIsActive] = useState(instrument?.isActive ?? true);

  const isPair = kind === "PAIR";

  const values = {
    id: instrument?.id ?? null,
    kind,
    symbol: symbol.toUpperCase(),
    displayName,
    base: base ? base.toUpperCase() : null,
    quote: quote ? quote.toUpperCase() : null,
    providerSymbol: providerSymbol || null,
    pipSize: pipSize ? Number(pipSize) : null,
    decimals: Number(decimals),
    isActive,
    sortOrder: instrument?.sortOrder ?? 0,
  };

  const form = useFieldErrors(marketInstrumentSchema, values);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) form.reset();
  };

  const save = () => {
    if (!form.validate()) return;
    run(() => saveInstrumentAction(values), { onDone: () => close(false) });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          {/* Title AND description, always (code-style.md #11). */}
          <DialogTitle>{instrument ? labels.editTitle : labels.newTitle}</DialogTitle>
          <DialogDescription>
            {instrument ? labels.editDescription : labels.newDescription}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field required>
            <FieldLabel>{labels.kindField}</FieldLabel>
            <AdminCombobox
              value={kind}
              onValueChange={setKind}
              options={MARKET_INSTRUMENT_KINDS.map((value) => ({
                value,
                label: humanizeKey(value),
              }))}
            />
          </Field>

          <Field required invalid={form.invalid("symbol")}>
            <FieldLabel>{labels.symbolField}</FieldLabel>
            <Input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              placeholder="EUR/USD"
            />
            <FieldDescription>{labels.symbolHint}</FieldDescription>
            <FieldError>{form.error("symbol")}</FieldError>
          </Field>

          <Field required invalid={form.invalid("displayName")}>
            <FieldLabel>{labels.displayNameField}</FieldLabel>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <FieldError>{form.error("displayName")}</FieldError>
          </Field>

          {/* Only a PAIR has legs. Hidden rather than disabled: a disabled
              field on a CURRENCY row would imply it has a base it is simply
              not allowed to set. */}
          {isPair && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field required invalid={form.invalid("base")}>
                <FieldLabel>{labels.baseField}</FieldLabel>
                <Input
                  value={base}
                  onChange={(event) => setBase(event.target.value.toUpperCase())}
                  placeholder="EUR"
                />
                <FieldError>{form.error("base")}</FieldError>
              </Field>
              <Field required invalid={form.invalid("quote")}>
                <FieldLabel>{labels.quoteField}</FieldLabel>
                <Input
                  value={quote}
                  onChange={(event) => setQuote(event.target.value.toUpperCase())}
                  placeholder="USD"
                />
                <FieldError>{form.error("quote")}</FieldError>
              </Field>
            </div>
          )}

          <Field invalid={form.invalid("providerSymbol")}>
            <FieldLabel>{labels.providerSymbolField}</FieldLabel>
            <Input
              value={providerSymbol}
              onChange={(event) => setProviderSymbol(event.target.value)}
            />
            <FieldDescription>{labels.providerSymbolHint}</FieldDescription>
            <FieldError>{form.error("providerSymbol")}</FieldError>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field invalid={form.invalid("pipSize")}>
              <FieldLabel>{labels.pipSizeField}</FieldLabel>
              <Input
                type="number"
                step="0.00001"
                value={pipSize}
                onChange={(event) => setPipSize(event.target.value)}
              />
              <FieldDescription>{labels.pipSizeHint}</FieldDescription>
              <FieldError>{form.error("pipSize")}</FieldError>
            </Field>
            <Field required invalid={form.invalid("decimals")}>
              <FieldLabel>{labels.decimalsField}</FieldLabel>
              <Input
                type="number"
                min={0}
                max={10}
                value={decimals}
                onChange={(event) => setDecimals(event.target.value)}
              />
              <FieldError>{form.error("decimals")}</FieldError>
            </Field>
          </div>

          <Field orientation="horizontal">
            <FieldLabel>{labels.activeField}</FieldLabel>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {labels.cancel}
          </Button>
          {/* Not disabled for validation (ADR-077): pressing it names the
              invalid fields and focuses the first. */}
          <Button onClick={save} disabled={pending}>
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
