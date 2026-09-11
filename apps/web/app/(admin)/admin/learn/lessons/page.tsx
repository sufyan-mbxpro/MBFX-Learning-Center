import { getTranslations } from "next-intl/server";
import { listAllLessonsAdmin, listCoursesAdmin } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { learnLabelMaps } from "../_lib/learn-labels.ts";
import { LessonsTable, type LessonsTableLabels } from "./lessons-table.tsx";

// The flat lesson list + OUTDATED translation queue (plan §8.1).
//
// A lesson has no screen of its own to be created from: `createLesson` needs a
// section, and a section only exists inside a course. So this screen has no
// "New lesson" action — new lessons are added from the course builder's
// curriculum tab, where the placement is already decided.
export default async function LessonsAdminPage() {
  const subject = await requirePermission("lessons.view");
  const [t, rows, courses] = await Promise.all([
    getTranslations("admin"),
    listAllLessonsAdmin(),
    listCoursesAdmin(),
  ]);

  const maps = learnLabelMaps(t);
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  const labels: LessonsTableLabels = {
    search: t("searchLessons"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    titleCol: t("titleLabel"),
    courseCol: t("courseCol"),
    sectionCol: t("sectionCol"),
    statusCol: t("statusLabel"),
    localesCol: t("translations"),
    updatedCol: t("updatedLabel"),
    actionsCol: t("actionsCol"),
    untitled: t("untitled"),
    edit: t("edit"),
    duplicate: t("duplicate"),
    softDelete: t("softDelete"),
    confirmDeleteTitle: t("confirmDeleteLessonTitle"),
    confirmDeleteBody: t("confirmDeleteLessonBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    openActions: t("openActions"),
    emptyTitle: t("noLessons"),
    allCourses: t("allCourses"),
    allStatuses: t("allStatuses"),
    courseLabel: t("courseCol"),
    statusLabel: t("statusLabel"),
    outdatedOnly: t("outdatedOnly"),
    minutesLabel: t("minutesLabel"),
    statuses: maps.statuses,
  };

  return (
    <AdminPage title={t("learnLessons")} description={t("pageDesc.learnLessons")}>
      <LessonsTable
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          courseId: row.courseId,
          courseTitle: row.courseTitle,
          sectionTitle: row.sectionTitle,
          status: row.status,
          statusLabel: maps.statuses[row.status] ?? row.status,
          // The DERIVED lesson type (ADR-055 #4): a lesson is the set of
          // capabilities it carries, so more than one badge is correct and a
          // lesson with none is the case `lessonInputSchema` refuses to save.
          kindLabels: [
            ...(row.hasVideo ? [t("lessonKindVideo")] : []),
            ...(row.hasExternal ? [t("lessonKindExternal")] : []),
            ...(row.attachmentCount > 0 ? [t("lessonKindDownload")] : []),
          ],
          estimatedMinutes: row.estimatedMinutes,
          isOutdated: row.locales.some((l) => l.translationStatus === "OUTDATED"),
          locales: row.locales.map((l) => ({
            locale: l.locale,
            translationStatus: l.translationStatus,
            translationStatusLabel:
              maps.translationStatuses[l.translationStatus] ?? l.translationStatus,
          })),
          updatedAtLabel: dateFormat.format(row.updatedAt),
          updatedAtSort: row.updatedAt.getTime(),
        }))}
        courses={courses.map((course) => ({ id: course.id, title: course.title }))}
        statusKeys={Object.keys(maps.statuses)}
        canCreate={can(subject, "lessons.create")}
        canDelete={can(subject, "lessons.delete")}
        labels={labels}
      />
    </AdminPage>
  );
}
