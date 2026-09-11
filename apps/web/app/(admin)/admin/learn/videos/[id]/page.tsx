import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getVideoTopicAdmin, listVideoCategoriesAdmin } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../../_components/admin-page.tsx";
import { richTextLabels } from "../../../_components/editor-labels.ts";
import {
  contentStatusLabels,
  trackLabels,
  transitionLabels,
  visibilityLabels,
} from "../../_lib/learn-labels.ts";
import { VideoEditor } from "./video-editor.tsx";
import type { VideoEditorLabels } from "./editor-types.ts";

// Video topic editor (changes-16 PR 6, ADR-068).
//
// Read gate here; every write re-gates in its own action (security.md #1).
// **`lessons.*`, not `videos.*`** — ADR-068 §3.
export default async function VideoTopicEditPage({
  params,
}: PageProps<"/admin/learn/videos/[id]">) {
  const subject = await requirePermission("lessons.view");
  const { id } = await params;

  const [t, detail, categories, activeLocales] = await Promise.all([
    getTranslations("admin"),
    getVideoTopicAdmin(id),
    listVideoCategoriesAdmin(),
    getActiveLocales(),
  ]);
  if (!detail) notFound();

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
  const statusLabels = contentStatusLabels(t);
  const tracks = trackLabels(t);

  const defaultTranslation =
    detail.translations.find((tr) => tr.locale === routing.defaultLocale) ?? detail.translations[0];

  const labels: VideoEditorLabels = {
    updateTopic: t("videoEditor.updateTopic"),
    saved: t("saved"),
    viewLive: t("viewLive"),
    openActions: t("openActions"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("videos.confirmDeleteTitle"),
    confirmDeleteBody: t("videos.confirmDeleteBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),

    bodySection: t("videoEditor.bodySection"),
    bodySectionDescription: t("videoEditor.bodySectionDescription"),
    localeLabel: t("localeLabel"),
    titleLabel: t("videos.titleLabel"),
    slugLabel: t("slugLabel"),
    topicUrl: t("postUrlLabel"),
    summaryLabel: t("videoEditor.summaryLabel"),
    summaryHint: t("videoEditor.summaryHint"),
    contentLabel: t("videoEditor.contentLabel"),
    contentHint: t("videoEditor.contentHint"),
    capabilityWarning: t("videoEditor.capabilityWarning"),

    filingSection: t("videoEditor.filingSection"),
    filingSectionDescription: t("videoEditor.filingSectionDescription"),
    trackLabel: t("trackLabel"),
    trackHint: t("videoEditor.trackHint"),
    categoryLabel: t("videos.categoryLabel"),
    categoryHint: t("videoEditor.categoryHint"),
    categoryNone: t("videos.uncategorised"),
    visibilityLabel: t("visibilityLabel"),
    coverLabel: t("videoEditor.coverLabel"),

    seoSection: t("seoSection"),
    seoSectionDescription: t("seoSectionDescription"),
    seoTitleLabel: t("seoTitleLabel"),
    seoTitleHint: t("seoTitleHint"),
    seoDescriptionLabel: t("seoDescriptionLabel"),
    seoDescriptionHint: t("seoDescriptionHint"),
    seoKeywordLabel: t("seoKeywordLabel"),
    seoKeywordHint: t("seoKeywordHint"),

    infoSection: t("videoEditor.infoSection"),
    infoSectionDescription: t("videoEditor.infoSectionDescription"),
    idLabel: t("idLabel"),
    createdLabel: t("createdLabel"),
    updatedLabel: t("updatedLabel"),

    tracks,
    visibilities: visibilityLabels(t),
    statusLabels,

    status: {
      section: t("publishingSection"),
      description: t("publishingSectionDescription"),
      hint: t("publishingHint"),
      exhausted: t("transitionsExhausted"),
      statusLabel: t("statusLabel"),
      statusLabels,
      transitions: transitionLabels(t),
      publishedLabel: t("publishedLabel"),
      scheduledLabel: t("scheduledLabel"),
      scheduleFor: t("scheduleForLabel"),
      presetPlusHour: t("schedulePlusHour"),
      presetTomorrow9: t("scheduleTomorrow9"),
      presetNextWeek: t("scheduleNextWeek"),
      presetClear: t("scheduleClear"),
      updatedLabel: t("updatedLabel"),
      confirmArchiveTitle: t("videoEditor.confirmArchiveTitle"),
      confirmArchiveBody: t("videoEditor.confirmArchiveBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
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
    videos: {
      section: t("videoEditor.videosSection"),
      description: t("videoEditor.videosSectionDescription"),
      emptyTitle: t("videoEditor.videosEmpty"),
      emptyBody: t("videoEditor.videosEmptyBody"),
      add: t("videoEditor.addVideo"),
      addFirst: t("videoEditor.addFirstVideo"),
      remove: t("remove"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
      sourceUpload: t("videoEditor.sourceUpload"),
      sourceExternal: t("videoEditor.sourceExternal"),
      chooseVideo: t("videoEditor.chooseVideo"),
      changeVideo: t("videoEditor.changeVideo"),
      choosePoster: t("videoEditor.choosePoster"),
      changePoster: t("videoEditor.changePoster"),
      removePoster: t("videoEditor.removePoster"),
      externalUrlLabel: t("videoEditor.externalUrlLabel"),
      externalUrlHint: t("videoEditor.externalUrlHint"),
      titleLabel: t("videoEditor.videoTitleLabel"),
      titleHint: t("videoEditor.videoTitleHint"),
      noSource: t("videoEditor.noSource"),
      pickVideoTitle: t("videoEditor.pickVideoTitle"),
      pickPosterTitle: t("videoEditor.pickPosterTitle"),
      confirmRemoveTitle: t("videoEditor.confirmRemoveVideoTitle"),
      confirmRemoveBody: t("videoEditor.confirmRemoveVideoBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
    },
    links: {
      section: t("videoEditor.linksSection"),
      description: t("videoEditor.linksSectionDescription"),
      emptyTitle: t("videoEditor.linksEmpty"),
      emptyBody: t("videoEditor.linksEmptyBody"),
      add: t("videoEditor.addLink"),
      addFirst: t("videoEditor.addFirstLink"),
      remove: t("remove"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
      labelLabel: t("videoEditor.linkLabelLabel"),
      internal: t("videoEditor.linkInternal"),
      external: t("videoEditor.linkExternal"),
      pathLabel: t("videoEditor.linkPathLabel"),
      pathHint: t("videoEditor.linkPathHint"),
      urlLabel: t("videoEditor.linkUrlLabel"),
      urlHint: t("videoEditor.linkUrlHint"),
      confirmRemoveTitle: t("videoEditor.confirmRemoveLinkTitle"),
      confirmRemoveBody: t("videoEditor.confirmRemoveLinkBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
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
  };

  return (
    <AdminPage
      title={defaultTranslation?.title || t("untitled")}
      description={t("pageDesc.videoDetail")}
      backHref="/admin/learn/videos"
      backLabel={t("videoEditor.backToList")}
    >
      <VideoEditor
        topic={{
          id: detail.id,
          status: detail.status,
          track: detail.track,
          categoryId: detail.categoryId,
          coverAssetId: detail.coverAssetId,
          coverUrl: detail.coverUrl,
          visibility: detail.visibility,
          publishedAt: detail.publishedAt ? dateFormat.format(detail.publishedAt) : null,
          scheduledFor: detail.scheduledFor ? dateFormat.format(detail.scheduledFor) : null,
          createdAt: dateFormat.format(detail.createdAt),
          updatedAt: dateFormat.format(detail.updatedAt),
          deleted: detail.deletedAt !== null,
          // Every stored field, in every locale, reaching the form as its
          // initial value — the prefill rule ADR-069 exists to enforce.
          translations: detail.translations.map((tr) => ({
            locale: tr.locale,
            title: tr.title,
            slug: tr.slug,
            summary: tr.summary ?? "",
            content: tr.content ?? "",
            seoTitle: tr.seoTitle ?? "",
            seoDescription: tr.seoDescription ?? "",
            seoFocusKeyword: tr.seoFocusKeyword ?? "",
            translationStatus: tr.translationStatus,
          })),
          videos: detail.videos.map((v) => ({
            id: v.id,
            assetId: v.assetId,
            assetUrl: v.assetUrl,
            externalUrl: v.externalUrl,
            posterAssetId: v.posterAssetId,
            posterUrl: v.posterUrl,
            title: v.title,
            sortOrder: v.sortOrder,
          })),
          links: detail.links.map((l) => ({ label: l.label, path: l.path, url: l.url })),
          legalTransitions: detail.legalTransitions,
        }}
        categoryOptions={categories.map((c) => ({ id: c.id, name: c.name || t("untitled") }))}
        locales={activeLocales.map((l) => l.code)}
        defaultLocale={routing.defaultLocale}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        canUpdate={can(subject, "lessons.update")}
        canPublish={can(subject, "lessons.publish")}
        canDelete={can(subject, "lessons.delete")}
        labels={labels}
      />
    </AdminPage>
  );
}
