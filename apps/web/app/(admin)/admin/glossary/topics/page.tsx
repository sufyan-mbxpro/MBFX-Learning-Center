import { getTranslations } from "next-intl/server";
import { listGlossaryTopics } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { NewTopicButton } from "./topics-controls.tsx";
import { TopicsTable, type TopicsTableLabels } from "./topics-table.tsx";

// Glossary topics (changes-11 Phase 10 / D27; rebuilt as a table in
// changes-18 PR 3).
//
// Read gate here; every write re-gates in its own action (security.md #1). The
// `can()` calls only decide what to render — a hidden button is not security.
export default async function GlossaryTopicsAdminPage() {
  const subject = await requirePermission("glossary.view");
  const [t, rows] = await Promise.all([getTranslations("admin"), listGlossaryTopics()]);

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  const labels: TopicsTableLabels = {
    search: t("topics.searchPlaceholder"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    nameCol: t("topics.columnName"),
    statusCol: t("topics.columnStatus"),
    termsCol: t("topics.columnTerms"),
    updatedCol: t("topics.columnUpdated"),
    actionsCol: t("actionsCol"),
    untitled: t("untitled"),
    published: t("topics.published"),
    draft: t("topics.draft"),
    edit: t("edit"),
    duplicate: t("duplicate"),
    moveUp: t("moveUp"),
    moveDown: t("moveDown"),
    deleteTopic: t("delete"),
    confirmDeleteTitle: t("topics.confirmDeleteTitle"),
    confirmDeleteBody: t("topics.confirmDeleteBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    openActions: t("openActions"),
    emptyTitle: t("topics.empty"),
    emptyBody: t("topics.emptyBody"),
    allStatuses: t("topics.filterAllStatuses"),
    statusLabel: t("topics.filterStatus"),
    statusPublished: t("topics.published"),
    statusDraft: t("topics.draft"),
  };

  return (
    <AdminPage
      title={t("glossaryTopics")}
      description={t("pageDesc.glossaryTopics")}
      actions={
        can(subject, "glossary.create") ? (
          <NewTopicButton
            labels={{
              trigger: t("topics.create"),
              title: t("topics.createTitle"),
              description: t("topics.createDescription"),
              nameLabel: t("topics.nameLabel"),
              create: t("create"),
              cancel: t("cancel"),
              close: t("close"),
            }}
          />
        ) : undefined
      }
    >
      <TopicsTable
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          isActive: row.isActive,
          termCount: row.termCount,
          updatedAtLabel: dateFormat.format(row.updatedAt),
          updatedAtSort: row.updatedAt.getTime(),
        }))}
        canCreate={can(subject, "glossary.create")}
        canUpdate={can(subject, "glossary.update")}
        canDelete={can(subject, "glossary.delete")}
        labels={labels}
      />
    </AdminPage>
  );
}
