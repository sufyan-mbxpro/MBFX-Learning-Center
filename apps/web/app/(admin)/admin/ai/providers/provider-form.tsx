"use client";

// One provider (ADR-098).
//
// **The API key field is write-only and renders EMPTY over a stored key.** The
// placeholder says which of the two states it is in, because an empty box with
// no caption cannot distinguish "no key saved" from "a key is saved and we will
// not show it to you" — and the difference decides whether leaving it alone is
// safe. Blank means UNCHANGED; the contract says so, the service implements it,
// and the integration test pins it.
//
// `provider-form.tsx` in `/admin/market` is the form this copies, down to the
// empty-vs-saved caption. What differs is the gate above it and the warning
// below: this key spends money with no ceiling, and its host receives prompts.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Plug, Trash2 } from "lucide-react";
import { AI_PROVIDER_KINDS, aiProviderSchema } from "@repo/contracts";
import type { AiProviderTestResult } from "@repo/core";
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
import { PasswordInput } from "@repo/ui/components/password-input";
import { Switch } from "@repo/ui/components/switch";
import { humanizeKey } from "@repo/utils";
import {
  deleteAiProviderAction,
  saveAiProviderAction,
  testAiProviderAction,
} from "../../_actions/ai-actions.ts";
import { AdminSection } from "../../_components/admin-page.tsx";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface ProviderFormLabels {
  connectionTitle: string;
  kindField: string;
  labelField: string;
  labelHint: string;
  baseUrlField: string;
  baseUrlHint: string;
  apiKeyField: string;
  apiKeySaved: string;
  apiKeyEmpty: string;
  showKey: string;
  hideKey: string;
  enabledField: string;
  enabledHint: string;
  defaultField: string;
  defaultHint: string;
  save: string;
  saved: string;
  testAction: string;
  testRunning: string;
  testOk: string;
  testFailed: string;
  deleteAction: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteDone: string;
  cancel: string;
  secretMissingTitle: string;
  secretMissingBody: string;
  echoTitle: string;
  echoBody: string;
  /** reason → one catalog string. The taxonomy never renders raw. */
  reasonLabels: Record<string, string>;
}

export interface ProviderFormValue {
  id: string | null;
  kind: string;
  label: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
  isDefault: boolean;
  hasSecretKey: boolean;
}

