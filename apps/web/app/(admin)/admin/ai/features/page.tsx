import { getTranslations } from "next-intl/server";
import { formatUsd } from "@repo/ai";
import { listAiFeatureCards, listAiModels, listAiProviders, loadAiLimitsView } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { FeatureCard, type FeatureCardLabels } from "./features-form.tsx";

// Which features EXIST is decided in code (`AI_FEATURES`); what each one may
// use, and whether it appears at all, is decided here. ADR-042's split a third
// time — an admin owns the knobs because those are policy and copy, and cannot
// mint a key or replace a system prompt because those are behaviour.
export default async function AiFeaturesPage() {
  await requirePermission("ai.settings.manage");
  const t = await getTranslations("admin");
  const tAi = await getTranslations("admin.ai");

  const [cards, providers, models, limits] = await Promise.all([
    listAiFeatureCards(),
    listAiProviders(),
    listAiModels(),
    loadAiLimitsView(),
  ]);

  const tierLabel: Record<string, string> = {
    light: tAi("tierLight"),
    standard: tAi("tierStandard"),
    heavy: tAi("tierHeavy"),
  };

  return (
    <AdminPage title={tAi("featuresTitle")} description={tAi("featuresDescription")}>
      <div className="flex flex-col gap-6">
        {cards.map((card) => {
          const labels: FeatureCardLabels = {
            name: tAi(`featureNames.${card.key}` as "featureNames.alt_text"),
            description: tAi(`featureDesc.${card.key}` as "featureDesc.alt_text"),
            where: tAi(`featureWhere.${card.key}` as "featureWhere.alt_text"),
            enabled: tAi("featureEnabled"),
            globalOff: tAi("featureGlobalOff"),
            provider: tAi("featureProvider"),
            providerDefault: tAi("featureProviderDefault"),
            model: tAi("featureModel"),
            // The empty option names the tier AND the model it resolves to, so
            // that leaving the field alone reads as a choice.
            modelTier: tAi("featureModelTier", {
              tier: tierLabel[card.modelRole] ?? card.modelRole,
              model: card.tierModelLabel ?? "—",
            }),
            maxTokens: tAi("featureMaxTokens"),
            maxTokensHint: tAi("featureMaxTokensHint", { ceiling: card.registryMaxOutputTokens }),
            instructions: tAi("featureInstructions"),
            instructionsHint: tAi("featureInstructionsHint", {
              count: card.extraInstructions?.length ?? 0,
            }),
            costPerCall:
              card.estimatedCostPerCallUsd === null
                ? tAi("featureCostUnknown")
                : tAi("featureCostPerCall", { cost: formatUsd(card.estimatedCostPerCallUsd) }),
            resolvedModel: card.resolvedModelLabel
              ? tAi("featureResolvedModel", { model: card.resolvedModelLabel })
              : null,
            streams: card.streams ? tAi("featureStreams") : null,
            vision: card.vision ? tAi("featureVision") : null,
            save: t("save"),
            saved: t("saved"),
          };

          return (
            <FeatureCard
              key={card.key}
              card={card}
              globalEnabled={limits.enabled}
              providers={providers
                .filter((provider) => provider.isEnabled)
                .map((provider) => ({ value: provider.id, label: provider.label }))}
              models={models
                .filter((model) => model.isEnabled)
                .map((model) => ({
                  value: model.id,
                  label: `${model.label} · ${model.providerLabel}`,
                  providerId: model.providerId,
                }))}
              labels={labels}
            />
          );
        })}
      </div>
    </AdminPage>
  );
}
