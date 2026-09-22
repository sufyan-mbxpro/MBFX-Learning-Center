// The limits form's labels and model options, built once (ADR-120). The
// Connection tab used to render the same form, so this was shared; since
// changes-51 the Budget & limits tab is its one caller.
import { currentPeriod } from "@repo/ai";
import type { AiLimitsView, AiModelView } from "@repo/core";
import type { LimitsFormLabels } from "./limits-form.tsx";

type Translator = ((key: string, values?: Record<string, string | number | Date>) => string) & {
  has: (key: string) => boolean;
};

export function limitsFormProps(
  t: Translator,
  tAi: Translator,
  limits: AiLimitsView,
  models: AiModelView[],
): { labels: LimitsFormLabels; modelOptions: { value: string; label: string }[] } {
  const featureName = (key: string): string =>
    tAi.has(`featureNames.${key}`) ? tAi(`featureNames.${key}`) : key;

  const affects = (keys: string[]) =>
    tAi("tierAffects", { features: keys.map(featureName).join(", ") });

  /**
   * One option per distinct model ID, with its price in the label.
   *
   * De-duplicated by ID because a tier holds a model ID STRING, not a row id:
   * two providers offering the same model are one choice here, and listing it
   * twice would ask an admin to pick between two identical rows.
   */
  const seen = new Set<string>();
  const modelOptions = models
    .filter((model) => model.isEnabled && !seen.has(model.modelId) && seen.add(model.modelId))
    .map((model) => ({
      value: model.modelId,
      label: `${model.label} — ${tAi("tierPrice", {
        input: `$${model.inputPricePerMTok}`,
        output: `$${model.outputPricePerMTok}`,
      })}`,
    }));

  const labels: LimitsFormLabels = {
    section: tAi("limitsSection"),
    enabled: tAi("limitsEnabled"),
    enabledHint: tAi("limitsEnabledHint"),
    budget: tAi("limitsBudget"),
    budgetHint: tAi("limitsBudgetHint"),
    warn: tAi("limitsWarn"),
    warnHint: tAi("limitsWarnHint"),
    capBehavior: tAi("limitsCapBehavior"),
    capDisable: tAi("limitsCapDisable"),
    capNotify: tAi("limitsCapNotify"),
    capHint: tAi("limitsCapHint"),
    maxTokens: tAi("limitsMaxTokens"),
    maxTokensHint: tAi("limitsMaxTokensHint"),
    rate: tAi("limitsRate"),
    rateHint: tAi("limitsRateHint"),
    tiersSection: tAi("tiersSection"),
    tiersDescription: tAi("tiersDescription"),
    tierLight: tAi("tierLight"),
    tierStandard: tAi("tierStandard"),
    tierHeavy: tAi("tierHeavy"),
    tierLightHint: tAi("tierLightHint"),
    tierStandardHint: tAi("tierStandardHint"),
    tierHeavyHint: tAi("tierHeavyHint"),
    // The blast radius, named beside each row (ADR-099's R11).
    tierAffectsLight: affects(limits.tierFeatures.light),
    tierAffectsStandard: affects(limits.tierFeatures.standard),
    tierAffectsHeavy: affects(limits.tierFeatures.heavy),
    tierMissing: tAi("tierMissing"),
    save: t("save"),
    saved: t("saved"),
    resetTitle: tAi("resetTitle"),
    resetDescription: tAi("resetDescription", { period: currentPeriod() }),
    resetAction: tAi("resetAction"),
    resetConfirmTitle: tAi("resetConfirmTitle"),
    resetConfirmDescription: tAi("resetConfirmDescription", { period: currentPeriod() }),
    resetDone: t("saved"),
    cancel: t("cancel"),
    budgetCapped: tAi("budgetCapped"),
    budgetCappedBody:
      limits.capBehavior === "DISABLE" ? tAi("budgetCappedBody") : tAi("budgetCappedNotifyOnly"),
  };

  return { labels, modelOptions };
}