export function AiProviderForm({
  provider,
  labels,
}: {
  provider: ProviderFormValue;
  labels: ProviderFormLabels;
}) {
  const { run, pending } = useServerAction();
  const router = useRouter();

  const [kind, setKind] = useState(provider.kind);
  const [label, setLabel] = useState(provider.label);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [isEnabled, setIsEnabled] = useState(provider.isEnabled);
  const [isDefault, setIsDefault] = useState(provider.isDefault);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiProviderTestResult | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const values = {
    ...(provider.id ? { id: provider.id } : {}),
    kind: kind as (typeof AI_PROVIDER_KINDS)[number],
    label,
    baseUrl: baseUrl || null,
    // Blank is omitted rather than sent as "": the schema's `apiKey` is
    // optional, and the service reads "absent or empty" as unchanged.
    ...(apiKey ? { apiKey } : {}),
    isEnabled,
    isDefault,
  };

  const form = useFieldErrors(aiProviderSchema, values);

  const save = () => {
    if (!form.validate()) return;
    run(
      async () => {
        const id = await saveAiProviderAction(values);
        if (!provider.id) router.replace(`/admin/ai/providers/${id}`);
      },
      {
        successMessage: labels.saved,
        // The field goes back to empty after a save, because that is what it
        // means: there is now a stored key, and this box is not it.
        onDone: () => setApiKey(""),
      },
    );
  };

  /**
   * Not `run()` from `useServerAction`: this reports a RESULT, and a toast
   * saying "done" over a provider that rejected the key would be the wrong
   * summary. Same shape as the market provider's test button.
   */
  const test = async () => {
    if (!provider.id) return;
    setTesting(true);
    try {
      setTestResult(await testAiProviderAction(provider.id, apiKey || undefined));
      // The list's "last tested" is server-rendered from the row.
      router.refresh();
    } finally {
      setTesting(false);
    }
  };

  const remove = () => {
    if (!provider.id) return;
    run(() => deleteAiProviderAction(provider.id!), {
      successMessage: labels.deleteDone,
      onDone: () => router.push("/admin/ai/providers"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {!provider.hasSecretKey && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>{labels.secretMissingTitle}</AlertTitle>
          <AlertDescription>{labels.secretMissingBody}</AlertDescription>
        </Alert>
      )}

      {kind === "ECHO" && (
        <Alert variant="info">
          <Info aria-hidden />
          <AlertTitle>{labels.echoTitle}</AlertTitle>
          <AlertDescription>{labels.echoBody}</AlertDescription>
        </Alert>
      )}

      <AdminSection title={labels.connectionTitle}>
        <FieldGroup>
          <Field required>
            <FieldLabel>{labels.kindField}</FieldLabel>
            <AdminCombobox
              value={kind}
              onValueChange={setKind}
              options={AI_PROVIDER_KINDS.map((value) => ({
                value,
                label: humanizeKey(value),
              }))}
            />
          </Field>

          <Field required invalid={form.invalid("label")}>
            <FieldLabel>{labels.labelField}</FieldLabel>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
            <FieldDescription>{labels.labelHint}</FieldDescription>
            <FieldError>{form.error("label")}</FieldError>
          </Field>

          {kind !== "ECHO" && (
            <>
              <Field invalid={form.invalid("baseUrl")}>
                <FieldLabel>{labels.baseUrlField}</FieldLabel>
                <Input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://api.anthropic.com"
                />
                <FieldDescription>{labels.baseUrlHint}</FieldDescription>
                <FieldError>{form.error("baseUrl")}</FieldError>
              </Field>

              <Field invalid={form.invalid("apiKey")}>
                <FieldLabel>{labels.apiKeyField}</FieldLabel>
                {/* PasswordInput, never a bare masked input: a credential you
                    cannot reveal is one you cannot check before saving. */}
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
            </>
          )}

          <Field orientation="horizontal">
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            <FieldContent>
              <FieldLabel>{labels.enabledField}</FieldLabel>
              <FieldDescription>{labels.enabledHint}</FieldDescription>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <FieldContent>
              <FieldLabel>{labels.defaultField}</FieldLabel>
              <FieldDescription>{labels.defaultHint}</FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap justify-end gap-2">
          {provider.id && (
            <Button variant="outline" onClick={test} disabled={testing}>
              <Plug aria-hidden data-icon="inline-start" />
              {testing ? labels.testRunning : labels.testAction}
            </Button>
          )}
          <Button onClick={save} disabled={pending}>
            {labels.save}
          </Button>
        </div>

        {testResult && (
          <Alert variant={testResult.ok ? "success" : "destructive"}>
            <AlertTitle>{testResult.ok ? labels.testOk : labels.testFailed}</AlertTitle>
            {!testResult.ok && testResult.reason && (
              <AlertDescription>
                {labels.reasonLabels[testResult.reason] ?? testResult.reason}
              </AlertDescription>
            )}
          </Alert>
        )}
      </AdminSection>

      {provider.id && (
        <div className="flex justify-end">
          {/* Destructive text takes the -interactive ink on both surfaces, and
              so does the glyph beside it: the raw hue is a FILL colour and
              fails 4.5:1 on the dark ground (ADR-077, ADR-018 rule 5). The
              button's own ink covers the icon, so the icon sets none. */}
          <Button
            variant="ghost"
            className="text-destructive-interactive"
            onClick={() => setConfirmingDelete(true)}
            disabled={pending}
          >
            <Trash2 aria-hidden data-icon="inline-start" />
            {labels.deleteAction}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={labels.deleteTitle}
        description={labels.deleteDescription}
        confirmLabel={labels.deleteAction}
        cancelLabel={labels.cancel}
        onConfirm={remove}
      />
    </div>
  );
}
