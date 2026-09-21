import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { AI_MODEL_ROLES } from "@repo/contracts";
import { listAiModels, loadAiSetupView } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminSection } from "../../_components/admin-page.tsx";
import { limitsFormProps } from "../../ai/limits/_labels.ts";
import { LimitsForm } from "../../ai/limits/limits-form.tsx";
import { SettingsScreen } from "../_components/settings-screen.tsx";
import { groupDescription, groupLabel, loadSettingsIndex } from "../_components/settings-shared.ts";
import { AiSetupForm } from "./ai-setup-form.tsx";

// AI settings (Module 18, ADR-120). A static route that wins over
// `settings/[group]` the way `email/` does, because this group is not a list
// of type-driven fields: it is a CONNECTION — choose a provider, prove its key,
// pick from the models it lists — and the generic form rendered the tiers as
// free-text boxes for model IDs nobody could be expected to spell.
//
// **The screen splits by permission, like the email screen (ADR-078 #4).**
// Connecting writes the sealed key and repoints every prompt, so it needs
// `ai.providers.manage` (super_admin, ADR-098) AND `ai.settings.manage` for the
// tiers it sets. Without both, the form is ABSENT and a summary says what is
// connected. The usage limits are `ai.settings.manage` alone. Each server
// action re-checks its own keys; hiding a form is UX, not the boundary.
export default async function AiSettingsPage() {
  const subject = await requirePermission("settings.view");
  const t = await getTranslations("admin");
  const tAi = await getTranslations("admin.ai");
  const tSetup = await getTranslations("admin.aiSetup");

  const canConnect = can(subject, "ai.providers.manage") && can(subject, "ai.settings.manage");
  const canLimit = can(subject, "ai.settings.manage");

  const [{ navEntries }, view, models] = await Promise.all([
    loadSettingsIndex(subject, t),
    loadAiSetupView(),
    listAiModels(),
  ]);

  const connected = view.providers.find((p) => p.isDefault && p.isEnabled);
  const limitsProps = limitsFormProps(t, tAi, view.limits, models);

  const links = [
    ...(canLimit ? [{ href: "/admin/ai/features", label: tSetup("moreFeatures") }] : []),
    ...(can(subject, "ai.providers.manage")
      ? [{ href: "/admin/ai/providers", label: tSetup("moreProviders") }]
      : []),
    ...(can(subject, "ai.usage.view") ? [{ href: "/admin/ai", label: tSetup("moreUsage") }] : []),
  ];

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={groupLabel(t, "ai")}
      description={groupDescription(t, "ai") ?? undefined}
    >
      {canConnect ? (
        <AiSetupForm
          providers={view.providers}
          storedModels={view.models}
          tiers={view.limits.tiers}
          hasSecretKey={view.hasSecretKey}
        />
      ) : (
        <AdminSection title={tSetup("summaryTitle")}>
          <p className="text-sm text-muted-foreground">{tSetup("summaryDescription")}</p>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{tSetup("summaryProvider")}</dt>
              <dd>
                {connected && connected.kind !== "ECHO"
                  ? `${connected.label} · ${tAi(`providerKinds.${connected.kind}`)}`
                  : tSetup("currentProviderNone")}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{tSetup("summaryTiers")}</dt>
              <dd className="flex flex-col gap-0.5">
                {AI_MODEL_ROLES.map((role) => (
                  <span key={role}>
                    {tAi(`tier${role[0]!.toUpperCase()}${role.slice(1)}`)}:{" "}
                    {view.limits.tiers[role]}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </AdminSection>
      )}

      {canLimit && (
        <LimitsForm
          variant="usage"
          limits={view.limits}
          modelOptions={limitsProps.modelOptions}
          labels={{ ...limitsProps.labels, section: tSetup("limitsTitle") }}
        />
      )}

      {links.length > 0 && (
        <AdminSection title={tSetup("moreTitle")}>
          <ul className="flex flex-col gap-2 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex items-center gap-1 font-medium text-primary-interactive underline-offset-4 hover:underline"
                >
                  {link.label}
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}
    </SettingsScreen>
  );
}
