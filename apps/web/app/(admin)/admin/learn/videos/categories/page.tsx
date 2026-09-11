import { getTranslations } from "next-intl/server";
import { listVideoCategoriesAdmin } from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../../_components/admin-page.tsx";
import { CategoriesManager } from "./categories-manager.tsx";

// Video categories (changes-16 PR 4, ADR-068).
//
// Read gate here; every write re-gates in its own action (security.md #1).
// The `can()` calls only decide what to render — a hidden button is not
// security. Gated on `lessons.*` per ADR-068 §3.
export default async function VideoCategoriesAdminPage() {
  const subject = await requirePermission("lessons.view");
  const [t, rows] = await Promise.all([getTranslations("admin"), listVideoCategoriesAdmin()]);

  return (
    <AdminPage title={t("videoCategories")} description={t("pageDesc.videoCategories")}>
      <CategoriesManager
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          isActive: row.isActive,
          topicCount: row.topicCount,
        }))}
        locale={routing.defaultLocale}
        canCreate={can(subject, "lessons.create")}
        canUpdate={can(subject, "lessons.update")}
        canDelete={can(subject, "lessons.delete")}
      />
    </AdminPage>
  );
}
