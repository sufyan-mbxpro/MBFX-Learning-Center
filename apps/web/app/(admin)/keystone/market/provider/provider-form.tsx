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
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Plug, RefreshCw } from "lucide-react";
import {
  MARKET_DRIVERS,
  MARKET_REFRESH_CHOICES,
  MARKET_STALE_CHOICES,
  marketProviderSchema,
} from "@repo/contracts";
import type { ProviderTestResult, SyncResult } from "@repo/core";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import { Switch } from "@repo/ui/components/switch";
import { formatDurationSeconds, humanizeKey } from "@repo/utils";
import {
  saveMarketProviderAction,
  syncMarketDataAction,
  testMarketProviderAction,
} from "../../_actions/market-actions.ts";
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
  syncTitle: string;
  syncDescription: string;
  syncAction: string;
  syncRunning: string;
  syncDone: string;
  syncPartial: string;
  syncAttempted: string;
  syncSynced: string;
  syncBars: string;
  syncSkipped: string;
  syncFailuresLabel: string;
  syncUnsupportedLabel: string;
  nextDue: string;
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
  /** Already resolved by the page — which of the four things to say is state. */
  nextDueLabel: string;
}

/**
 * The picker's options, with the STORED value folded in if it is not one of
 * them. A row written before this list existed — or by a future list — must
 * still round-trip: an option set that quietly drops the current value turns
 * "I came here to change the base URL" into "I also changed the refresh
 * interval to whatever was first in the list".
 */
function intervalOptions(choices: readonly number[], current: string) {
  const seconds = Number(current);
  const values = [...choices];
  if (Number.isFinite(seconds) && seconds > 0 && !values.includes(seconds)) {
    values.push(seconds);
    values.sort((a, b) => a - b);
  }
  return values.map((value) => ({
    value: String(value),
    label: formatDurationSeconds(value),
  }));
}

/** Failed symbols keyed by their error, in the order each reason first appeared. */
function groupFailures(failures: SyncResult["failures"]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const { symbol, error } of failures) {
    groups.set(error, [...(groups.get(error) ?? []), symbol]);
  }
  return [...groups];
}

export function ProviderForm({
  provider,
  labels,
}: {
  provider: ProviderView;
  labels: ProviderFormLabels;
}) {
  const { run, pending } = useServerAction();
  const router = useRouter();

  const [driver, setDriver] = useState(provider.driver);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [refreshSeconds, setRefreshSeconds] = useState(String(provider.refreshSeconds));
  const [staleSeconds, setStaleSeconds] = useState(String(provider.staleSeconds));
  const [isEnabled, setIsEnabled] = useState(provider.isEnabled);

  const [testSymbol, setTestSymbol] = useState("EUR/USD");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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

  /**
   * Not `run()` from useServerAction: this reports a RESULT, and a toast that
   * says "done" over a sweep that failed on nine of twenty-eight instruments
   * would be the wrong summary. Same shape as the test button beside it.
   */
  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      setSyncResult(await syncMarketDataAction());
      // The status block above is server-rendered from `lastSyncAt`, so the
      // page has to re-read for "Last run" to stop saying "Never run".
      router.refresh();
    } catch (error) {
      setSyncResult(null);
      setSyncError(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
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
            {/* Durations, not a seconds box. Both are stored in seconds and both
                are chosen in the units people say them in — an admin picking a
                daily refresh should not have to know that a day is 86400. */}
            <Field required invalid={form.invalid("refreshSeconds")}>
              <FieldLabel>{labels.refreshField}</FieldLabel>
              <AdminCombobox
                value={refreshSeconds}
                onValueChange={setRefreshSeconds}
                options={intervalOptions(MARKET_REFRESH_CHOICES, refreshSeconds)}
              />
              <FieldDescription>{labels.refreshHint}</FieldDescription>
              <FieldError>{form.error("refreshSeconds")}</FieldError>
            </Field>
            <Field required invalid={form.invalid("staleSeconds")}>
              <FieldLabel>{labels.staleField}</FieldLabel>
              <AdminCombobox
                value={staleSeconds}
                onValueChange={setStaleSeconds}
                options={intervalOptions(MARKET_STALE_CHOICES, staleSeconds)}
              />
              <FieldDescription>{labels.staleHint}</FieldDescription>
              <FieldError>{form.error("staleSeconds")}</FieldError>
            </Field>
          </div>

          {/* Switch first, then its label and hint (ADR-089). The two texts
              stack in a FieldContent so the hint sits under the label rather
              than after it on the same row. */}
          <Field orientation="horizontal">
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            <FieldContent>
              <FieldLabel>{labels.enabledField}</FieldLabel>
              <FieldDescription>{labels.enabledHint}</FieldDescription>
            </FieldContent>
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

      {/* Sync (ADR-096 #3). Between the test and the status block on purpose:
          the test proves the credential, this spends it, and the block below
          records what happened. */}
      <AdminSection title={labels.syncTitle}>
        <p className="text-sm text-muted-foreground">{labels.syncDescription}</p>
        <div className="flex justify-end">
          <Button onClick={sync} disabled={syncing}>
            <RefreshCw aria-hidden data-icon="inline-start" />
            {syncing ? labels.syncRunning : labels.syncAction}
          </Button>
        </div>

        {syncError && (
          <Alert variant="destructive">
            <AlertTitle>{labels.syncPartial}</AlertTitle>
            <AlertDescription>{syncError}</AlertDescription>
          </Alert>
        )}

        {syncResult && (
          // A free tier that runs out mid-sweep is the EXPECTED case, not an
          // exception — so a run with failures is "finished with failures",
          // not "failed". The staleness rotation (ADR-087 #9) puts whatever
          // was missed at the front of the next run, which is only reassuring
          // if the numbers are visible.
          <Alert variant={syncResult.failures.length > 0 ? "warning" : "success"}>
            <AlertTitle>
              {syncResult.failures.length > 0 ? labels.syncPartial : labels.syncDone}
            </AlertTitle>
            {/* One fact per paragraph: the description is a plain block, so
                sibling spans ran together as "Skipped: 0Failed: …". */}
            <AlertDescription>
              <p>
                {labels.syncAttempted}: {syncResult.attempted} · {labels.syncSynced}:{" "}
                {syncResult.synced} · {labels.syncBars}: {syncResult.barsWritten} ·{" "}
                {labels.syncSkipped}: {syncResult.skipped}
              </p>
              {/* Grouped by reason, because "rate-limited" and "rejected" call
                  for different things and a bare symbol list said neither. */}
              {groupFailures(syncResult.failures).map(([reason, symbols]) => (
                <p key={reason}>
                  {labels.syncFailuresLabel} ({reason}): {symbols.join(", ")}
                </p>
              ))}
              {/* Not a failure, so it does not turn the alert amber: a retry
                  changes nothing. Named so the admin can switch the rows off. */}
              {syncResult.unsupported.length > 0 && (
                <p>
                  {labels.syncUnsupportedLabel}: {syncResult.unsupported.join(", ")}
                </p>
              )}
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
            <dt className="text-muted-foreground">{labels.nextDue}</dt>
            <dd>{provider.nextDueLabel}</dd>
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
