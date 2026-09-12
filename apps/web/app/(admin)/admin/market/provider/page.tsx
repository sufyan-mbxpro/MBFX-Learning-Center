import { getTranslations } from "next-intl/server";
import { loadMarketProvider } from "@repo/core";
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

  const provider = await loadMarketProvider();

  const labels: ProviderFormLabels = {
    driverField: t("marketData.driverField"),
    driverHint: t("marketData.driverHint"),
    baseUrlField: t("marketData.baseUrlField"),
    apiKeyField: t("marketData.apiKeyField"),
    apiKeySaved: t("marketData.apiKeySaved"),
    apiKeyEmpty: t("marketData.apiKeyEmpty"),
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
  };

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

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
        }}
        labels={labels}
      />
    </AdminPage>
  );
}
