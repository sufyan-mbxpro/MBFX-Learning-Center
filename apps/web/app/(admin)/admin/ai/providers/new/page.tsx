import { getTranslations } from "next-intl/server";
import { hasAiSecretKey } from "@repo/ai";
import { requirePermission } from "@repo/rbac";
import { AdminPage } from "../../../_components/admin-page.tsx";
import { providerFormLabels } from "../_labels.ts";
import { AiProviderForm } from "../provider-form.tsx";

// A new provider. No models table: a model belongs to a saved provider, and
// offering one before the row exists would ask an admin to fill a form whose
// foreign key does not resolve yet.
export default async function NewAiProviderPage() {
  await requirePermission("ai.providers.manage");
  const t = await getTranslations("admin");
  const tAi = await getTranslations("admin.ai");

  return (
    <AdminPage
      title={tAi("providerNew")}
      description={tAi("providerEditDescription")}
      backHref="/admin/ai/providers"
      backLabel={tAi("providersTitle")}
    >
      <AiProviderForm
        provider={{
          id: null,
          kind: "ANTHROPIC",
          label: "",
          baseUrl: null,
          hasApiKey: false,
          isEnabled: false,
          isDefault: false,
          hasSecretKey: hasAiSecretKey(),
        }}
        labels={providerFormLabels(t, tAi)}
      />
    </AdminPage>
  );
}
