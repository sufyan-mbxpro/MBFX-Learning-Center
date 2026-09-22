import { getTranslations } from "next-intl/server";
import { listArticlesAdmin, loadArticleCategoriesAdmin, type ListArticlesParams } from "@repo/core";
import {
  ARTICLE_DELETED_FILTER,
  articleKindSchema,
  articleSortBySchema,
  articleStatusFilterSchema,
} from "@repo/contracts";
import { can, requireAnyPermission } from "@repo/rbac";
import { ArticlesToolbar, NewArticleDialog } from "./articles-controls.tsx";
import { ArticlesTable, type ArticlesTableLabels } from "./articles-table.tsx";
import { HeaderActions } from "../../_components/header-actions.tsx";
import { formatDateTime } from "@repo/utils";

const PAGE_SIZE = 10;

// News & Analysis admin list (Module 15): shared DataTable, server-driven —
// search/sort/page state lives in the URL. Kind-specific write gates live
// in the service; this page only computes UX flags (a hidden button is not
// security).
export default async function ArticlesAdminPage({ searchParams }: PageProps<"/keystone/articles">) {
  const subject = await requireAnyPermission(["analysis.view", "news.manage"]);
  const params = await searchParams;

  const kind = articleKindSchema.safeParse(params.kind);
  const status = articleStatusFilterSchema.safeParse(params.status);
  const sortBy = articleSortBySchema.safeParse(params.sortBy);
  const page = Math.max(0, Number.parseInt(String(params.page ?? "0"), 10) || 0);
  const search =
    typeof params.q === "string" && params.q.trim() !== "" ? params.q.trim() : undefined;
  const categoryId =
    typeof params.category === "string" && params.category !== "" ? params.category : undefined;
  const sortDir = params.sortDir === "asc" ? "asc" : "desc";
  // The trash (changes-49) rides on the status filter but is not a status:
  // it becomes the service's `deleted` flag, and a real status narrows the
  // live rows as before.
  const showDeleted = status.success && status.data === ARTICLE_DELETED_FILTER;
  const contentStatus =
    status.success && status.data !== ARTICLE_DELETED_FILTER ? status.data : undefined;

  const listParams: ListArticlesParams = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sortBy.success ? sortBy.data : undefined,
    sortDir,
    search,
    kind: kind.success ? kind.data : undefined,
    status: contentStatus,
    deleted: showDeleted,
    categoryId,
  };

  const [t, result, categories] = await Promise.all([
    getTranslations("admin"),
    listArticlesAdmin(listParams),
    loadArticleCategoriesAdmin(),
  ]);

  const flags = {
    canCreate: can(subject, "analysis.create") || can(subject, "news.manage"),
    canDelete: can(subject, "analysis.delete") || can(subject, "news.manage"),
  };
  const kindLabels: Record<string, string> = {
    NEWS: t("kindNews"),
    ANALYSIS: t("kindAnalysis"),
    TRADE_IDEA: t("kindTradeIdea"),
  };
  const statusLabels: Record<string, string> = {
    DRAFT: t("statusDraft"),
    SCHEDULED: t("statusScheduled"),
    PUBLISHED: t("statusPublished"),
    ARCHIVED: t("statusArchived"),
  };

  const tableLabels: ArticlesTableLabels = {
    search: t("searchArticles"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    titleCol: t("titleLabel"),
    kindCol: t("kind"),
    categoryCol: t("categoryLabel"),
    statusCol: t("statusLabel"),
    activeCol: t("activeLabel"),
    publishedCol: t("publishedLabel"),
    updatedCol: t("updatedLabel"),
    actionsCol: t("actionsCol"),
    untitled: t("untitled"),
    deleted: t("deleted"),
    edit: t("edit"),
    duplicate: t("duplicate"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("confirmDeleteArticleTitle"),
    confirmDeleteBody: t("confirmDeleteArticleBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    openActions: t("openActions"),
    emptyTitle: t("noArticles"),
    editGroup: t("editGroupLabel"),
    statusGroup: t("statusGroupLabel"),
    quickEdit: t("quickEdit"),
    fullEditor: t("fullEditor"),
    setAsDraft: t("setAsDraft"),
    setFeatured: t("setFeatured"),
    unsetFeatured: t("unsetFeatured"),
    viewPost: t("viewPost"),
    featuredCol: t("featuredCol"),
    quick: {
      title: t("quickEdit"),
      description: t("editPostDescription"),
      titleLabel: t("titleLabel"),
      slugLabel: t("slugLabel"),
      categoryLabel: t("categoryLabel"),
      featuredLabel: t("featuredPostLabel"),
      save: t("save"),
      cancel: t("cancel"),
      saved: t("saved"),
    },
  };

  // The heading, the tab strip and the Settings button are the section's
  // LAYOUT (ADR-106) — this file renders the tab's own content and nothing
  // else, which is what lets a tab click swap only the table.
  return (
    <>
      {/* ADR-140 §3: the primary action sits on the section heading's row,
          after Settings. The heading is the LAYOUT's, so the button portals
          into its slot; this page still decides whether it exists. */}
      {flags.canCreate && (
        <HeaderActions>
          <NewArticleDialog
            categories={categories.map((c) => ({ id: c.id, name: c.name ?? c.id }))}
            labels={{
              newArticle: t("newArticle"),
              newArticleDescription: t("dialogDesc.newArticle"),
              create: t("create"),
              cancel: t("cancel"),
              close: t("close"),
              kind: t("kind"),
              category: t("categoryLabel"),
              kinds: kindLabels,
            }}
          />
        </HeaderActions>
      )}
      {/* changes-08 #7: the filters render INSIDE the table's toolbar, on the
          same row as "Search articles", instead of in a bar above it. */}
      <ArticlesTable
        filters={
          <ArticlesToolbar
            categories={categories.map((c) => ({ id: c.id, name: c.name ?? c.id }))}
            labels={{
              allKinds: t("allKinds"),
              allStatuses: t("allStatuses"),
              allCategories: t("allCategories"),
              kind: t("kind"),
              kinds: kindLabels,
              statuses: statusLabels,
            }}
          />
        }
        categories={categories.map((c) => ({ id: c.id, name: c.name ?? c.id }))}
        rows={result.rows.map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          deleted: row.deletedAt !== null,
          kindLabel: kindLabels[row.kind] ?? row.kind,
          categoryName: row.categoryName,
          status: row.status,
          statusLabel: statusLabels[row.status] ?? row.status,
          scheduledForLabel:
            row.status === "SCHEDULED" && row.scheduledFor
              ? formatDateTime(row.scheduledFor)
              : null,
          isActive: row.isActive,
          isFeatured: row.isFeatured,
          legalTransitions: row.legalTransitions,
          publishedAtLabel: row.publishedAt ? formatDateTime(row.publishedAt) : null,
          updatedAtLabel: formatDateTime(row.updatedAt),
        }))}
        pageCount={result.pageCount}
        page={page}
        pageSize={PAGE_SIZE}
        sortBy={sortBy.success ? sortBy.data : null}
        sortDir={sortDir}
        search={search ?? ""}
        canCreate={flags.canCreate}
        canDelete={flags.canDelete}
        labels={tableLabels}
      />
    </>
  );
}
