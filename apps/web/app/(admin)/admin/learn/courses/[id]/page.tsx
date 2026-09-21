import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  listCoursesAdmin,
  listQuizzesAdmin,
  loadCourseAdminDetail,
  loadCourseCurriculum,
  resolveRecommendations,
} from "@repo/core";
import { LEARN_TRACK_KEYS } from "@repo/contracts";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { EditorPage } from "../../../_components/admin-page.tsx";
import { richTextLabels } from "../../../_components/editor-labels.ts";
import { loadEditorAi } from "../../../_lib/editor-ai.ts";
import { learnLabelMaps } from "../../_lib/learn-labels.ts";
import { CourseEditor } from "./course-editor.tsx";
import type { CourseEditorLabels } from "./editor-types.ts";
import { formatDateTime } from "@repo/utils";

// Course builder (changes-11 PRs 3.2/3.3). The read gate is here; every write
// re-gates inside its own action (security.md #1) — the `can()` results below
// only shape what renders.
export default async function CourseEditPage({ params }: PageProps<"/admin/learn/courses/[id]">) {
  const subject = await requirePermission("courses.view");
  const { id } = await params;

  const [t, detail, sections, allCourses, quizzes, ai] = await Promise.all([
    getTranslations("admin"),
    loadCourseAdminDetail(id),
    loadCourseCurriculum(id),
    listCoursesAdmin(),
    listQuizzesAdmin(),
    // ADR-126: the "Generate with AI" bar, each field's ✨ menu, and the
    // writing assistant on the description — each present only when available.
    loadEditorAi(subject, {
      module: "course",
      entity: { type: "course", id },
      contentKeys: ["courses.update"],
    }),
  ]);
  if (!detail) notFound();

  const maps = learnLabelMaps(t);

  // What a learner would actually be offered today: the curated set topped up
  // with same-track courses. Plan §8.2 asks for this preview so the editor is
  // not guessing what an empty list produces.
  const fallback = await resolveRecommendations(routing.defaultLocale, detail.id, detail.track, 3);

  const labels: CourseEditorLabels = {
    tabDetails: t("courseTabDetails"),
    tabCurriculum: t("courseTabCurriculum"),
    tabRecommendations: t("courseTabRecommendations"),
    tabSeo: t("courseTabSeo"),
    updateCourse: t("updateCourse"),
    saved: t("saved"),
    viewLive: t("viewLive"),
    openActions: t("openActions"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("confirmDeleteCourseTitle"),
    confirmDeleteBody: t("confirmDeleteCourseBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),

    detailsSection: t("courseDetailsSection"),
    detailsSectionDescription: t("courseDetailsSectionDescription"),
    localeLabel: t("localeLabel"),
    titleLabel: t("titleLabel"),
    slugLabel: t("slugLabel"),
    courseUrl: t("courseUrlLabel"),
    summaryLabel: t("summaryLabel"),
    summaryHint: t("summaryHint"),
    descriptionLabel: t("descriptionLabel"),

    settingsSection: t("courseSettingsSection"),
    settingsSectionDescription: t("courseSettingsSectionDescription"),
    displaySection: t("contentFlags.title"),
    displaySectionDescription: t("contentFlags.description"),
    trackLabel: t("trackLabel"),
    difficultyLabel: t("difficultyLabel"),
    visibilityLabel: t("visibility"),
    estimatedHoursLabel: t("estimatedHoursLabel"),
    finalQuizLabel: t("finalQuizLabel"),
    finalQuizHint: t("finalQuizHint"),
    noFinalQuiz: t("quizzes.attachNone"),
    externalUrlLabel: t("externalUrlLabel"),
    externalUrlHint: t("externalUrlHint"),
    coverImageLabel: t("coverImageLabel"),
    sortOrderLabel: t("sortOrderLabel"),

    seoSection: t("seoSection"),
    seoSectionDescription: t("seoSectionDescription"),
    seoTitleLabel: t("seoTitleLabel"),
    seoTitleHint: t("seoTitleHint"),
    seoDescriptionLabel: t("seoDescriptionLabel"),
    seoDescriptionHint: t("seoDescriptionHint"),
    focusKeywordsLabel: t("focusKeywordsLabel"),
    focusKeywordsHint: t("focusKeywordsHint"),

    infoSection: t("courseInfoSection"),
    infoSectionDescription: t("courseInfoSectionDescription"),
    idLabel: t("idLabel"),
    createdLabel: t("createdLabel"),
    updatedLabel: t("updatedLabel"),
    lessonsLabel: t("lessonsCol"),

    tracks: maps.tracks,
    difficulties: maps.difficulties,
    visibilities: maps.visibilities,
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
      confirmArchiveTitle: t("confirmArchiveCourseTitle"),
      confirmArchiveBody: t("confirmArchiveCourseBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
    },
    curriculum: {
      section: t("curriculumSection"),
      sectionDescription: t("curriculumSectionDescription"),
      addSection: t("addSection"),
      addLesson: t("addLesson"),
      sectionTitleLabel: t("sectionTitleLabel"),
      sectionDescriptionLabel: t("sectionDescriptionLabel"),
      sectionPublishedLabel: t("sectionPublishedLabel"),
      saveSection: t("saveSection"),
      editSection: t("edit"),
      editSectionDescription: t("dialogDesc.editSection"),
      emptyTitle: t("curriculumEmptyTitle"),
      emptyBody: t("curriculumEmptyBody"),
      emptyLessons: t("sectionEmptyLessons"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
      moveToSection: t("moveToSection"),
      reorderHint: t("reorderHint"),
      lessonsSuffix: t("lessonsSuffix"),
      sectionHidden: t("sectionHidden"),
      minutesLabel: t("minutesLabel"),
      untitled: t("untitled"),
      edit: t("edit"),
      softDelete: t("softDelete"),
      confirmDeleteSectionTitle: t("confirmDeleteSectionTitle"),
      confirmDeleteSectionBody: t("confirmDeleteSectionBody"),
      confirmDeleteLessonTitle: t("confirmDeleteLessonTitle"),
      confirmDeleteLessonBody: t("confirmDeleteLessonBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
      close: t("close"),
      create: t("create"),
      newLessonTitle: t("titleLabel"),
      requiredBadge: t("isRequiredLabel"),
      optionalBadge: t("optionalLessonBadge"),
      kindReading: t("lessonKindReading"),
      kindVideo: t("lessonKindVideo"),
      kindExternal: t("lessonKindExternal"),
      kindDownload: t("lessonKindDownload"),
    },
    recommendations: {
      section: t("recommendationsSection"),
      sectionDescription: t("recommendationsSectionDescription"),
      hint: t("recommendationsHint"),
      add: t("addRecommendation"),
      emptyTitle: t("recommendationsEmptyTitle"),
      emptyBody: t("recommendationsEmptyBody"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
      remove: t("remove"),
      untitled: t("untitled"),
      fallbackTitle: t("recommendationsFallbackTitle"),
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
    <EditorPage
      title={t("editorHeading.course")}
      description={t("pageDesc.courseDetail")}
      backHref="/admin/learn/courses"
      backLabel={t("backToCourses")}
    >
      <CourseEditor
        course={{
          id: detail.id,
          track: detail.track,
          status: detail.status,
          difficulty: detail.difficulty,
          estimatedHours: detail.estimatedHours === null ? "" : String(detail.estimatedHours),
          coverAssetId: detail.coverAssetId,
          coverUrl: detail.coverUrl,
          flags: {
            isFeatured: detail.isFeatured,
            isActive: detail.isActive,
            isPremium: detail.isPremium,
          },
          externalUrl: detail.externalUrl ?? "",
          finalQuizId: detail.finalQuizId,
          visibility: detail.visibility,
          sortOrder: detail.sortOrder,
          lessonCount: detail.lessonCount,
          publishedAt: detail.publishedAt ? formatDateTime(detail.publishedAt) : null,
          scheduledFor: detail.scheduledFor ? formatDateTime(detail.scheduledFor) : null,
          createdAt: formatDateTime(detail.createdAt),
          updatedAt: formatDateTime(detail.updatedAt),
          deleted: detail.deletedAt !== null,
          // DB nulls → "" at this boundary: the editor's fields are controlled
          // inputs, and the save maps "" back to null on the way out.
          translations: detail.translations.map((tr) => ({
            locale: tr.locale,
            title: tr.title,
            slug: tr.slug,
            summary: tr.summary ?? "",
            description: tr.description ?? "",
            seoTitle: tr.seoTitle ?? "",
            seoDescription: tr.seoDescription ?? "",
            seoFocusKeyword: tr.seoFocusKeyword ?? "",
            translationStatus: tr.translationStatus,
          })),
          recommendations: detail.recommendations,
          legalTransitions: detail.legalTransitions,
        }}
        sections={sections.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description ?? "",
          isPublished: section.isPublished,
          lessons: section.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            status: lesson.status,
            statusLabel: maps.statuses[lesson.status] ?? lesson.status,
            isRequired: lesson.isRequired,
            estimatedMinutes: lesson.estimatedMinutes,
            hasBody: lesson.hasBody,
            hasVideo: lesson.hasVideo,
            hasExternal: lesson.hasExternal,
            attachmentCount: lesson.attachmentCount,
          })),
        }))}
        // Every quiz, standalone or not: a course final is exactly the kind
        // that is not listed on the public index (ADR-058 #1).
        quizOptions={quizzes.map((quiz) => ({ id: quiz.id, title: quiz.title || t("untitled") }))}
        recommendationOptions={allCourses
          .filter((row) => row.id !== detail.id && row.deletedAt === null)
          .map((row) => ({
            id: row.id,
            title: row.title,
            trackLabel: maps.tracks[row.track] ?? row.track,
            statusLabel: maps.statuses[row.status] ?? row.status,
            isPublished: row.status === "PUBLISHED",
          }))}
        fallbackPreview={fallback.map((row) => ({ id: row.id, title: row.title }))}
        trackKeys={[...LEARN_TRACK_KEYS]}
        locales={[...routing.locales]}
        defaultLocale={routing.defaultLocale}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        canUpdate={can(subject, "courses.update")}
        canPublish={can(subject, "courses.publish")}
        canDelete={can(subject, "courses.delete")}
        canCreateLesson={can(subject, "lessons.create")}
        canDeleteLesson={can(subject, "lessons.delete")}
        labels={labels}
        {...(ai ? { ai } : {})}
      />
    </EditorPage>
  );
}
