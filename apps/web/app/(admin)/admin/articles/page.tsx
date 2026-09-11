import { getTranslations } from "next-intl/server";
import { listArticlesAdmin, loadArticleCategoriesAdmin, type ListArticlesParams } from "@repo/core";
import { articleKindSchema, articleSortBySchema, articleStatusFilterSchema } from "@repo/contracts";
import { can, requireAnyPermission } from "@repo/rbac";
import { AdminPage } from "../_components/admin-page.tsx";
import { ArticlesSubnav } from "./_components/articles-subnav.tsx";
import { articlesSubnavItems } from "./_components/subnav-items.ts";
import { ArticlesToolbar, NewArticleDialog } from "./articles-controls.tsx";
import { ArticlesTable, type ArticlesTableLabels } from "./articles-table.tsx";

const PAGE_SIZE = 10;

// News & Analysis admin list (Module 15): shared DataTable, server-driven —
// search/sort/page state lives in the URL. Kind-specific write gates live
// in the service; this page only computes UX flags (a hidden button is not
// security).
export default async function ArticlesAdminPage({ searchParams }: PageProps<"/admin/articles">) {
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

  const listParams: ListArticlesParams = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sortBy.success ? sortBy.data : undefined,
    sortDir,
    search,
    kind: kind.success ? kind.data : undefined,
    status: status.success ? status.data : undefined,
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

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
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

  return (
    <AdminPage
      title={t("articles")}
      description={t("pageDesc.articles")}
      actions={
        flags.canCreate ? (
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
        ) : undefined
      }
    >
      <ArticlesSubnav
        items={articlesSubnavItems({
          articles: t("articles"),
          categories: t("articleCategories"),
          tags: t("articleTags"),
          media: t("websiteMedia"),
          settings: t("settings"),
        })}
      />

      {/* changes-08 #7: the filters render INSIDE the table's toolbar,
          on the same row as "Search articles", instead of in a separate
          bar above it. */}
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
              ? dateFormat.format(row.scheduledFor)
              : null,
          isActive: row.isActive,
          isFeatured: row.isFeatured,
          legalTransitions: row.legalTransitions,
          publishedAtLabel: row.publishedAt ? dateFormat.format(row.publishedAt) : null,
          updatedAtLabel: dateFormat.format(row.updatedAt),
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
    </AdminPage>
  );
}
