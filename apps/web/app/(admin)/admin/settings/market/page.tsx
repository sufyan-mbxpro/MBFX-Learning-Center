import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { loadProviderFormProps } from "../../market/provider/_provider-props.ts";
import { ProviderForm } from "../../market/provider/provider-form.tsx";
import { SettingsScreen } from "../_components/settings-screen.tsx";
import { loadSettingsIndex } from "../_components/settings-shared.ts";

// The market data provider, in Settings (changes-37, ADR-121 §6).
//
// The same form as `/admin/market/provider`, loaded by the same function — the
// owner asked for the provider API "in settings as well, on both sides". The
// AI provider already lives in both places (`/admin/settings/ai` and
// `/admin/ai/providers`); this puts the other sealed provider key where an
// admin looking through Settings will find it.
//
// A static route that wins over `settings/[group]`, like `ai/` and `email/`.
// There is no `market` settings GROUP, so nothing is shadowed.
//
// **The gate is the provider screen's own key, `market.providers.manage`**
// (ADR-087 #5), not `settings.view`. Moving where a form is drawn must not
// widen who can repoint the key behind it; the server actions re-check it
// either way.
export default async function MarketSettingsPage() {
  const subject = await requirePermission("market.providers.manage");
  const t = await getTranslations("admin");

  const [{ navEntries }, { provider, labels }] = await Promise.all([
    loadSettingsIndex(subject, t),
    loadProviderFormProps(t),
  ]);

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={t("marketData.providerTitle")}
      description={t("marketData.providerDescription")}
    >
      <ProviderForm provider={provider} labels={labels} />
    </SettingsScreen>
  );
}
