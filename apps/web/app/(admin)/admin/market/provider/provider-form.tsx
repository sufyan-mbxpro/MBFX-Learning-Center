"use client";

// The provider form (changes-25 T4, ADR-087 #5).
//
// **The API key field is write-only and renders EMPTY over a stored key.** The
// placeholder says which of the two states it is in, because an empty box with
// no caption cannot distinguish "no key saved" from "a key is saved and we
// will not show it to you" — and the difference decides whether leaving it
// alone is safe. Blank means UNCHANGED; the contract says so, the service
// implements it, and an integration test pins it.
import { useState } from "react";
import { AlertTriangle, Info, Plug } from "lucide-react";
import { MARKET_DRIVERS, marketProviderSchema } from "@repo/contracts";
import type { ProviderTestResult } from "@repo/core";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import { Switch } from "@repo/ui/components/switch";
import { humanizeKey } from "@repo/utils";
import { saveMarketProviderAction, testMarketProviderAction } from "../../_actions/market-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { AdminSection } from "../../_components/admin-page.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface ProviderFormLabels {
  driverField: string;
  driverHint: string;
  baseUrlField: string;
  apiKeyField: string;
  apiKeySaved: string;
  apiKeyEmpty: string;
  showKey: string;
  hideKey: string;
  refreshField: string;
  refreshHint: string;
  staleField: string;
  staleHint: string;
  enabledField: string;
  enabledHint: string;
  save: string;
  saved: string;
  testTitle: string;
  testDescription: string;
  testSymbolField: string;
  testAction: string;
  testOk: string;
  testFailed: string;
  connectionTitle: string;
  statusTitle: string;
  lastSync: string;
  lastSyncNever: string;
  lastError: string;
  noError: string;
  secretKeyMissingTitle: string;
  secretKeyMissingBody: string;
  manualTitle: string;
  manualBody: string;
}

export interface ProviderView {
  driver: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  refreshSeconds: number;
  staleSeconds: number;
  isEnabled: boolean;
  lastSyncLabel: string | null;
  lastSyncError: string | null;
  hasSecretKey: boolean;
}

