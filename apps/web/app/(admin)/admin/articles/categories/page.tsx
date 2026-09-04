import { getTranslations } from "next-intl/server";
import { loadArticleCategoriesAdmin } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { requireAnyPermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { ArticlesSubnav } from "../_components/articles-subnav.tsx";
import { articlesSubnavItems } from "../_components/subnav-items.ts";
import { CategoriesManager } from "./category-controls.tsx";

// Article categories (Module 15, changes-02): a data table with a Create
// button that opens a modal, and a row action that opens the same modal
// for editing. Deletion is guarded in the service — a category with
// articles throws CategoryInUseError (surfaced as a toast).
export default async function ArticleCategoriesPage() {
  await requireAnyPermission(["analysis.view", "news.manage"]);
  const [t, categories, locales] = await Promise.all([
    getTranslations("admin"),
    loadArticleCategoriesAdmin(),
    getActiveLocales(),
  ]);

  const labels = {
    name: t("nameLabel"),
    slug: t("slugLabel"),
    locale: t("localeLabel"),
    description: t("descriptionLabel"),
    seoTitle: t("seoTitleLabel"),
    seoDescription: t("seoDescriptionLabel"),
    seoOptional: t("seoOptional"),
    sortOrder: t("sortOrderLabel"),
    save: t("save"),
    saved: t("saved"),
    create: t("create"),
    newCategory: t("newCategory"),
    edit: t("edit"),
    delete: t("delete"),
    cancel: t("cancel"),
    confirm: t("confirm"),
    activeLabel: t("activeLabel"),
    articleCount: t("articleCountLabel"),
    confirmDeleteTitle: t("confirmDeleteCategoryTitle"),
    confirmDeleteBody: t("confirmDeleteCategoryBody"),
    translations: t("translations"),
    emptyTitle: t("categoriesTable"),
    noResults: t("noResults"),
    search: t("searchArticles"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    actionsCol: t("actionsCol"),
  };

  return (
    <AdminPage title={t("articleCategories")} width="lg">
      <ArticlesSubnav
        items={articlesSubnavItems({
          articles: t("articles"),
          categories: t("articleCategories"),
          tags: t("articleTags"),
          settings: t("settings"),
        })}
      />
      <CategoriesManager
        categories={categories}
        locales={locales.map((l) => ({ code: l.code, label: `${l.name} (${l.nativeName})` }))}
        labels={labels}
      />
    </AdminPage>
  );
}
