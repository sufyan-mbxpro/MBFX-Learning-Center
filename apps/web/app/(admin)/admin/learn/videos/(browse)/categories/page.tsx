import { listVideoCategoriesAdmin } from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { HeaderActions } from "../../../../_components/header-actions.tsx";
import { CategoriesTable } from "./categories-table.tsx";
import { NewCategoryButton } from "./categories-controls.tsx";

// Video categories (changes-16 PR 4, ADR-068; rebuilt as a table in
// changes-22).
//
// Read gate here; every write re-gates in its own action (security.md #1).
// The `can()` calls only decide what to render — a hidden button is not
// security. Gated on `lessons.*` per ADR-068 §3.
export default async function VideoCategoriesAdminPage() {
  const subject = await requirePermission("lessons.view");
  const rows = await listVideoCategoriesAdmin();

  return (
    <>
      <HeaderActions>
        {can(subject, "lessons.create") ? (
          <NewCategoryButton locale={routing.defaultLocale} />
        ) : undefined}
      </HeaderActions>
      <CategoriesTable
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          isActive: row.isActive,
          topicCount: row.topicCount,
        }))}
        locale={routing.defaultLocale}
        canUpdate={can(subject, "lessons.update")}
        canDelete={can(subject, "lessons.delete")}
      />
    </>
  );
}