export function ProviderForm({
  provider,
  labels,
}: {
  provider: ProviderView;
  labels: ProviderFormLabels;
}) {
  const { run, pending } = useServerAction();

  const [driver, setDriver] = useState(provider.driver);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [refreshSeconds, setRefreshSeconds] = useState(String(provider.refreshSeconds));
  const [staleSeconds, setStaleSeconds] = useState(String(provider.staleSeconds));
  const [isEnabled, setIsEnabled] = useState(provider.isEnabled);

  const [testSymbol, setTestSymbol] = useState("EUR/USD");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);

  const values = {
    driver,
    baseUrl: baseUrl || null,
    // Blank is omitted rather than sent as "": the schema's `apiKey` is
    // optional, and the service reads "absent or empty" as unchanged.
    ...(apiKey ? { apiKey } : {}),
    refreshSeconds: Number(refreshSeconds),
    staleSeconds: Number(staleSeconds),
    isEnabled,
  };

  const form = useFieldErrors(marketProviderSchema, values);

  const save = () => {
    if (!form.validate()) return;
    run(() => saveMarketProviderAction(values), {
      successMessage: labels.saved,
      // The field goes back to empty after a save, because that is what it
      // means: there is now a stored key, and this box is not it.
      onDone: () => setApiKey(""),
    });
  };

  const test = async () => {
    setTesting(true);
    try {
      setTestResult(await testMarketProviderAction(testSymbol));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Without MARKET_SECRET_KEY a stored key cannot be opened, so saving
          one is worse than useless — it looks like it worked. Said before the
          form rather than after a failed sync. */}
      {!provider.hasSecretKey && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>{labels.secretKeyMissingTitle}</AlertTitle>
          <AlertDescription>{labels.secretKeyMissingBody}</AlertDescription>
        </Alert>
      )}

      {driver === "MANUAL" && (
        <Alert variant="info">
          <Info aria-hidden />
          <AlertTitle>{labels.manualTitle}</AlertTitle>
          <AlertDescription>{labels.manualBody}</AlertDescription>
        </Alert>
      )}

      <AdminSection title={labels.connectionTitle}>
        <FieldGroup>
          <Field required>
            <FieldLabel>{labels.driverField}</FieldLabel>
            <AdminCombobox
              value={driver}
              onValueChange={setDriver}
              options={MARKET_DRIVERS.map((value) => ({ value, label: humanizeKey(value) }))}
            />
            <FieldDescription>{labels.driverHint}</FieldDescription>
          </Field>

          <Field invalid={form.invalid("baseUrl")}>
            <FieldLabel>{labels.baseUrlField}</FieldLabel>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://www.alphavantage.co"
            />
            <FieldError>{form.error("baseUrl")}</FieldError>
          </Field>

          <Field invalid={form.invalid("apiKey")}>
            <FieldLabel>{labels.apiKeyField}</FieldLabel>
            {/* PasswordInput, never a bare masked input: it owns the input
                type because it is what swaps it, and a credential you cannot
                reveal is one you cannot check before saving. */}
            <PasswordInput
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              // The placeholder is the whole difference between "nothing is
              // saved" and "something is saved and blank leaves it alone".
              placeholder={provider.hasApiKey ? labels.apiKeySaved : labels.apiKeyEmpty}
              // A credential read character by character keeps font-mono
              // (code-style.md #6's narrow exception).
              className="font-mono"
              showLabel={labels.showKey}
              hideLabel={labels.hideKey}
            />
            <FieldError>{form.error("apiKey")}</FieldError>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field required invalid={form.invalid("refreshSeconds")}>
              <FieldLabel>{labels.refreshField}</FieldLabel>
              <Input
                type="number"
                value={refreshSeconds}
                onChange={(event) => setRefreshSeconds(event.target.value)}
              />
              <FieldDescription>{labels.refreshHint}</FieldDescription>
              <FieldError>{form.error("refreshSeconds")}</FieldError>
            </Field>
            <Field required invalid={form.invalid("staleSeconds")}>
              <FieldLabel>{labels.staleField}</FieldLabel>
              <Input
                type="number"
                value={staleSeconds}
                onChange={(event) => setStaleSeconds(event.target.value)}
              />
              <FieldDescription>{labels.staleHint}</FieldDescription>
              <FieldError>{form.error("staleSeconds")}</FieldError>
            </Field>
          </div>

          <Field orientation="horizontal">
            <FieldLabel>{labels.enabledField}</FieldLabel>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            <FieldDescription>{labels.enabledHint}</FieldDescription>
          </Field>
        </FieldGroup>

        {/* Save sits at the inline END of its section (ADR-044 #8). */}
        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {labels.save}
          </Button>
        </div>
      </AdminSection>

      <AdminSection title={labels.testTitle}>
        <p className="text-sm text-muted-foreground">{labels.testDescription}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-48">
            <FieldLabel>{labels.testSymbolField}</FieldLabel>
            <Input value={testSymbol} onChange={(event) => setTestSymbol(event.target.value)} />
          </Field>
          <Button variant="outline" onClick={test} disabled={testing}>
            <Plug aria-hidden data-icon="inline-start" />
            {labels.testAction}
          </Button>
        </div>

        {testResult && (
          <Alert variant={testResult.ok ? "success" : "destructive"}>
            <AlertTitle>{testResult.ok ? labels.testOk : labels.testFailed}</AlertTitle>
            <AlertDescription>
              {testResult.ok
                ? `${testResult.symbol} · ${testResult.bars} bars · ${testResult.latencyMs}ms`
                : testResult.error}
            </AlertDescription>
          </Alert>
        )}
      </AdminSection>

      <AdminSection title={labels.statusTitle}>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{labels.lastSync}</dt>
            <dd>{provider.lastSyncLabel ?? labels.lastSyncNever}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{labels.lastError}</dt>
            {/* The screen that shows the error is the screen that can fix it. */}
            <dd className={provider.lastSyncError ? "text-destructive-interactive" : undefined}>
              {provider.lastSyncError ?? labels.noError}
            </dd>
          </div>
        </dl>
      </AdminSection>
    </div>
  );
}
