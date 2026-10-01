"use client";

// Settings → Translation (ADR-160): switch automatic translation on or off,
// enter the Google Cloud Translation key, and set the price and the monthly
// character budget.
//
// The reCAPTCHA tab's three properties, applied to this key:
//
//   1. **The key is write-only.** It arrives as `hasApiKey`, never as a
//      value, and a blank field means "keep the saved one".
//   2. **Switching on is proved.** The server runs a test translation with
//      the key being saved and refuses to switch on if it fails.
//   3. **A refusal says why**, from the reason taxonomy, never Google's own
//      message.
import * as React from "react";
import { Languages } from "lucide-react";
import { translateSettingsSaveSchema } from "@repo/contracts";
import type { TranslateSettingsRefusal, TranslateSettingsView } from "@repo/translate";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Field as SwitchRow,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import { Switch } from "@repo/ui/components/switch";
import { formatDateTime } from "@repo/utils";
import { EditorSection, Field } from "../../../../_components/editor/editor-section.tsx";
import { useFieldErrors } from "../../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";
import {
  saveTranslateSettingsAction,
  testTranslateConnectionAction,
} from "../../../../_actions/translate-actions.ts";

export interface TranslateSettingsLabels {
  section: string;
  sectionDescription: string;
  enabled: string;
  enabledHint: string;
  apiKey: string;
  apiKeyHint: string;
  apiKeySaved: string;
  showKey: string;
  hideKey: string;
  price: string;
  priceHint: string;
  budget: string;
  budgetHint: string;
  save: string;
  saved: string;
  test: string;
  testOk: string;
  lastTested: string;
  never: string;
  usageTitle: string;
  usageDescription: string;
  usageCharacters: string;
  usageCost: string;
  usageRequests: string;
  usageRemaining: string;
  noBudget: string;
  sealKeyMissingTitle: string;
  sealKeyMissingBody: string;
  refusals: Record<TranslateSettingsRefusal, string>;
  /** A stored test result ("ok" or a reason) as words. */
  results: Record<string, string>;
}

/** A number field's text as the schema's value: blank is null, junk is NaN. */
function numberOrNull(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
}

export function TranslateSettingsForm({
  settings,
  labels,
}: {
  settings: TranslateSettingsView;
  labels: TranslateSettingsLabels;
}) {
  const save = useServerAction();
  const test = useServerAction();
  const [enabled, setEnabled] = React.useState(settings.enabled);
  const [apiKey, setApiKey] = React.useState("");
  const [price, setPrice] = React.useState(String(settings.pricePerMillionChars));
  const [budget, setBudget] = React.useState(
    settings.monthlyCharBudget === null ? "" : String(settings.monthlyCharBudget),
  );

  const values = React.useMemo(
    () => ({
      enabled,
      apiKey: apiKey || undefined,
      pricePerMillionChars: numberOrNull(price) ?? Number.NaN,
      monthlyCharBudget: numberOrNull(budget),
    }),
    [enabled, apiKey, price, budget],
  );
  const form = useFieldErrors(translateSettingsSaveSchema, values);

  const refusal = (reason: TranslateSettingsRefusal) =>
    labels.refusals[reason] ?? labels.refusals.network_error;

  const onSave = () => {
    if (!form.validate()) return;
    save.run(
      async () => {
        const result = await saveTranslateSettingsAction(values);
        if (!result.ok) throw new Error(refusal(result.reason));
      },
      {
        successMessage: labels.saved,
        onDone: () => {
          setApiKey("");
          form.reset();
        },
      },
    );
  };

  const onTest = () => {
    test.run(
      async () => {
        const result = await testTranslateConnectionAction({ apiKey: apiKey || undefined });
        if (!result.ok) throw new Error(refusal(result.reason));
      },
      { successMessage: labels.testOk },
    );
  };

  const remaining =
    settings.monthlyCharBudget === null
      ? labels.noBudget
      : Math.max(0, settings.monthlyCharBudget - settings.usage.characters).toLocaleString();

  return (
    <div className="flex flex-col gap-6">
      <EditorSection
        title={labels.section}
        description={labels.sectionDescription}
        icon={Languages}
        accent="warning"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" loading={test.pending} onClick={onTest}>
              {labels.test}
            </Button>
            <Button type="button" loading={save.pending} onClick={onSave}>
              {labels.save}
            </Button>
          </div>
        }
      >
        {/* The key is sealed under an env-only key (security.md #10). Without
            it a key cannot be saved, so translation cannot be switched on. */}
        {!settings.sealKeyPresent && (
          <Alert variant="warning">
            <AlertTitle>{labels.sealKeyMissingTitle}</AlertTitle>
            <AlertDescription>{labels.sealKeyMissingBody}</AlertDescription>
          </Alert>
        )}

        <SwitchRow orientation="horizontal">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <FieldContent>
            <FieldLabel>{labels.enabled}</FieldLabel>
            <FieldDescription>{labels.enabledHint}</FieldDescription>
          </FieldContent>
        </SwitchRow>

        <Field
          label={labels.apiKey}
          hint={settings.hasApiKey ? labels.apiKeySaved : labels.apiKeyHint}
          required={enabled && !settings.hasApiKey}
          error={form.error("apiKey")}
        >
          <PasswordInput
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            // Never the browser's saved credential: this is Google's key.
            autoComplete="new-password"
            spellCheck={false}
            showLabel={labels.showKey}
            hideLabel={labels.hideKey}
          />
        </Field>

        <Field
          label={labels.price}
          hint={labels.priceHint}
          required
          error={form.error("pricePerMillionChars")}
        >
          <Input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>

        <Field
          label={labels.budget}
          hint={labels.budgetHint}
          error={form.error("monthlyCharBudget")}
        >
          <Input
            inputMode="numeric"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          />
        </Field>

        <dl className="flex gap-1.5 text-xs text-muted-foreground">
          <dt>{labels.lastTested}</dt>
          <dd className="text-foreground">
            {settings.lastTestedAt
              ? `${formatDateTime(settings.lastTestedAt)} · ${
                  labels.results[settings.lastTestResult ?? ""] ?? settings.lastTestResult
                }`
              : labels.never}
          </dd>
        </dl>
      </EditorSection>

      <EditorSection title={labels.usageTitle} description={labels.usageDescription}>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{labels.usageCharacters}</dt>
            <dd className="font-medium">{settings.usage.characters.toLocaleString()}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{labels.usageCost}</dt>
            <dd className="font-medium">${Number(settings.usage.costUsd).toFixed(2)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{labels.usageRequests}</dt>
            <dd className="font-medium">{settings.usage.requests.toLocaleString()}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{labels.usageRemaining}</dt>
            <dd className="font-medium">{remaining}</dd>
          </div>
        </dl>
      </EditorSection>
    </div>
  );
}
