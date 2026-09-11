import { getTranslations } from "next-intl/server";
import { listCoursesAdmin } from "@repo/core";
import { LEARN_TRACK_KEYS } from "@repo/contracts";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { learnLabelMaps } from "../_lib/learn-labels.ts";
import { NewCourseDialog } from "./courses-controls.tsx";
import { CoursesTable, type CoursesTableLabels } from "./courses-table.tsx";

// Courses admin list (Module 11, changes-11 PR 3.1). `requirePermission` here
// is the screen's read gate; every WRITE re-gates in its own action
// (security.md #1) — the `can()` calls below only decide what to render.
export default async function CoursesAdminPage() {
  const subject = await requirePermission("courses.view");
  const [t, rows] = await Promise.all([
    getTranslations("admin"),
    // Soft-deleted courses are included so the recycle bin is reachable from
    // the one screen that lists courses; the row renders dimmed with a badge.
    listCoursesAdmin({ includeDeleted: true }),
  ]);

  const maps = learnLabelMaps(t);
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  const labels: CoursesTableLabels = {
    search: t("searchCourses"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    titleCol: t("titleLabel"),
    trackCol: t("trackLabel"),
    statusCol: t("statusLabel"),
    difficultyCol: t("difficultyLabel"),
    visibilityCol: t("visibility"),
    sectionsCol: t("sectionsCol"),
    lessonsCol: t("lessonsCol"),
    updatedCol: t("updatedLabel"),
    actionsCol: t("actionsCol"),
    untitled: t("untitled"),
    deleted: t("deleted"),
    externalBadge: t("externalBadge"),
    edit: t("edit"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("confirmDeleteCourseTitle"),
    confirmDeleteBody: t("confirmDeleteCourseBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    openActions: t("openActions"),
    emptyTitle: t("noCourses"),
    allTracks: t("allTracks"),
    allStatuses: t("allStatuses"),
    allDifficulties: t("allDifficulties"),
    trackLabel: t("trackLabel"),
    statusLabel: t("statusLabel"),
    difficultyLabel: t("difficultyLabel"),
    tracks: maps.tracks,
    statuses: maps.statuses,
    difficulties: maps.difficulties,
  };

  return (
    <AdminPage
      title={t("learnCourses")}
      description={t("pageDesc.learnCourses")}
      actions={
        can(subject, "courses.create") ? (
          <NewCourseDialog
            trackKeys={[...LEARN_TRACK_KEYS]}
            labels={{
              newCourse: t("newCourse"),
              newCourseDescription: t("dialogDesc.newCourse"),
              create: t("create"),
              cancel: t("cancel"),
              close: t("close"),
              trackLabel: t("trackLabel"),
              titleLabel: t("titleLabel"),
              tracks: maps.tracks,
            }}
          />
        ) : undefined
      }
    >
      <CoursesTable
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          track: row.track,
          trackLabel: maps.tracks[row.track] ?? row.track,
          status: row.status,
          statusLabel: maps.statuses[row.status] ?? row.status,
          difficulty: row.difficulty,
          difficultyLabel: maps.difficulties[row.difficulty] ?? row.difficulty,
          visibilityLabel: maps.visibilities[row.visibility] ?? row.visibility,
          sectionCount: row.sectionCount,
          lessonCount: row.lessonCount,
          isExternal: row.externalUrl !== null,
          deleted: row.deletedAt !== null,
          updatedAtLabel: dateFormat.format(row.updatedAt),
          updatedAtSort: row.updatedAt.getTime(),
          publishedAtLabel: row.publishedAt ? dateFormat.format(row.publishedAt) : null,
        }))}
        trackKeys={[...LEARN_TRACK_KEYS]}
        statusKeys={Object.keys(maps.statuses)}
        difficultyKeys={Object.keys(maps.difficulties)}
        canDelete={can(subject, "courses.delete")}
        labels={labels}
      />
    </AdminPage>
  );
}
