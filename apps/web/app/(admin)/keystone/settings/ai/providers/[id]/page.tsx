import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listAiModels, loadAiProvider } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { EditorPage } from "../../../../_components/admin-page.tsx";
import { providerFormLabels } from "../_labels.ts";
import { ModelsTable, type ModelsTableLabels } from "../../(tabs)/providers/models-table.tsx";
import { AiProviderForm } from "../provider-form.tsx";
import { formatDate } from "@repo/utils";

// One provider, and the models behind it.
export default async function AiProviderPage({
  params,
}: PageProps<"/keystone/settings/ai/providers/[id]">) {
  await requirePermission("ai.providers.manage");
  const { id } = await params;
  const t = await getTranslations("admin");
  const tAi = await getTranslations("admin.ai");

  const [provider, models] = await Promise.all([loadAiProvider(id), listAiModels(id)]);
  if (!provider) notFound();
  // The whole "priced on" line is built server-side: the translator is a
  // function, and a function cannot be passed to a client component. It also
  // keeps the date matching every other date on the surface.
  const pricedLabels = Object.fromEntries(
    models.map((model) => [model.id, tAi("modelPricedAt", { date: formatDate(model.pricedAt) })]),
  );

  const modelLabels: ModelsTableLabels = {
    title: tAi("modelsTitle"),
    description: tAi("modelsDescription"),
    add: tAi("modelNew"),
    editTitle: tAi("modelEditTitle"),
    editDescription: tAi("modelEditDescription"),
    modelId: tAi("modelId"),
    modelIdHint: tAi("modelIdHint"),
    label: tAi("modelLabel"),
    inputPrice: tAi("modelInputPrice"),
    outputPrice: tAi("modelOutputPrice"),
    cachedPrice: tAi("modelCachedPrice"),
    cachedPriceHint: tAi("modelCachedPriceHint"),
    maxTokens: tAi("modelMaxTokens"),
    vision: tAi("modelVision"),
    stream: tAi("modelStream"),
    enabled: tAi("modelEnabled"),
    sortOrder: tAi("modelSortOrder"),
    save: t("save"),
    saved: t("saved"),
    cancel: t("cancel"),
    edit: t("edit"),
    deleteLabel: t("delete"),
    deleteTitle: tAi("modelDeleteTitle"),
    deleteDescription: tAi("modelDeleteDescription"),
    deleteDone: t("deleted"),
    empty: tAi("modelsEmpty"),
  };

  return (
    <EditorPage
      title={t("editorHeading.provider")}
      description={tAi("providerEditDescription")}
      backHref="/keystone/settings/ai/providers"
      backLabel={tAi("providersTitle")}
    >
      <AiProviderForm
        provider={{
          id: provider.id,
          kind: provider.kind,
          label: provider.label,
          baseUrl: provider.baseUrl,
          hasApiKey: provider.hasApiKey,
          isEnabled: provider.isEnabled,
          isDefault: provider.isDefault,
          hasSecretKey: provider.hasSecretKey,
        }}
        labels={providerFormLabels(t, tAi)}
      />

      {/* ECHO reaches no provider and has one placeholder "model" for the
          resolver to land on; a price table over it would invite editing a
          number that can never be billed. */}
      {provider.kind !== "ECHO" && (
        <ModelsTable
          providerId={provider.id}
          models={models}
          labels={modelLabels}
          pricedLabels={pricedLabels}
        />
      )}
    </EditorPage>
  );
}
