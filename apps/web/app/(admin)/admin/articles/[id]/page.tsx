import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  loadArticleAdminDetail,
  loadArticleCategoriesAdmin,
  loadArticleTagsAdmin,
} from "@repo/core";
import { articleKindPermission } from "@repo/core";
import { can, requireAnyPermission } from "@repo/rbac";
import { routing } from "@repo/i18n/routing";
import { AdminPage } from "../../_components/admin-page.tsx";
import { ArticlesSubnav } from "../_components/articles-subnav.tsx";
import { articlesSubnavItems } from "../_components/subnav-items.ts";
import { ArticleEditor } from "./article-editor.tsx";

// Article editor (Module 15). Textarea-first per ADR-009 — swapping in the
// Tiptap widget later changes zero server code. The kind-specific and
// publish gates live in the service; flags here only shape the UI.
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

  const enTitle = detail.translations.find((tr) => tr.locale === "en")?.title;
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  return (
    <AdminPage title={enTitle ?? t("untitled")} width="full">
      <ArticlesSubnav
        items={articlesSubnavItems({
          articles: t("articles"),
          categories: t("articleCategories"),
          tags: t("articleTags"),
          settings: t("settings"),
        })}
      />
      <ArticleEditor
        article={{
          ...detail,
          scheduledFor: detail.scheduledFor?.toISOString() ?? null,
          publishedAt: detail.publishedAt ? dateFormat.format(detail.publishedAt) : null,
          updatedAt: dateFormat.format(detail.updatedAt),
          deleted: detail.deletedAt !== null,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name ?? c.id }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name ?? tag.id }))}
        locales={[...routing.locales]}
        canPublish={canPublish}
        canDelete={canDelete}
        labels={{
          kinds: {
            NEWS: t("kindNews"),
            ANALYSIS: t("kindAnalysis"),
            TRADE_IDEA: t("kindTradeIdea"),
          },
          content: t("contentSection"),
          titleLabel: t("titleLabel"),
          slugLabel: t("slugLabel"),
          excerpt: t("excerptLabel"),
          body: t("articleBodyLabel"),
          localeLabel: t("localeLabel"),
          seoSection: t("seoSection"),
          seoTitle: t("seoTitleLabel"),
          seoDescription: t("seoDescriptionLabel"),
          ogImageUrl: t("ogImageLabel"),
          canonicalUrl: t("canonicalUrlLabel"),
          noIndex: t("noIndexLabel"),
          saveTranslation: t("save"),
          saved: t("saved"),
          publishSection: t("publishSection"),
          statusLabel: t("statusLabel"),
          publishedLabel: t("publishedLabel"),
          updatedLabel: t("updatedLabel"),
          scheduleFor: t("scheduleForLabel"),
          statusLabels: {
            DRAFT: t("statusDraft"),
            IN_REVIEW: t("statusInReview"),
            SCHEDULED: t("statusScheduled"),
            PUBLISHED: t("statusPublished"),
            ARCHIVED: t("statusArchived"),
            OUTDATED: t("statusOutdated"),
          },
          transitions: {
            PUBLISHED: t("publishNow"),
            SCHEDULED: t("scheduleAction"),
            DRAFT: t("revertToDraft"),
            ARCHIVED: t("archiveAction"),
          },
          previewDraft: t("previewDraft"),
          softDelete: t("softDelete"),
          restore: t("restore"),
          confirmDeleteTitle: t("confirmDeleteArticleTitle"),
          confirmDeleteBody: t("confirmDeleteArticleBody"),
          confirm: t("confirm"),
          cancel: t("cancel"),
          organizationSection: t("organizationSection"),
          kind: t("kind"),
          category: t("categoryLabel"),
          tags: t("articleTags"),
          mediaSection: t("mediaSection"),
          coverImageUrl: t("coverImageLabel"),
          videoUrl: t("videoUrlLabel"),
          videoInvalid: t("videoUrlInvalid"),
          advancedSection: t("advancedSection"),
          premium: t("premiumLabel"),
          premiumHint: t("premiumHint"),
          activeLabel: t("activeLabel"),
          sourceLabel: t("sourceLabel"),
          sourceUrlLabel: t("sourceUrlLabel"),
          saveMeta: t("save"),
          editor: {
            bold: t("editorBold"),
            italic: t("editorItalic"),
            underline: t("editorUnderline"),
            strike: t("editorStrike"),
            heading2: t("editorHeading2"),
            heading3: t("editorHeading3"),
            bulletList: t("editorBulletList"),
            orderedList: t("editorOrderedList"),
            blockquote: t("editorBlockquote"),
            codeBlock: t("editorCodeBlock"),
            link: t("editorLink"),
            unlink: t("editorUnlink"),
            image: t("editorImage"),
            horizontalRule: t("editorHorizontalRule"),
            undo: t("editorUndo"),
            redo: t("editorRedo"),
            linkPrompt: t("editorLinkPrompt"),
            placeholder: t("editorPlaceholder"),
          },
          upload: {
            upload: t("uploadImage"),
            replace: t("replaceImage"),
            remove: t("removeImage"),
            uploading: t("uploading"),
            hint: t("uploadHint"),
          },
        }}
      />
    </AdminPage>
  );
}
