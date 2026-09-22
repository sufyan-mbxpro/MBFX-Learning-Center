import { getTranslations } from "next-intl/server";
import { listGlossaryTopics } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { HeaderActions } from "../../../_components/header-actions.tsx";
import { NewTopicButton } from "./topics-controls.tsx";
import { TopicsTable, type TopicsTableLabels } from "./topics-table.tsx";
import { formatDateTime } from "@repo/utils";

// Glossary topics (changes-11 Phase 10 / D27; rebuilt as a table in
// changes-18 PR 3).
//
// Read gate here; every write re-gates in its own action (security.md #1). The
// `can()` calls only decide what to render — a hidden button is not security.
export default async function GlossaryTopicsAdminPage() {
  const subject = await requirePermission("glossary.view");
  const [t, rows] = await Promise.all([getTranslations("admin"), listGlossaryTopics()]);

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
    notPublic: t("topics.notPublic"),
    notPublicHint: t("topics.notPublicHint"),
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
    <>
      <HeaderActions>
        {can(subject, "glossary.create") ? (
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
        ) : undefined}
      </HeaderActions>
      <TopicsTable
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          isActive: row.isActive,
          termCount: row.termCount,
          publishedTermCount: row.publishedTermCount,
          updatedAtLabel: formatDateTime(row.updatedAt),
          updatedAtSort: row.updatedAt.getTime(),
        }))}
        canCreate={can(subject, "glossary.create")}
        canUpdate={can(subject, "glossary.update")}
        canDelete={can(subject, "glossary.delete")}
        labels={labels}
      />
    </>
  );
}
