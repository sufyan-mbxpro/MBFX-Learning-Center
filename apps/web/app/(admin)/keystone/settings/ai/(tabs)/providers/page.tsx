import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Plus, Sparkles } from "lucide-react";
import { listAiProviders } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { HeaderActions } from "../../../../_components/header-actions.tsx";
import { formatDateTime } from "@repo/utils";

// Providers (ADR-098).
//
// **`ai.providers.manage` is super_admin-only**, and this is the screen that
// gate exists for: an attacker-controlled `baseUrl` receives every prompt the
// platform sends — the site's unpublished articles, lessons and drafts,
// continuously, without touching the database or leaving an audit trail. That
// is not the market key's harm, which is why the two are gated differently
// rather than by resemblance.
//
// No key reaches this screen by any route: `listAiProviders()` returns views
// with no key property at all, and `hasApiKey` is the only thing it is told.
export default async function AiProvidersPage() {
  await requirePermission("ai.providers.manage");
  const t = await getTranslations("admin");
  const tAi = await getTranslations("admin.ai");

  const providers = await listAiProviders();
  const secretKeyMissing = providers.some((provider) => !provider.hasSecretKey);

  return (
    <>
      <p className="text-sm text-muted-foreground">{tAi("providersDescription")}</p>
      <HeaderActions>
        <Button render={<Link href="/keystone/settings/ai/providers/new" />}>
          <Plus aria-hidden data-icon="inline-start" />
          {tAi("providerNew")}
        </Button>
      </HeaderActions>
      {/* Said before the list rather than after a failed generation: without
          AI_SECRET_KEY a stored key cannot be opened, so saving one is worse
          than useless — it looks like it worked. */}
      {secretKeyMissing && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>{tAi("providerSecretMissingTitle")}</AlertTitle>
          <AlertDescription>{tAi("providerSecretMissingBody")}</AlertDescription>
        </Alert>
      )}

      {providers.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <Sparkles aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{tAi("providerEmpty")}</EmptyTitle>
          <EmptyDescription>{tAi("providersDescription")}</EmptyDescription>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{provider.label}</span>
                    {/* ADR-044 #5 — a raw enum member never renders. */}
                    <span className="text-xs text-muted-foreground">
                      {tAi(`providerKinds.${provider.kind}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {provider.isDefault && <Badge>{tAi("providerDefaultBadge")}</Badge>}
                    <Badge variant={provider.isEnabled ? "secondary" : "outline"}>
                      {provider.isEnabled ? t("enabled") : tAi("providerDisabled")}
                    </Badge>
                    {/* ECHO needs no key, so "No key" would read as a fault
                        rather than as the point of it. */}
                    {provider.kind !== "ECHO" && (
                      <Badge variant={provider.hasApiKey ? "secondary" : "outline"}>
                        {provider.hasApiKey ? tAi("providerKeyPresent") : tAi("providerKeyMissing")}
                      </Badge>
                    )}
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">{tAi("providerLastTest")}</dt>
                    <dd
                      className={
                        provider.lastTestError ? "text-destructive-interactive" : undefined
                      }
                    >
                      {provider.lastTestAt
                        ? `${formatDateTime(provider.lastTestAt)}${
                            provider.lastTestError
                              ? ` · ${
                                  tAi.has(`reasons.${provider.lastTestError}`)
                                    ? tAi(`reasons.${provider.lastTestError}`)
                                    : provider.lastTestError
                                }`
                              : ""
                          }`
                        : tAi("providerLastTestNever")}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">{tAi("modelsTitle")}</dt>
                    <dd>{provider.modelCount}</dd>
                  </div>
                </dl>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/keystone/settings/ai/providers/${provider.id}`} />}
                  >
                    {t("edit")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
