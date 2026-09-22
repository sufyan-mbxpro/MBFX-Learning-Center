"use client";

// Connect an AI provider in one flow (ADR-120): choose it, give it a key, test
// the connection, pick from the models the PROVIDER lists, save.
//
// Four rules this form keeps, each one a copy of a rule the providers screen
// already follows:
//
//   1. **The key field is write-only and empty over a stored key.** Its
//      placeholder says which of the two states it is in; blank means
//      UNCHANGED (ADR-098).
//   2. **A stored key never crosses vendors.** Switching the dropdown resets
//      the form to THAT kind's row, and the service refuses to reuse a row of
//      another kind — so testing Gemini can never send the Anthropic key.
//   3. **A tier can only name a model this save enables.** Otherwise the
//      resolver falls through to "the default provider's first model" in
//      silence, which is the one way a tier choice must never fail.
//   4. **Prices are not asked for here.** A price the database already holds,
//      or one the provider advertises, is sent along; otherwise the service
//      keeps the stored price or starts at 0. Prices are edited on
//      /keystone/settings/ai/providers.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Plug, XCircle } from "lucide-react";
import {
  AI_MODEL_ROLES,
  AI_PROVIDER_KINDS,
  AI_PROVIDER_PRESETS,
  aiSetupSchema,
  type AiModelRole,
  type AiProviderKindValue,
} from "@repo/contracts";
import type { AiProviderView, AiSetupModelOption, AiSetupStoredModel } from "@repo/core";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
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
import { discoverAiModelsAction, saveAiSetupAction } from "../../../_actions/ai-actions.ts";
import { AdminSection } from "../../../_components/admin-page.tsx";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";

/** A model the form knows about — discovered, stored, or both. */
interface ModelOption {
  modelId: string;
  label: string;
  maxOutputTokens: number | null;
  supportsVision: boolean | null;
  input: number | null;
  output: number | null;
  cached: number | null;
}

type Tiers = Record<AiModelRole, string>;

/** Default output ceiling for a model whose provider does not publish one. */
const FALLBACK_MAX_OUTPUT_TOKENS = 4096;

function fromStored(model: AiSetupStoredModel): ModelOption {
  return {
    modelId: model.modelId,
    label: model.label,
    maxOutputTokens: model.maxOutputTokens,
    supportsVision: model.supportsVision,
    input: model.inputPricePerMTok,
    output: model.outputPricePerMTok,
    cached: model.cachedInputPricePerMTok,
  };
}

function fromDiscovered(model: AiSetupModelOption): ModelOption {
  return {
    modelId: model.modelId,
    label: model.label,
    maxOutputTokens: model.maxOutputTokens,
    supportsVision: model.supportsVision,
    // What this database already charged beats what a gateway advertises: the
    // stored figure is the one an admin has already reconciled.
    input: model.knownInputPricePerMTok ?? model.inputPricePerMTok,
    output: model.knownOutputPricePerMTok ?? model.outputPricePerMTok,
    cached: model.knownCachedInputPricePerMTok,
  };
}

/** The row this form edits for a kind: the default of that kind, else any. */
function providerFor(providers: AiProviderView[], kind: AiProviderKindValue) {
  return (
    providers.find((p) => p.kind === kind && p.isDefault) ?? providers.find((p) => p.kind === kind)
  );
}

