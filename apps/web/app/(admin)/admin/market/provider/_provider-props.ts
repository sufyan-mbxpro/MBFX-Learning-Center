// The market provider form, loaded (Module 13, ADR-087 #5).
//
// Two screens render this form since changes-37 (ADR-121 §6): its home under
// Market data, and Settings, where an admin looking for "the provider API" goes
// first. One loader so the two cannot drift — a label or a due-time rule fixed
// on one screen and not the other is the second copy nobody reads.
//
// It does NOT check a permission. Each PAGE calls `requirePermission` as its
// first line, and each server action behind the form re-checks its own key.
import { getSyncDueState, loadMarketProvider } from "@repo/core";
import type { ProviderFormLabels } from "./provider-form.tsx";
import { formatDateTime } from "@repo/utils";

/** The `admin` namespace translator — a structural type, as `ai/limits/_labels.ts` does. */
type AdminTranslator = (key: string, values?: Record<string, string | number | Date>) => string;

export async function loadProviderFormProps(t: AdminTranslator) {
  const [provider, due] = await Promise.all([loadMarketProvider(), getSyncDueState()]);

  const labels: ProviderFormLabels = {
    driverField: t("marketData.driverField"),
    driverHint: t("marketData.driverHint"),
    baseUrlField: t("marketData.baseUrlField"),
    apiKeyField: t("marketData.apiKeyField"),
    apiKeySaved: t("marketData.apiKeySaved"),
    apiKeyEmpty: t("marketData.apiKeyEmpty"),
    showKey: t("marketData.showKey"),
    hideKey: t("marketData.hideKey"),
    refreshField: t("marketData.refreshField"),
    refreshHint: t("marketData.refreshHint"),
    staleField: t("marketData.staleField"),
    staleHint: t("marketData.staleHint"),
    enabledField: t("marketData.enabledField"),
    enabledHint: t("marketData.enabledHint"),
    save: t("save"),
    saved: t("saved"),
    testTitle: t("marketData.testTitle"),
    testDescription: t("marketData.testDescription"),
    testSymbolField: t("marketData.testSymbolField"),
    testAction: t("marketData.testAction"),
    testOk: t("marketData.testOk"),
    testFailed: t("marketData.testFailed"),
    connectionTitle: t("marketData.connectionTitle"),
    statusTitle: t("marketData.statusTitle"),
    lastSync: t("marketData.lastSync"),
    lastSyncNever: t("marketData.lastSyncNever"),
    lastError: t("marketData.lastError"),
    noError: t("marketData.noError"),
    secretKeyMissingTitle: t("marketData.secretKeyMissingTitle"),
    secretKeyMissingBody: t("marketData.secretKeyMissingBody"),
    manualTitle: t("marketData.manualTitle"),
    manualBody: t("marketData.manualBody"),
    syncTitle: t("marketData.syncTitle"),
    syncDescription: t("marketData.syncDescription"),
    syncAction: t("marketData.syncAction"),
    syncRunning: t("marketData.syncRunning"),
    syncDone: t("marketData.syncDone"),
    syncPartial: t("marketData.syncPartial"),
    syncAttempted: t("marketData.syncAttempted"),
    syncSynced: t("marketData.syncSynced"),
    syncBars: t("marketData.syncBars"),
    syncSkipped: t("marketData.syncSkipped"),
    syncFailuresLabel: t("marketData.syncFailuresLabel"),
    syncUnsupportedLabel: t("marketData.syncUnsupportedLabel"),
    nextDue: t("marketData.nextDue"),
  };

  // Resolved here rather than in the form: which of the four things to say is
  // a question about state, not about layout. An instance with no CRON_SECRET
  // is told the truth — the endpoint refuses every caller, so no schedule can
  // reach it (ADR-096 #5) — instead of being shown a due time that will never
  // arrive on its own.
  const nextDueLabel = !provider.cronConfigured
    ? t("marketData.nextDueUnscheduled")
    : due.lastSyncAt === null
      ? t("marketData.nextDueNever")
      : due.nextDueAt && !due.due
        ? formatDateTime(due.nextDueAt)
        : t("marketData.nextDueNow");

  return {
    provider: {
      driver: provider.driver,
      baseUrl: provider.baseUrl,
      hasApiKey: provider.hasApiKey,
      refreshSeconds: provider.refreshSeconds,
      staleSeconds: provider.staleSeconds,
      isEnabled: provider.isEnabled,
      lastSyncLabel: provider.lastSyncAt ? formatDateTime(provider.lastSyncAt) : null,
      lastSyncError: provider.lastSyncError,
      hasSecretKey: provider.hasSecretKey,
      nextDueLabel,
    },
    labels,
  };
}
