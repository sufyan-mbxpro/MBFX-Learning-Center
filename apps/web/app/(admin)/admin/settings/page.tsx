import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireAnyPermission } from "@repo/rbac";
import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { AdminPage } from "../_components/admin-page.tsx";
import { groupDescription, loadSettingsIndex } from "./_components/settings-shared.ts";

// Settings hub (changes-01, image-3/4): one card per category; clicking a
// card opens that category on its own page with the settings sub-sidebar.
// Cards for social/features/navigation/theme front their own screens —
// each destination re-checks its own permission key.
export default async function SettingsHubPage() {
  const subject = await requireAnyPermission([
    "settings.view",
    "social.manage",
    "features.manage",
    "navigation.manage",
    "theme.update",
  ]);
  const t = await getTranslations("admin");
  const { navEntries, groups } = await loadSettingsIndex(subject, t);

  const cards = navEntries.map((entry) => {
    const group = groups.find((g) => `/admin/settings/${g}` === entry.href);
    return {
      ...entry,
      description: group
        ? groupDescription(t, group)
        : t.has(`settingsGroupDesc.${entry.href.split("/").pop() ?? ""}`)
          ? t(`settingsGroupDesc.${entry.href.split("/").pop() ?? ""}`)
          : null,
    };
  });

  return (
    <AdminPage title={t("settings")} description={t("settingsHubSubtitle")} width="lg">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group rounded-xl">
            <Card className="h-full transition-colors group-hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {card.label}
                  <ArrowRight
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </CardTitle>
                {card.description && <CardDescription>{card.description}</CardDescription>}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
