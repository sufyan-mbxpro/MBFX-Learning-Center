// The provider form's label bundle, built once and shared by the `new` and
// `[id]` screens. A second copy of thirty `t()` calls is a second place for one
// of them to be forgotten.
import { AI_PROVIDER_KINDS } from "@repo/contracts";
import type { ProviderFormLabels } from "./provider-form.tsx";

/**
 * Structurally what `getTranslations()` returns, narrowed to what this file
 * uses. Typed here rather than imported so the two call sites can pass their
 * own namespaced translators without either one needing a cast.
 */
type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

const REASON_KEYS = [
  "globally_disabled",
  "feature_disabled",
  "budget_exceeded",
  "rate_limited",
  "no_provider",
  "missing_key",
  "secret_unreadable",
  "content_too_large",
  "model_no_vision",
  "provider_auth",
  "provider_rate_limit",
  "provider_timeout",
  "provider_error",
  "invalid_output",
  "aborted",
] as const;

export function providerFormLabels(t: Translator, tAi: Translator): ProviderFormLabels {
  const reasonLabels: Record<string, string> = {};
  for (const key of REASON_KEYS) reasonLabels[key] = tAi(`reasons.${key}`);
  const kindLabels: Record<string, string> = {};
  for (const kind of AI_PROVIDER_KINDS) kindLabels[kind] = tAi(`providerKinds.${kind}`);

  return {
    connectionTitle: tAi("providerEditTitle"),
    kindField: tAi("providerKind"),
    labelField: tAi("providerLabel"),
    labelHint: tAi("providerLabelHint"),
    baseUrlField: tAi("providerBaseUrl"),
    baseUrlHint: tAi("providerBaseUrlHint"),
    apiKeyField: tAi("providerApiKey"),
    apiKeySaved: tAi("providerApiKeySaved"),
    apiKeyEmpty: tAi("providerApiKeyEmpty"),
    showKey: t("showPassword"),
    hideKey: t("hidePassword"),
    enabledField: tAi("providerEnabled"),
    enabledHint: tAi("providerEnabledHint"),
    defaultField: tAi("providerDefault"),
    defaultHint: tAi("providerDefaultHint"),
    save: t("save"),
    saved: t("saved"),
    testAction: tAi("providerTestAction"),
    testRunning: tAi("providerTestRunning"),
    testOk: tAi("providerTestOk"),
    testFailed: tAi("providerTestFailed", { reason: "" }),
    deleteAction: tAi("providerDeleteAction"),
    deleteTitle: tAi("providerDeleteTitle"),
    deleteDescription: tAi("providerDeleteDescription"),
    deleteDone: t("deleted"),
    cancel: t("cancel"),
    secretMissingTitle: tAi("providerSecretMissingTitle"),
    secretMissingBody: tAi("providerSecretMissingBody"),
    echoTitle: tAi("providerEchoTitle"),
    echoBody: tAi("providerEchoBody"),
    kindLabels,
    reasonLabels,
  };
}