export function AiSetupForm({
  providers,
  storedModels,
  tiers: storedTiers,
  hasSecretKey,
}: {
  providers: AiProviderView[];
  storedModels: Record<string, AiSetupStoredModel[]>;
  tiers: Tiers;
  hasSecretKey: boolean;
}) {
  const t = useTranslations("admin.aiSetup");
  const tAi = useTranslations("admin.ai");
  const router = useRouter();
  const { run, pending } = useServerAction();

  const connected = providers.find((p) => p.isDefault && p.isEnabled);
  // Echo is "nothing connected yet", so the form opens on the provider most
  // installs are about to connect rather than on the placeholder.
  const initialKind: AiProviderKindValue =
    connected && connected.kind !== "ECHO" ? connected.kind : "ANTHROPIC";

  /** Everything that belongs to ONE kind, rebuilt whenever the kind changes. */
  const stateFor = (kind: AiProviderKindValue) => {
    const row = providerFor(providers, kind);
    const stored = (row ? (storedModels[row.id] ?? []) : []).map(fromStored);
    const selection = new Set(stored.map((m) => m.modelId));
    const tiers = Object.fromEntries(
      AI_MODEL_ROLES.map((role) => [
        role,
        selection.has(storedTiers[role]) ? storedTiers[role] : "",
      ]),
    ) as Tiers;
    return { row, stored, selection, tiers, baseUrl: row?.baseUrl ?? "" };
  };

  const initial = stateFor(initialKind);
  const [kind, setKind] = useState<AiProviderKindValue>(initialKind);
  // An ID, with the row looked up from props: after a save creates the row,
  // `router.refresh()` brings it (and its `hasApiKey`) back in, and a second
  // save updates it instead of creating another.
  const [rowId, setRowId] = useState<string | null>(initial.row?.id ?? null);
  const row = rowId ? providers.find((p) => p.id === rowId) : undefined;
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [options, setOptions] = useState<ModelOption[]>(initial.stored);
  const [discovered, setDiscovered] = useState(false);
  const [selection, setSelection] = useState(initial.selection);
  const [tiers, setTiers] = useState<Tiers>(initial.tiers);
  const [search, setSearch] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    reason: string | null;
    count: number;
  } | null>(null);
  const [keyMissing, setKeyMissing] = useState(false);

  const preset = AI_PROVIDER_PRESETS[kind];
  const isEcho = preset.protocol === "echo";
  const providerName = tAi(`providerKinds.${kind}`);

  const changeKind = (next: string) => {
    const nextKind = next as AiProviderKindValue;
    const state = stateFor(nextKind);
    setKind(nextKind);
    setRowId(state.row?.id ?? null);
    setApiKey("");
    setBaseUrl(state.baseUrl);
    setOptions(state.stored);
    setDiscovered(false);
    setSelection(state.selection);
    setTiers(state.tiers);
    setSearch("");
    setTestResult(null);
    setKeyMissing(false);
    form.reset();
  };

  // The ticked models, in the order the list shows them.
  const selectedOptions = options.filter((option) => selection.has(option.modelId));

  const values = {
    ...(row ? { providerId: row.id } : {}),
    kind,
    baseUrl: baseUrl || null,
    ...(apiKey ? { apiKey } : {}),
    models: isEcho
      ? []
      : selectedOptions.map((option) => ({
          modelId: option.modelId,
          label: option.label,
          inputPricePerMTok: option.input,
          outputPricePerMTok: option.output,
          cachedInputPricePerMTok: option.cached,
          maxOutputTokens: option.maxOutputTokens ?? FALLBACK_MAX_OUTPUT_TOKENS,
          supportsVision: option.supportsVision ?? false,
        })),
    tiers,
  };

  const form = useFieldErrors(aiSetupSchema, values);

  const needsKey = !isEcho && !apiKey && !row?.hasApiKey;

  const test = async () => {
    if (needsKey) {
      setKeyMissing(true);
      return;
    }
    setTesting(true);
    try {
      const result = await discoverAiModelsAction({
        ...(row ? { providerId: row.id } : {}),
        kind,
        baseUrl: baseUrl || null,
        ...(apiKey ? { apiKey } : {}),
      });
      setTestResult({ ok: result.ok, reason: result.reason, count: result.models.length });
      if (result.ok) {
        // Stored models the provider no longer lists stay visible while they
        // are ticked, so a retired model is un-ticked by a person, not dropped
        // by a list refresh.
        const listed = result.models.map(fromDiscovered);
        const listedIds = new Set(listed.map((m) => m.modelId));
        const kept = options.filter((m) => selection.has(m.modelId) && !listedIds.has(m.modelId));
        setOptions([...kept, ...listed]);
        setDiscovered(true);
        setSelection((current) => {
          const next = new Set(current);
          for (const model of result.models) {
            if (model.isSelected) next.add(model.modelId);
          }
          return next;
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const toggle = (option: ModelOption, checked: boolean) => {
    setSelection((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(option.modelId);
      } else {
        next.delete(option.modelId);
      }
      return next;
    });
    if (!checked) {
      // A tier pointing at an un-ticked model is cleared rather than left to
      // fail validation with no visible cause.
      setTiers(
        (current) =>
          Object.fromEntries(
            AI_MODEL_ROLES.map((role) => [
              role,
              current[role] === option.modelId ? "" : current[role],
            ]),
          ) as Tiers,
      );
    }
  };

  const chooseTier = (role: AiModelRole, modelId: string) => {
    setTiers((current) => ({ ...current, [role]: modelId }));
    // Choosing a model for a tier IS choosing to enable it.
    const option = options.find((m) => m.modelId === modelId);
    if (option && !selection.has(modelId)) toggle(option, true);
  };

  const save = () => {
    const keyOk = !needsKey;
    setKeyMissing(!keyOk);
    const valid = form.validate();
    if (!keyOk || !valid) return;
    run(
      async () => {
        setRowId(await saveAiSetupAction(values));
      },
      {
        successMessage: t("saved"),
        onDone: () => {
          setApiKey("");
          form.reset();
          router.refresh();
        },
      },
    );
  };

  const visibleOptions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (m) => m.modelId.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle),
    );
  }, [options, search]);

  const tierOptions = options.map((m) => ({
    value: m.modelId,
    label: m.label === m.modelId ? m.modelId : `${m.label} · ${m.modelId}`,
  }));

  const tierLabel: Record<AiModelRole, string> = {
    light: tAi("tierLight"),
    standard: tAi("tierStandard"),
    heavy: tAi("tierHeavy"),
  };
  const tierHint: Record<AiModelRole, string> = {
    light: tAi("tierLightHint"),
    standard: tAi("tierStandardHint"),
    heavy: tAi("tierHeavyHint"),
  };

  const tierError = (role: AiModelRole) =>
    form.invalid(`tiers.${role}`)
      ? tiers[role]
        ? t("tierNotSelected")
        : form.error(`tiers.${role}`)
      : undefined;

  const baseUrlHint = preset.baseUrlRequired
    ? t("baseUrlRequiredHint")
    : preset.defaultBaseUrl
      ? t("baseUrlHint", { url: preset.defaultBaseUrl })
      : t("baseUrlHintNone");

  return (
    <div className="flex flex-col gap-6">
      {!hasSecretKey && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>{tAi("providerSecretMissingTitle")}</AlertTitle>
          <AlertDescription>{tAi("providerSecretMissingBody")}</AlertDescription>
        </Alert>
      )}

      <AdminSection title={t("connectionTitle")}>
        <p className="text-sm text-muted-foreground">{t("connectionDescription")}</p>

        <Alert variant={connected && connected.kind !== "ECHO" ? "success" : "info"}>
          <Info aria-hidden />
          <AlertDescription>
            {connected && connected.kind !== "ECHO"
              ? t("currentProvider", { name: connected.label })
              : t("currentProviderNone")}
          </AlertDescription>
        </Alert>

        <FieldGroup>
          <Field required>
            <FieldLabel>{t("kindField")}</FieldLabel>
            <AdminCombobox
              value={kind}
              onValueChange={changeKind}
              searchable={false}
              options={AI_PROVIDER_KINDS.map((value) => ({
                value,
                label: tAi(`providerKinds.${value}`),
              }))}
            />
            <FieldDescription>{t("kindHint")}</FieldDescription>
          </Field>

          {isEcho ? (
            <Alert variant="info">
              <Info aria-hidden />
              <AlertTitle>{t("echoTitle")}</AlertTitle>
              <AlertDescription>{t("echoBody")}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Field required={!row?.hasApiKey} invalid={keyMissing && needsKey}>
                <FieldLabel>{t("apiKeyField", { provider: providerName })}</FieldLabel>
                {/* PasswordInput: a credential you cannot reveal is one you
                    cannot check before saving. */}
                <PasswordInput
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setTestResult(null);
                  }}
                  placeholder={
                    row?.hasApiKey
                      ? t("apiKeySaved")
                      : preset.keyPlaceholder || t("apiKeyEmpty", { provider: providerName })
                  }
                  // Read character by character (code-style.md #6's exception).
                  className="font-mono"
                  showLabel={tAi("providerApiKey")}
                  hideLabel={tAi("providerApiKey")}
                />
                <FieldDescription>
                  {row?.hasApiKey ? t("apiKeySaved") : t("apiKeyEmpty", { provider: providerName })}
                  {preset.consoleUrl && (
                    <>
                      {" "}
                      <a
                        href={preset.consoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary-interactive underline-offset-4 hover:underline"
                      >
                        {t("getKey", { provider: providerName })}
                        <ExternalLink aria-hidden className="size-3" />
                      </a>
                    </>
                  )}
                </FieldDescription>
                <FieldError>{keyMissing && needsKey ? t("apiKeyRequired") : undefined}</FieldError>
              </Field>

              <Field required={preset.baseUrlRequired} invalid={form.invalid("baseUrl")}>
                <FieldLabel>{t("baseUrlField")}</FieldLabel>
                <Input
                  value={baseUrl}
                  onChange={(event) => {
                    setBaseUrl(event.target.value);
                    setTestResult(null);
                  }}
                  placeholder={preset.defaultBaseUrl ?? "https://"}
                />
                <FieldDescription>{baseUrlHint}</FieldDescription>
                <FieldError>{form.error("baseUrl")}</FieldError>
              </Field>
            </>
          )}
        </FieldGroup>

        {!isEcho && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={test} disabled={testing || pending}>
              <Plug aria-hidden data-icon="inline-start" />
              {testing ? t("testRunning") : t("testAction")}
            </Button>
          </div>
        )}

        {testResult && (
          <Alert variant={testResult.ok ? "success" : "destructive"}>
            {testResult.ok ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}
            <AlertTitle>
              {testResult.ok
                ? testResult.count > 0
                  ? t("testOk", { count: testResult.count })
                  : t("testOkEmpty")
                : t("testFailed")}
            </AlertTitle>
            {!testResult.ok && testResult.reason && (
              <AlertDescription>
                {tAi.has(`reasons.${testResult.reason}`)
                  ? tAi(`reasons.${testResult.reason}`)
                  : testResult.reason}
              </AlertDescription>
            )}
          </Alert>
        )}

        {isEcho && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={pending}>
              {t("save")}
            </Button>
          </div>
        )}
      </AdminSection>

      {!isEcho && (
        <AdminSection title={t("modelsTitle")}>
          <p className="text-sm text-muted-foreground">{t("modelsDescription")}</p>

          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("testFirst")}</p>
          ) : (
            <>
              {!discovered && <p className="text-sm text-muted-foreground">{t("retestHint")}</p>}

              <div className="flex flex-wrap items-end justify-between gap-3">
                <Field className="sm:max-w-sm">
                  <FieldLabel className="sr-only">{t("modelsSearch")}</FieldLabel>
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("modelsSearch")}
                  />
                </Field>
                <Badge variant="secondary">
                  {t("modelsSelectedCount", { count: selection.size })}
                </Badge>
              </div>

              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                {visibleOptions.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">{t("modelsNoMatch")}</p>
                ) : (
                  visibleOptions.map((option) => (
                    <Field
                      key={option.modelId}
                      orientation="horizontal"
                      className="rounded-sm px-2 py-1.5 hover:bg-muted"
                    >
                      <Checkbox
                        checked={selection.has(option.modelId)}
                        onCheckedChange={(checked) => toggle(option, checked === true)}
                      />
                      <FieldContent>
                        <FieldLabel className="font-normal">
                          {option.label}
                          {option.label !== option.modelId && (
                            <span className="text-xs text-muted-foreground">{option.modelId}</span>
                          )}
                        </FieldLabel>
                      </FieldContent>
                    </Field>
                  ))
                )}
              </div>
              {form.invalid("models") && (
                <p className="text-sm text-destructive-interactive">{t("modelsRequired")}</p>
              )}
            </>
          )}

          {options.length > 0 && (
            <>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">{t("tiersTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("tiersDescription")}</p>
              </div>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {AI_MODEL_ROLES.map((role) => (
                    <Field key={role} required invalid={form.invalid(`tiers.${role}`)}>
                      <FieldLabel>{tierLabel[role]}</FieldLabel>
                      <AdminCombobox
                        value={tiers[role]}
                        onValueChange={(value) => chooseTier(role, value)}
                        options={tierOptions}
                        placeholder={t("tierPlaceholder")}
                      />
                      <FieldDescription>{tierHint[role]}</FieldDescription>
                      <FieldError>{tierError(role)}</FieldError>
                    </Field>
                  ))}
                </div>
              </FieldGroup>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={pending || testing}>
              {t("save")}
            </Button>
          </div>
        </AdminSection>
      )}
    </div>
  );
}
