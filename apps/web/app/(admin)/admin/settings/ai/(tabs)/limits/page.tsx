import { getTranslations } from "next-intl/server";
import { listAiModels, loadAiLimitsView } from "@repo/core";
import { requirePermission } from "@repo/rbac";

import { limitsFormProps } from "./_labels.ts";
import { LimitsForm } from "./limits-form.tsx";

// Budget, limits and the three model tiers (ADR-099, ADR-100).
export default async function AiLimitsPage() {
  await requirePermission("ai.settings.manage");
  const t = await getTranslations("admin");
  const tAi = await getTranslations("admin.ai");

  const [limits, models] = await Promise.all([loadAiLimitsView(), listAiModels()]);

  const { labels, modelOptions } = limitsFormProps(t, tAi, limits, models);

  return (
    <>
      <p className="text-sm text-muted-foreground">{tAi("limitsDescription")}</p>
      <LimitsForm limits={limits} modelOptions={modelOptions} labels={labels} />
    </>
  );
}
