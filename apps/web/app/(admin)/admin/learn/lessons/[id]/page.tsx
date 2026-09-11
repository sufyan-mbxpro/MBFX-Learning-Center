import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  listQuizzesAdmin,
  loadCourseAdminDetail,
  loadCourseCurriculum,
  loadLessonAdminDetail,
} from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../../_components/admin-page.tsx";
import { richTextLabels } from "../../../_components/editor-labels.ts";
import { learnLabelMaps } from "../../_lib/learn-labels.ts";
import { LessonEditor } from "./lesson-editor.tsx";
import type { LessonEditorLabels } from "./editor-types.ts";

// Lesson editor (changes-11 PR 3.4). Read gate here; every write re-gates in
// its own action (security.md #1).
export default async function LessonEditPage({ params }: PageProps<"/admin/learn/lessons/[id]">) {
  const subject = await requirePermission("lessons.view");
  const { id } = await params;

  const [t, detail] = await Promise.all([getTranslations("admin"), loadLessonAdminDetail(id)]);
  if (!detail) notFound();

  // The course is loaded only AFTER the lesson resolves — the section list and
  // the course slug both hang off it, and loading them speculatively for a
  // 404'd id would be two wasted queries.
  const [course, curriculum, quizzes] = await Promise.all([
    loadCourseAdminDetail(detail.courseId),
    loadCourseCurriculum(detail.courseId),
    listQuizzesAdmin(),
  ]);

  const maps = learnLabelMaps(t);
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  const courseSlug =
    course?.translations.find((tr) => tr.locale === routing.defaultLocale)?.slug ??
    course?.translations[0]?.slug ??
    "";

  const defaultTranslation =
    detail.translations.find((tr) => tr.locale === routing.defaultLocale) ?? detail.translations[0];

  const labels: LessonEditorLabels = {
    updateLesson: t("updateLesson"),
    saved: t("saved"),
    viewLive: t("viewLive"),
    openActions: t("openActions"),
    duplicate: t("duplicate"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("confirmDeleteLessonTitle"),
    confirmDeleteBody: t("confirmDeleteLessonBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),

    bodySection: t("lessonBodySection"),
    bodySectionDescription: t("lessonBodySectionDescription"),
    localeLabel: t("localeLabel"),
    titleLabel: t("titleLabel"),
    slugLabel: t("slugLabel"),
    lessonUrl: t("postUrlLabel"),
    summaryLabel: t("summaryLabel"),
    bodyLabel: t("bodyLabel"),

    placementSection: t("placementSection"),
    placementSectionDescription: t("placementSectionDescription"),
    courseLabel: t("courseCol"),
    sectionLabel: t("sectionCol"),
    prerequisiteLabel: t("prerequisiteLabel"),
    noPrerequisite: t("noPrerequisite"),

    settingsSection: t("lessonSettingsSection"),
    settingsSectionDescription: t("lessonSettingsSectionDescription"),
    difficultyLabel: t("difficultyLabel"),
    visibilityLabel: t("visibility"),
    estimatedMinutesLabel: t("estimatedMinutesLabel"),
    completionRuleLabel: t("completionRuleLabel"),
    isRequiredLabel: t("isRequiredLabel"),
    isRequiredHint: t("isRequiredHint"),
    quizLabel: t("quizzes.attachTitle"),
    quizHint: t("quizzes.attachDescription"),
    noQuiz: t("quizzes.attachNone"),
    quizPassNeedsQuiz: t("quizPassNeedsQuiz"),

    seoSection: t("seoSection"),
    seoSectionDescription: t("seoSectionDescription"),
    seoTitleLabel: t("seoTitleLabel"),
    seoTitleHint: t("seoTitleHint"),
    seoDescriptionLabel: t("seoDescriptionLabel"),
    seoDescriptionHint: t("seoDescriptionHint"),
    focusKeywordsLabel: t("focusKeywordsLabel"),
    focusKeywordsHint: t("focusKeywordsHint"),

    infoSection: t("lessonInfoSection"),
    infoSectionDescription: t("lessonInfoSectionDescription"),
    idLabel: t("idLabel"),
    createdLabel: t("createdLabel"),
    updatedLabel: t("updatedLabel"),

    difficulties: maps.difficulties,
    visibilities: maps.visibilities,
    completionRules: maps.completionRules,
    statusLabels: maps.statuses,

    status: {
      section: t("publishingSection"),
      description: t("publishingSectionDescription"),
      hint: t("publishingHint"),
      exhausted: t("transitionsExhausted"),
      statusLabel: t("statusLabel"),
      statusLabels: maps.statuses,
      transitions: maps.transitions,
      publishedLabel: t("publishedLabel"),
      scheduledLabel: t("scheduledLabel"),
      scheduleFor: t("scheduleForLabel"),
      presetPlusHour: t("schedulePlusHour"),
      presetTomorrow9: t("scheduleTomorrow9"),
      presetNextWeek: t("scheduleNextWeek"),
      presetClear: t("scheduleClear"),
      updatedLabel: t("updatedLabel"),
      confirmArchiveTitle: t("confirmArchiveLessonTitle"),
      confirmArchiveBody: t("confirmArchiveLessonBody"),
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
    resources: {
      section: t("resourcesSection"),
      sectionDescription: t("resourcesSectionDescription"),
      heroImageLabel: t("heroImageLabel"),
      videoUrlLabel: t("videoUrlLabel"),
      videoInvalid: t("videoUrlInvalid"),
      externalUrlLabel: t("externalUrlLabel"),
      externalUrlHint: t("externalUrlHint"),
      attachmentsLabel: t("attachmentsLabel"),
      addAttachment: t("addAttachment"),
      noAttachments: t("noAttachments"),
      attachmentLabelField: t("attachmentLabelField"),
      attachmentLabelHint: t("attachmentLabelHint"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
      remove: t("remove"),
      pickerTitle: t("mediaPickerTitle"),
      capabilityWarning: t("lessonCapabilityWarning"),
      kindBadge: t("lessonKindBadge"),
      kindReading: t("lessonKindReading"),
      kindVideo: t("lessonKindVideo"),
      kindExternal: t("lessonKindExternal"),
      kindDownload: t("lessonKindDownload"),
      confirmRemoveTitle: t("confirmRemoveAttachmentTitle"),
      confirmRemoveBody: t("confirmRemoveAttachmentBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
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
    },
    objectives: {
      section: t("objectivesSection"),
      sectionDescription: t("objectivesSectionDescription"),
      add: t("addObjective"),
      objectiveLabel: t("objectiveLabel"),
      empty: t("noObjectives"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
      remove: t("remove"),
      confirmRemoveTitle: t("confirmRemoveObjectiveTitle"),
      confirmRemoveBody: t("confirmRemoveObjectiveBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
    },
    editor: richTextLabels(t),
  };

  return (
    <AdminPage
      title={defaultTranslation?.title || t("untitled")}
      description={t("pageDesc.lessonDetail")}
      backHref={`/admin/learn/courses/${detail.courseId}`}
      backLabel={t("backToCourse")}
    >
      <LessonEditor
        lesson={{
          id: detail.id,
          sectionId: detail.sectionId,
          courseId: detail.courseId,
          courseTitle: detail.courseTitle,
          courseSlug,
          status: detail.status,
          difficulty: detail.difficulty,
          estimatedMinutes: detail.estimatedMinutes === null ? "" : String(detail.estimatedMinutes),
          videoUrl: detail.videoUrl ?? "",
          externalUrl: detail.externalUrl ?? "",
          heroAssetId: detail.heroAssetId,
          heroUrl: detail.heroUrl,
          completionRule: detail.completionRule,
          isRequired: detail.isRequired,
          quizId: detail.quizId,
          prerequisiteLessonId: detail.prerequisiteLessonId,
          visibility: detail.visibility,
          publishedAt: detail.publishedAt ? dateFormat.format(detail.publishedAt) : null,
          scheduledFor: detail.scheduledFor ? dateFormat.format(detail.scheduledFor) : null,
          createdAt: dateFormat.format(detail.createdAt),
          updatedAt: dateFormat.format(detail.updatedAt),
          deleted: detail.deletedAt !== null,
          translations: detail.translations.map((tr) => ({
            locale: tr.locale,
            title: tr.title,
            slug: tr.slug,
            summary: tr.summary ?? "",
            content: tr.content ?? "",
            learningObjectives: tr.learningObjectives,
            seoTitle: tr.seoTitle ?? "",
            seoDescription: tr.seoDescription ?? "",
            seoFocusKeyword: tr.seoFocusKeyword ?? "",
            translationStatus: tr.translationStatus,
          })),
          attachments: detail.attachments.map((attachment) => ({
            assetId: attachment.assetId,
            label: attachment.label ?? "",
            fileName: attachment.fileName,
            url: attachment.url,
          })),
          legalTransitions: detail.legalTransitions,
        }}
        sections={curriculum.map((section) => ({
          id: section.id,
          title: section.title,
          lessonCount: section.lessons.length,
        }))}
        // A lesson may not be its own prerequisite, and only lessons in the
        // SAME course are offered: a prerequisite in another course would gate
        // this one on material a learner never sees on the way here.
        prerequisiteOptions={curriculum
          .flatMap((section) => section.lessons)
          .filter((lesson) => lesson.id !== detail.id)
          .map((lesson) => ({ id: lesson.id, title: lesson.title || t("untitled") }))}
        // Every quiz, not only the standalone ones: a lesson checkpoint is
        // precisely the kind that is NOT listed publicly (ADR-058 #1).
        quizOptions={quizzes.map((quiz) => ({
          id: quiz.id,
          title: quiz.title || t("untitled"),
        }))}
        locales={[...routing.locales]}
        defaultLocale={routing.defaultLocale}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        canUpdate={can(subject, "lessons.update")}
        canPublish={can(subject, "lessons.publish")}
        canCreate={can(subject, "lessons.create")}
        canDelete={can(subject, "lessons.delete")}
        labels={labels}
      />
    </AdminPage>
  );
}
