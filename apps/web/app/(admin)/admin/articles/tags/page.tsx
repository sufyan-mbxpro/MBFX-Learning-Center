import { getTranslations } from "next-intl/server";
import { loadArticleTagsAdmin } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { requireAnyPermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { ArticlesSubnav } from "../_components/articles-subnav.tsx";
import { articlesSubnavItems } from "../_components/subnav-items.ts";
import { TagsManager } from "./tag-controls.tsx";

export default async function ArticleTagsPage() {
  await requireAnyPermission(["analysis.view", "news.manage"]);
  const [t, tags, locales] = await Promise.all([
    getTranslations("admin"),
    loadArticleTagsAdmin(),
    getActiveLocales(),
  ]);

  const labels = {
    name: t("nameLabel"),
    slug: t("slugLabel"),
    locale: t("localeLabel"),
    save: t("save"),
    saved: t("saved"),
    newTag: t("newTag"),
    newTagDescription: t("dialogDesc.newTag"),
    editDescription: t("dialogDesc.editTag"),
    edit: t("edit"),
    delete: t("delete"),
    cancel: t("cancel"),
    confirm: t("confirm"),
    activeLabel: t("activeLabel"),
    articleCount: t("articleCountLabel"),
    confirmDeleteTitle: t("confirmDeleteTagTitle"),
    confirmDeleteBody: t("confirmDeleteTagBody"),
    translations: t("translations"),
    emptyTitle: t("tagsTable"),
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
    <AdminPage title={t("articleTags")} description={t("pageDesc.articleTags")}>
      <ArticlesSubnav
        items={articlesSubnavItems({
          articles: t("articles"),
          categories: t("articleCategories"),
          tags: t("articleTags"),
          media: t("websiteMedia"),
          settings: t("settings"),
        })}
      />
      <TagsManager
        tags={tags}
        locales={locales.map((l) => ({ code: l.code, label: `${l.name} (${l.nativeName})` }))}
        labels={labels}
      />
    </AdminPage>
  );
}
