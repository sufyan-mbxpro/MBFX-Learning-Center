"use client";

// Budget, limits, and the three model tiers.
//
// Two things this screen says in words rather than leaving to be discovered:
//
//   1. **Changing the budget rewrites the cap for the CURRENT month.** The
//      period copies its cap rather than reading `ai.monthlyBudgetUsd` live, so
//      without this the change would appear to do nothing until the 1st.
//   2. **Changing a tier re-points every feature that falls back to it.** This
//      is the one screen where a cost decision is made once and applies
//      everywhere (ADR-099), so it states the blast radius beside each row.
//
// `variant="usage"` is the same form on `/admin/settings/ai` (ADR-120), which
// sets the tiers together with the models they must name, so this form drops
// its tier section there and saves the limits alone.
import { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { aiLimitsSchema, aiUsageLimitsSchema, type AiCapBehavior } from "@repo/contracts";
import type { AiLimitsView } from "@repo/core";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import {
  resetAiBudgetPeriodAction,
  saveAiLimitsAction,
  saveAiUsageLimitsAction,
} from "../../_actions/ai-actions.ts";
import { AdminSection } from "../../_components/admin-page.tsx";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface LimitsFormLabels {
  section: string;
  enabled: string;
  enabledHint: string;
  budget: string;
  budgetHint: string;
  warn: string;
  warnHint: string;
  capBehavior: string;
  capDisable: string;
  capNotify: string;
  capHint: string;
  maxTokens: string;
  maxTokensHint: string;
  rate: string;
  rateHint: string;
  tiersSection: string;
  tiersDescription: string;
  tierLight: string;
  tierStandard: string;
  tierHeavy: string;
  tierLightHint: string;
  tierStandardHint: string;
  tierHeavyHint: string;
  tierAffectsLight: string;
  tierAffectsStandard: string;
  tierAffectsHeavy: string;
  tierMissing: string;
  save: string;
  saved: string;
  resetTitle: string;
  resetDescription: string;
  resetAction: string;
  resetConfirmTitle: string;
  resetConfirmDescription: string;
  resetDone: string;
  cancel: string;
  budgetCapped: string;
  budgetCappedBody: string;
}

export function LimitsForm({
  limits,
  modelOptions,
  labels,
  variant = "full",
}: {
  limits: AiLimitsView;
  /** Every enabled model's ID string, with its price in the label. */
  modelOptions: { value: string; label: string }[];
  labels: LimitsFormLabels;
  /** `usage` omits the tier section and saves the limits alone. */
  variant?: "full" | "usage";
}) {
  const withTiers = variant === "full";
  const { run, pending } = useServerAction();

  const [enabled, setEnabled] = useState(limits.enabled);
  const [monthlyBudgetUsd, setBudget] = useState(String(limits.monthlyBudgetUsd));
  const [budgetWarnPercent, setWarn] = useState(String(limits.budgetWarnPercent));
  const [capBehavior, setCapBehavior] = useState<string>(limits.capBehavior);
  const [maxTokensPerRequest, setMaxTokens] = useState(String(limits.maxTokensPerRequest));
  const [rateLimitPerUserHour, setRate] = useState(String(limits.rateLimitPerUserHour));
  const [modelLight, setLight] = useState(limits.tiers.light);
  const [modelStandard, setStandard] = useState(limits.tiers.standard);
  const [modelHeavy, setHeavy] = useState(limits.tiers.heavy);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const values = {
    enabled,
    maxTokensPerRequest: Number(maxTokensPerRequest),
    monthlyBudgetUsd: Number(monthlyBudgetUsd),
    budgetWarnPercent: Number(budgetWarnPercent),
    capBehavior: capBehavior as AiCapBehavior,
    rateLimitPerUserHour: Number(rateLimitPerUserHour),
    modelLight,
    modelStandard,
    modelHeavy,
  };

  const form = useFieldErrors(withTiers ? aiLimitsSchema : aiUsageLimitsSchema, values);

  const save = () => {
    if (!form.validate()) return;
    run(
      () => {
        if (withTiers) return saveAiLimitsAction(values);
        const { modelLight: _l, modelStandard: _s, modelHeavy: _h, ...usage } = values;
        return saveAiUsageLimitsAction(usage);
      },
      { successMessage: labels.saved },
    );
  };

  const reset = () => {
    run(() => resetAiBudgetPeriodAction(), {
      successMessage: labels.resetDone,
      onDone: () => setConfirmingReset(false),
    });
  };

  /**
   * A tier naming no enabled model still SAVES and still shows the value — the
   * resolver falls through rather than throwing, and a form that silently
   * rewrote the field to a neighbour would be the worse failure (the market
   * interval picker's rule, one screen over).
   */
  const tierOptions = (current: string) =>
    modelOptions.some((option) => option.value === current)
      ? modelOptions
      : [{ value: current, label: `${current} — ${labels.tierMissing}` }, ...modelOptions];

  return (
    <div className="flex flex-col gap-6">
      {limits.budget.status === "capped" && (
        <Alert variant={limits.capBehavior === "DISABLE" ? "destructive" : "warning"}>
          <AlertTriangle aria-hidden />
          <AlertTitle>{labels.budgetCapped}</AlertTitle>
          <AlertDescription>{labels.budgetCappedBody}</AlertDescription>
        </Alert>
      )}

      <AdminSection title={labels.section}>
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <FieldContent>
              <FieldLabel>{labels.enabled}</FieldLabel>
              <FieldDescription>{labels.enabledHint}</FieldDescription>
            </FieldContent>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field required invalid={form.invalid("monthlyBudgetUsd")}>
              <FieldLabel>{labels.budget}</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={monthlyBudgetUsd}
                onChange={(event) => setBudget(event.target.value)}
              />
              <FieldDescription>{labels.budgetHint}</FieldDescription>
              <FieldError>{form.error("monthlyBudgetUsd")}</FieldError>
            </Field>

            <Field required invalid={form.invalid("budgetWarnPercent")}>
              <FieldLabel>{labels.warn}</FieldLabel>
              <Input
                type="number"
                min={1}
                max={100}
                value={budgetWarnPercent}
                onChange={(event) => setWarn(event.target.value)}
              />
              <FieldDescription>{labels.warnHint}</FieldDescription>
              <FieldError>{form.error("budgetWarnPercent")}</FieldError>
            </Field>
          </div>

          <Field required>
            <FieldLabel>{labels.capBehavior}</FieldLabel>
            <AdminCombobox
              value={capBehavior}
              onValueChange={setCapBehavior}
              options={[
                { value: "DISABLE", label: labels.capDisable },
                { value: "NOTIFY_ONLY", label: labels.capNotify },
              ]}
            />
            <FieldDescription>{labels.capHint}</FieldDescription>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field required invalid={form.invalid("maxTokensPerRequest")}>
              <FieldLabel>{labels.maxTokens}</FieldLabel>
              <Input
                type="number"
                min={1}
                value={maxTokensPerRequest}
                onChange={(event) => setMaxTokens(event.target.value)}
              />
              <FieldDescription>{labels.maxTokensHint}</FieldDescription>
              <FieldError>{form.error("maxTokensPerRequest")}</FieldError>
            </Field>

            <Field required invalid={form.invalid("rateLimitPerUserHour")}>
              <FieldLabel>{labels.rate}</FieldLabel>
              <Input
                type="number"
                min={1}
                value={rateLimitPerUserHour}
                onChange={(event) => setRate(event.target.value)}
              />
              <FieldDescription>{labels.rateHint}</FieldDescription>
              <FieldError>{form.error("rateLimitPerUserHour")}</FieldError>
            </Field>
          </div>
        </FieldGroup>

        {!withTiers && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={pending}>
              {labels.save}
            </Button>
          </div>
        )}
      </AdminSection>

      {withTiers && (
        <AdminSection title={labels.tiersSection}>
          <p className="text-sm text-muted-foreground">{labels.tiersDescription}</p>
          <FieldGroup>
            <Field required invalid={form.invalid("modelLight")}>
              <FieldLabel>{labels.tierLight}</FieldLabel>
              <AdminCombobox
                value={modelLight}
                onValueChange={setLight}
                options={tierOptions(modelLight)}
              />
              <FieldDescription>
                {labels.tierLightHint} {labels.tierAffectsLight}
              </FieldDescription>
              <FieldError>{form.error("modelLight")}</FieldError>
            </Field>

            <Field required invalid={form.invalid("modelStandard")}>
              <FieldLabel>{labels.tierStandard}</FieldLabel>
              <AdminCombobox
                value={modelStandard}
                onValueChange={setStandard}
                options={tierOptions(modelStandard)}
              />
              <FieldDescription>
                {labels.tierStandardHint} {labels.tierAffectsStandard}
              </FieldDescription>
              <FieldError>{form.error("modelStandard")}</FieldError>
            </Field>

            <Field required invalid={form.invalid("modelHeavy")}>
              <FieldLabel>{labels.tierHeavy}</FieldLabel>
              <AdminCombobox
                value={modelHeavy}
                onValueChange={setHeavy}
                options={tierOptions(modelHeavy)}
              />
              <FieldDescription>
                {labels.tierHeavyHint} {labels.tierAffectsHeavy}
              </FieldDescription>
              <FieldError>{form.error("modelHeavy")}</FieldError>
            </Field>
          </FieldGroup>

          <div className="flex justify-end">
            <Button onClick={save} disabled={pending}>
              {labels.save}
            </Button>
          </div>
        </AdminSection>
      )}

      <AdminSection title={labels.resetTitle}>
        <p className="text-sm text-muted-foreground">{labels.resetDescription}</p>
        <div className="flex justify-end">
          {/* Destroying something asks first (ADR-044 #7) — and this destroys a
              number the cap is measured against, which is exactly the kind of
              thing somebody does at 3am and regrets. */}
          <Button variant="outline" onClick={() => setConfirmingReset(true)} disabled={pending}>
            <RotateCcw aria-hidden data-icon="inline-start" />
            {labels.resetAction}
          </Button>
        </div>
      </AdminSection>

      <ConfirmDialog
        open={confirmingReset}
        onOpenChange={setConfirmingReset}
        title={labels.resetConfirmTitle}
        description={labels.resetConfirmDescription}
        confirmLabel={labels.resetAction}
        cancelLabel={labels.cancel}
        // Not destructive ink: this clears a COUNTER, not content. The
        // history stays, and the dialog says so.
        destructive={false}
        onConfirm={reset}
      />
    </div>
  );
}
