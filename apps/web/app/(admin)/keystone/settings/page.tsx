import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireAnyPermission } from "@repo/rbac";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { AdminPage } from "../_components/admin-page.tsx";
import { groupDescription, loadSettingsIndex } from "./_components/settings-shared.ts";

/**
 * The `settingsGroupDesc.*` key for a destination that is not a registry
 * group: its path under `/keystone/settings/` (or `/keystone/`), camel-cased.
 * `email/templates` → `emailTemplates`. The last segment alone used to be the
 * key, which made the email screens look up `templates` and `log` — names too
 * generic to hold a description, so neither card had one (changes-37).
 */
function descriptionKey(href: string): string {
  return href
    .replace(/^\/keystone\/(settings\/)?/, "")
    .split("/")
    .map((segment, index) =>
      index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join("");
}

// Settings hub (changes-01, image-3/4): one card per category; clicking a
// card opens that category on its own page with the settings sub-sidebar.
// Cards for social/navigation/theme front their own screens —
// each destination re-checks its own permission key.
export default async function SettingsHubPage() {
  const subject = await requireAnyPermission([
    "settings.view",
    "social.manage",
    "navigation.manage",
    "theme.update",
    // `support` holds only this one key under settings (ADR-078 #4).
    "email.log.view",
    // changes-37: the market provider card (ADR-121 §6).
    "market.providers.manage",
    // changes-51: AI lives here now, and has no sidebar entry of its own.
    "ai.usage.view",
    "ai.settings.manage",
    "ai.providers.manage",
  ]);
  const t = await getTranslations("admin");
  const { navEntries, groups } = await loadSettingsIndex(subject, t);

  const cards = navEntries.map((entry) => {
    // A tabbed section's card (Email, AI) may land on any of its tabs, so it
    // is matched by the section it belongs to, not by the tab it opens.
    const group =
      groups.find((g) => `/keystone/settings/${g}` === (entry.prefix ?? entry.href)) ??
      entry.prefix?.replace("/keystone/settings/", "");
    const key = descriptionKey(entry.href);
    return {
      ...entry,
      description: group
        ? groupDescription(t, group)
        : t.has(`settingsGroupDesc.${key}`)
          ? t(`settingsGroupDesc.${key}`)
          : null,
    };
  });

  return (
    <AdminPage title={t("settings")} description={t("settingsHubSubtitle")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          // ADR-075 hand-off: a category tile is a SMALL card (16px title and
          // rhythm); a 24px title is for a card that is its own section.
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Card size="sm" className="h-full group-hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{card.label}</CardTitle>
                <CardAction>
                  <ArrowRight
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </CardAction>
                {card.description && <CardDescription>{card.description}</CardDescription>}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
