import { getTranslations } from "next-intl/server";
import { AI_MODEL_ROLES } from "@repo/contracts";
import { loadAiSetupView } from "@repo/core";
import { can, requireAnyPermission } from "@repo/rbac";
import { AdminSection } from "../../../_components/admin-page.tsx";
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
//
// changes-51: this is the section's first TAB now. The usage-limits form and
// the "more" links it used to carry are gone — Budget & limits, Features,
// Providers and Usage are tabs beside it, so repeating them here was a second
// copy of a form one click away.
export default async function AiSettingsPage() {
  const subject = await requireAnyPermission([
    "settings.view",
    "ai.settings.manage",
    "ai.providers.manage",
  ]);
  const tAi = await getTranslations("admin.ai");
  const tSetup = await getTranslations("admin.aiSetup");

  const canConnect = can(subject, "ai.providers.manage") && can(subject, "ai.settings.manage");

  const view = await loadAiSetupView();

  const connected = view.providers.find((p) => p.isDefault && p.isEnabled);

  return (
    <>
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
    </>
  );
}
