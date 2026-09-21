import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { loadProviderFormProps } from "./_provider-props.ts";
import { ProviderForm } from "./provider-form.tsx";

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

  const { provider, labels } = await loadProviderFormProps(t);

  return (
    <AdminPage
      title={t("marketData.providerTitle")}
      description={t("marketData.providerDescription")}
      backHref="/admin/market"
      backLabel={t("marketData.title")}
    >
      <ProviderForm provider={provider} labels={labels} />
    </AdminPage>
  );
}
