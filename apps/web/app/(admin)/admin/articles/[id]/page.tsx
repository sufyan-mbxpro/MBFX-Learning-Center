import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  articleKindPermission,
  listArticlesAdmin,
  loadArticleAdminDetail,
  loadArticleCategoriesAdmin,
  loadArticleTagsAdmin,
} from "@repo/core";
import { can, requireAnyPermission } from "@repo/rbac";
import { routing } from "@repo/i18n/routing";
import { AdminPage } from "../../_components/admin-page.tsx";
import { richTextLabels } from "../../_components/editor-labels.ts";
import { ArticlesSubnav } from "../_components/articles-subnav.tsx";
import { articlesSubnavItems } from "../_components/subnav-items.ts";
import { ArticleEditor } from "./article-editor.tsx";
import type { TranslationDraft } from "./editor-types.ts";

// Article editor v2 (changes-07 PRs 4–6). Rebuilt to the reference screen's
// information architecture; the kind-specific and publish gates still live in
// the service, and the flags computed here only shape the UI — a hidden button
// is not security (security.md #1).
export default async function ArticleEditPage({ params }: PageProps<"/admin/articles/[id]">) {
  const subject = await requireAnyPermission(["analysis.view", "news.manage"]);
  const { id } = await params;

  const [t, detail, categories, tags] = await Promise.all([
    getTranslations("admin"),
    loadArticleAdminDetail(id),
    loadArticleCategoriesAdmin(),
    loadArticleTagsAdmin(),
  ]);
  if (!detail) notFound();

  const canPublish = can(subject, articleKindPermission(detail.kind, "publish"));
  const canDelete = can(subject, articleKindPermission(detail.kind, "delete"));
  const canCreate = can(subject, "analysis.create") || can(subject, "news.manage");

  // Candidates for the Related Posts picker. Capped rather than unbounded —
  // the picker is a select, not a search, and a 500-row select is unusable.
  const candidates = await listArticlesAdmin({
    page: 0,
    pageSize: 100,
    sortBy: "updatedAt",
    sortDir: "desc",
  });
  const relatedOptions = candidates.rows
    .filter((row) => row.id !== detail.id && row.deletedAt === null)
    .map((row) => ({ id: row.id, title: row.title ?? t("untitled") }));

  const enTitle = detail.translations.find((tr) => tr.locale === routing.defaultLocale)?.title;
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  // DB nulls → "" at this boundary: the editor's fields are controlled inputs,
  // and the save maps "" back to null on the way out.
  const translations: TranslationDraft[] = detail.translations.map((tr) => ({
    locale: tr.locale,
    title: tr.title,
    slug: tr.slug,
    excerpt: tr.excerpt ?? "",
    body: tr.body ?? "",
    seoTitle: tr.seoTitle ?? "",
    seoDescription: tr.seoDescription ?? "",
    ogImageUrl: tr.ogImageUrl ?? "",
    ogImageAssetId: tr.ogImageAssetId,
    canonicalUrl: tr.canonicalUrl ?? "",
    noIndex: tr.noIndex,
    focusKeywords: tr.focusKeywords ?? "",
    noFollow: tr.noFollow,
    ogTitle: tr.ogTitle ?? "",
    ogDescription: tr.ogDescription ?? "",
    twitterCard: tr.twitterCard ?? "",
    twitterImageUrl: tr.twitterImageUrl ?? "",
    twitterImageAssetId: tr.twitterImageAssetId,
    faqItems: tr.faqItems.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
    translationStatus: tr.translationStatus,
  }));

  const statusLabels: Record<string, string> = {
    DRAFT: t("statusDraft"),
    IN_REVIEW: t("statusInReview"),
    SCHEDULED: t("statusScheduled"),
    PUBLISHED: t("statusPublished"),
    ARCHIVED: t("statusArchived"),
    OUTDATED: t("statusOutdated"),
    TRANSLATED: t("statusPublished"),
    NEEDS_REVIEW: t("statusInReview"),
  };

  return (
    <AdminPage title={enTitle ?? t("untitled")} description={t("editPostDescription")}>
      <ArticlesSubnav
        items={articlesSubnavItems({
          articles: t("articles"),
          categories: t("articleCategories"),
          tags: t("articleTags"),
          media: t("websiteMedia"),
          settings: t("settings"),
        })}
      />
      <ArticleEditor
        article={{
          id: detail.id,
          kind: detail.kind,
          status: detail.status,
          isActive: detail.isActive,
          isPremium: detail.isPremium,
          isFeatured: detail.isFeatured,
          coverImageUrl: detail.coverImageUrl,
          coverImageAssetId: detail.coverImageAssetId,
          headerImageUrl: detail.headerImageUrl,
          headerImageAssetId: detail.headerImageAssetId,
          videoUrl: detail.videoUrl,
          showRelated: detail.showRelated,
          relatedCount: detail.relatedCount,
          categoryId: detail.categoryId,
          source: detail.source,
          sourceUrl: detail.sourceUrl,
          publishedAt: detail.publishedAt ? dateFormat.format(detail.publishedAt) : null,
          updatedAt: dateFormat.format(detail.updatedAt),
          deleted: detail.deletedAt !== null,
          tagIds: detail.tagIds,
          relatedArticleIds: detail.relatedArticleIds,
          translations,
          legalTransitions: detail.legalTransitions,
        }}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name ?? c.id,
          count: c.articleCount,
        }))}
        tags={tags.map((tag) => ({
          id: tag.id,
          name: tag.name ?? tag.id,
          count: tag.articleCount,
        }))}
        relatedOptions={relatedOptions}
        locales={[...routing.locales]}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        defaultLocale={routing.defaultLocale}
        canPublish={canPublish}
        canDelete={canDelete}
        canCreate={canCreate}
        labels={{
          kinds: {
            NEWS: t("kindNews"),
            ANALYSIS: t("kindAnalysis"),
            TRADE_IDEA: t("kindTradeIdea"),
          },
          statusLabels,

          cancel: t("cancel"),
          confirm: t("confirm"),
          previewDraft: t("previewDraft"),
          viewLive: t("viewLive"),
          updatePost: t("updatePost"),
          publishPost: t("publishPost"),
          publishedToast: t("publishedToast"),
          openActions: t("openActions"),
          duplicate: t("duplicate"),
          softDelete: t("softDelete"),
          restore: t("restore"),
          confirmDeleteTitle: t("confirmDeleteArticleTitle"),
          confirmDeleteBody: t("confirmDeleteArticleBody"),
          saved: t("saved"),

          content: t("contentSection"),
          contentDescription: t("contentSectionDescription"),
          localeLabel: t("localeLabel"),
          titleLabel: t("titleLabel"),
          slugLabel: t("slugLabel"),
          postUrl: t("postUrlLabel"),
          body: t("articleBodyLabel"),
          excerpt: t("excerptLabel"),

          seoSection: t("seoSection"),
          seoSectionDescription: t("seoSectionDescription"),
          seoTabBasic: t("seoTabBasic"),
          seoTabSocial: t("seoTabSocial"),
          seoTabAdvanced: t("seoTabAdvanced"),
          seoTabAnalysis: t("seoTabAnalysis"),
          seoTitle: t("seoTitleLabel"),
          seoTitleHint: t("seoTitleHint"),
          seoDescription: t("seoDescriptionLabel"),
          seoDescriptionHint: t("seoDescriptionHint"),
          focusKeywords: t("focusKeywordsLabel"),
          focusKeywordsHint: t("focusKeywordsHint"),
          canonicalUrl: t("canonicalUrlLabel"),
          canonicalUrlHint: t("canonicalUrlHint"),
          canonicalDefault: t("canonicalDefault"),
          allowIndex: t("allowIndexLabel"),
          allowFollow: t("allowFollowLabel"),
          ogTitle: t("ogTitleLabel"),
          ogDescription: t("ogDescriptionLabel"),
          ogImageUrl: t("ogImageLabel"),
          twitterCard: t("twitterCardLabel"),
          twitterCardOptions: {
            summary: t("twitterCardSummary"),
            summary_large_image: t("twitterCardLargeImage"),
          },
          twitterImage: t("twitterImageLabel"),
          robotsSummaryHint: t("robotsSummaryHint"),
          robotsIndexRow: t("robotsIndexRow"),
          robotsFollowRow: t("robotsFollowRow"),

          postSettings: t("postSettingsSection"),
          postSettingsDescription: t("postSettingsSectionDescription"),
          mediaTabImage: t("mediaTabImage"),
          mediaTabVideo: t("mediaTabVideo"),
          coverImageUrl: t("coverImageLabel"),
          videoUrl: t("videoUrlLabel"),
          videoInvalid: t("videoUrlInvalid"),
          headerImage: t("headerImageLabel"),
          headerImageHint: t("headerImageHint"),
          featuredPost: t("featuredPostLabel"),
          activeLabel: t("activeLabel"),
          premium: t("premiumLabel"),
          premiumHint: t("premiumHint"),

          postInfo: t("postInfoSection"),
          postInfoDescription: t("postInfoSectionDescription"),
          kind: t("kind"),
          createdLabel: t("createdLabel"),
          createdValue: dateFormat.format(detail.createdAt),
          updatedLabel: t("updatedLabel"),
          idLabel: t("idLabel"),
          sourceLabel: t("sourceLabel"),
          sourceUrlLabel: t("sourceUrlLabel"),

          stats: {
            words: t("wordsLabel"),
            characters: t("charactersLabel"),
            readingTime: t("readingTimeLabel"),
            minutesSuffix: t("minutesSuffix"),
            keywords: t("keywordsLabel"),
            densityTitle: t("keywordDensityLabel"),
            densityHint: t("keywordDensityHint"),
            densityEmpty: t("keywordDensityEmpty"),
          },
          analysis: {
            score: t("seoScoreLabel"),
            checks: {
              titleLength: t("seoCheckTitleLength"),
              descriptionLength: t("seoCheckDescriptionLength"),
              focusKeywordInTitle: t("seoCheckKeywordInTitle"),
              focusKeywordInDescription: t("seoCheckKeywordInDescription"),
              focusKeywordInFirstParagraph: t("seoCheckKeywordEarly"),
              contentLength: t("seoCheckContentLength"),
              hasSubheadings: t("seoCheckSubheadings"),
              hasImages: t("seoCheckImages"),
              hasInternalLink: t("seoCheckInternalLink"),
            },
          },
          faq: {
            section: t("faqSection"),
            description: t("faqSectionDescription"),
            emptyTitle: t("faqEmptyTitle"),
            emptyBody: t("faqEmptyBody"),
            add: t("addFaq"),
            addFirst: t("addFirstFaq"),
            edit: t("editFaq"),
            dialogDescription: t("faqDialogDescription"),
            answerHint: t("faqAnswerHint"),
            saveItem: t("faqSaveItem"),
            unanswered: t("faqUnanswered"),
            question: t("questionLabel"),
            answer: t("answerLabel"),
            remove: t("remove"),
            cancel: t("cancel"),
            confirm: t("confirm"),
            confirmRemoveTitle: t("confirmRemoveFaqTitle"),
            confirmRemoveBody: t("confirmRemoveFaqBody"),
            moveUp: t("moveUp"),
            moveDown: t("moveDown"),
          },
          related: {
            section: t("relatedPostsSection"),
            description: t("relatedPostsSectionDescription"),
            countSuffix: t("relatedPostsSection"),
            hint: t("relatedPostsHint"),
            emptyTitle: t("relatedEmptyTitle"),
            emptyBody: t("relatedEmptyBody"),
            addLabel: t("addRelatedPosts"),
            addPlaceholder: t("selectPlaceholder"),
            remove: t("remove"),
            moveUp: t("moveUp"),
            moveDown: t("moveDown"),
            settingsSection: t("relatedSettingsSection"),
            settingsDescription: t("relatedSettingsSectionDescription"),
            showRelated: t("showRelatedLabel"),
            relatedCount: t("relatedCountLabel"),
            postsSuffix: t("postsSuffix"),
          },
          publish: {
            section: t("publishSection"),
            description: t("publishSectionDescription"),
            hint: t("publishHint"),
            statusLabel: t("statusLabel"),
            statusLabels,
            publishedLabel: t("publishedLabel"),
            updatedLabel: t("updatedLabel"),
            scheduleFor: t("scheduleForLabel"),
            transitions: {
              PUBLISHED: t("publishNow"),
              SCHEDULED: t("scheduleAction"),
              DRAFT: t("revertToDraft"),
              ARCHIVED: t("archiveAction"),
            },
            presetPlusHour: t("schedulePlusHour"),
            presetTomorrow9: t("scheduleTomorrow9"),
            presetNextWeek: t("scheduleNextWeek"),
            presetClear: t("scheduleClear"),
            confirmArchiveTitle: t("confirmArchiveArticleTitle"),
            confirmArchiveBody: t("confirmArchiveArticleBody"),
            confirm: t("confirm"),
            cancel: t("cancel"),
          },
          taxonomy: {
            categoriesSection: t("articleCategories"),
            categoriesDescription: t("categoriesSectionDescription"),
            tagsSection: t("articleTags"),
            tagsDescription: t("tagsSectionDescription"),
            category: t("categoryLabel"),
            noTags: t("noResults"),
            addCategory: t("addCategory"),
            addTag: t("addTag"),
            newCategory: t("newCategory"),
            newTag: t("newTag"),
            name: t("nameLabel"),
            tagName: t("tagName"),
            slugOptional: t("slugOptional"),
            description: t("descriptionLabel"),
            create: t("create"),
            cancel: t("cancel"),
            categoryCreated: t("categoryCreated"),
            tagCreated: t("tagCreated"),
            search: t("taxonomySearch"),
          },
          editor: richTextLabels(t),
          upload: {
            upload: t("uploadImage"),
            replace: t("replaceImage"),
            remove: t("removeImage"),
            uploading: t("uploading"),
            hint: t("uploadHint"),
            cancel: t("cancel"),
            confirmRemoveTitle: t("confirmRemoveImageTitle"),
            confirmRemoveBody: t("confirmRemoveImageBody"),
          },
        }}
      />
    </AdminPage>
  );
}
