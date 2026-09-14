import { getTranslations } from "next-intl/server";
import { getSyncDueState, loadMarketProvider } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { ProviderForm, type ProviderFormLabels } from "./provider-form.tsx";

// The market data provider (Module 13, ADR-087 #5).
//
// **`market.providers.manage`, not super_admin.** ADR-078's SMTP transport is
// super_admin-only because the HOST is an escalation path — repointing
// delivery captures the next password-reset link. This key is not that: it
// buys read-only quotes, nothing is delivered TO a user through it, and an
// attacker who repoints it gets to lie about the price of EUR/USD on a page
// that already carries a disclaimer. The narrower harm gets the narrower gate,
// and saying so is what stops "sealed secret" spreading by resemblance.
//
// The API key reaches this screen by no route: `loadMarketProvider()` returns
// a view with no key property at all, and `hasApiKey` is the only thing the
// form is told.
export default async function MarketProviderPage() {
  await requirePermission("market.providers.manage");
  const t = await getTranslations("admin");

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
    nextDue: t("marketData.nextDue"),
  };

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

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
        ? dateFormat.format(due.nextDueAt)
        : t("marketData.nextDueNow");

  return (
    <AdminPage
      title={t("marketData.providerTitle")}
      description={t("marketData.providerDescription")}
      backHref="/admin/market"
      backLabel={t("marketData.title")}
    >
      <ProviderForm
        provider={{
          driver: provider.driver,
          baseUrl: provider.baseUrl,
          hasApiKey: provider.hasApiKey,
          refreshSeconds: provider.refreshSeconds,
          staleSeconds: provider.staleSeconds,
          isEnabled: provider.isEnabled,
          lastSyncLabel: provider.lastSyncAt ? dateFormat.format(provider.lastSyncAt) : null,
          lastSyncError: provider.lastSyncError,
          hasSecretKey: provider.hasSecretKey,
          nextDueLabel,
        }}
        labels={labels}
      />
    </AdminPage>
  );
}
