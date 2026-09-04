import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { loadAllFeatureFlags } from "@repo/settings";
import { AdminPage, AdminSection } from "../_components/admin-page.tsx";
import { SettingsNav } from "../settings/_components/settings-nav.tsx";
import { loadSettingsIndex } from "../settings/_components/settings-shared.ts";
import { FlagToggle } from "./flag-toggle.tsx";

export default async function FeatureFlagsPage() {
  const subject = await requirePermission("features.manage");
  const t = await getTranslations("admin");
  const [flags, { navEntries }] = await Promise.all([
    loadAllFeatureFlags(),
    loadSettingsIndex(subject, t),
  ]);
  const groups = [...new Set(flags.map((f) => f.groupName))];

  // Raw enum values never render (code-style #2).
  const visibilityLabels: Record<string, string> = {
    PUBLIC: t("visibilityPublic"),
    AUTHENTICATED: t("visibilityAuthenticated"),
    PREMIUM: t("visibilityPremium"),
    ADMIN: t("visibilityAdmin"),
  };

  return (
    <AdminPage title={t("features")} width="lg">
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav heading={t("settingsCategories")} entries={navEntries} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {groups.map((group) => (
            <AdminSection
              key={group}
              title={t.has(`settingsGroups.${group}`) ? t(`settingsGroups.${group}`) : group}
            >
              {flags
                .filter((f) => f.groupName === group)
                .map((flag) => (
                  <div
                    key={flag.key}
                    className="flex items-center gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <FlagToggle flagKey={flag.key} isEnabled={flag.isEnabled} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{flag.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {flag.key} · {t("visibility")}:{" "}
                        {visibilityLabels[flag.visibility] ?? flag.visibility}
                      </span>
                    </div>
                  </div>
                ))}
            </AdminSection>
          ))}
        </div>
      </div>
    </AdminPage>
  );
}
