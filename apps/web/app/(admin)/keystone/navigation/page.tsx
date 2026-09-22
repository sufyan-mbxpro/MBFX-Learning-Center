import { getTranslations } from "next-intl/server";
import { loadAdminMenus } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { AdminPage, AdminSection } from "../_components/admin-page.tsx";
import { SettingsNav } from "../settings/_components/settings-nav.tsx";
import { loadSettingsIndex } from "../settings/_components/settings-shared.ts";
import { MenuItemControls } from "./menu-item-controls.tsx";

// Navigation manager (core scope): reorder via explicit up/down (SKILL.md's
// drag-reorder + translation side panel are the deferred polish — the
// tag-invalidation round trip this module exists to prove works either way).
export default async function NavigationPage() {
  const subject = await requirePermission("navigation.manage");
  const t = await getTranslations("admin");
  const [menus, { navEntries }] = await Promise.all([
    loadAdminMenus(),
    loadSettingsIndex(subject, t),
  ]);

  return (
    <AdminPage title={t("navigation")}>
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav heading={t("settingsCategories")} entries={navEntries} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {menus.map((menu) => (
            <AdminSection key={menu.id} className="gap-3">
              <h2 className="text-lg font-semibold">
                {menu.name} <code className="text-xs text-muted-foreground">{menu.key}</code>
              </h2>
              {menu.items
                .filter((i) => i.parentId === null)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <MenuItemControls
                      itemId={item.id}
                      isActive={item.isActive}
                      labels={{ moveUp: t("moveUp"), moveDown: t("moveDown"), active: t("active") }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {item.label ?? item.routeKey ?? item.url}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.routeKey ?? item.url} · #{item.sortOrder}
                        {item.requiresFeature
                          ? ` · ${t("requiresFlag")}: ${item.requiresFeature}`
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
            </AdminSection>
          ))}
        </div>
      </div>
    </AdminPage>
  );
}
