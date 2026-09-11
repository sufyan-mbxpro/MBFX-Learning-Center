import { getTranslations } from "next-intl/server";
import { listQuizzesAdmin } from "@repo/core";
import { humanizeKey } from "@repo/utils";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { contentStatusLabels, trackLabels } from "../_lib/learn-labels.ts";
import { NewQuizDialog } from "./quizzes-controls.tsx";
import { QuizzesTable, type QuizzesTableLabels } from "./quizzes-table.tsx";

// Quiz admin list (changes-11 Phase 6, ADR-058).
//
// **Gated on `lessons.view`, not `quizzes.view`** — ADR-058 #8. There is no
// `quizzes.*` group in the seed registry, so a key like that would be one no
// role can hold and every check would silently 403; the permission-key
// cross-check exists to catch exactly that.
export default async function QuizzesAdminPage() {
  const subject = await requirePermission("lessons.view");
  const [t, rows] = await Promise.all([getTranslations("admin"), listQuizzesAdmin()]);

  const statuses = contentStatusLabels(t);
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  const labels: QuizzesTableLabels = {
    search: t("quizzes.searchPlaceholder"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    titleCol: t("quizzes.columnTitle"),
    statusCol: t("quizzes.columnStatus"),
    questionsCol: t("quizzes.columnQuestions"),
    attemptsCol: t("quizzes.columnAttempts"),
    usageCol: t("quizzes.columnUsage"),
    updatedCol: t("quizzes.columnUpdated"),
    actionsCol: t("actionsCol"),
    untitled: t("untitled"),
    standalone: t("quizzes.standalone"),
    deleted: t("deleted"),
    activeCol: t("quizzes.columnActive"),
    active: t("quizzes.active"),
    inactive: t("quizzes.inactive"),
    duplicate: t("duplicate"),
    edit: t("edit"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("confirmDeleteQuizTitle"),
    confirmDeleteBody: t("confirmDeleteQuizBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    openActions: t("openActions"),
    emptyTitle: t("quizzes.empty"),
    emptyBody: t("quizzes.emptyBody"),
    allStatuses: t("quizzes.filterAllStatuses"),
    statusLabel: t("quizzes.filterStatus"),
    statuses,
  };

  return (
    <AdminPage
      title={t("learnQuizzes")}
      description={t("pageDesc.learnQuizzes")}
      actions={
        can(subject, "lessons.create") ? (
          <NewQuizDialog
            labels={{
              newQuiz: t("quizzes.create"),
              newQuizDescription: t("quizzes.createDescription"),
              create: t("create"),
              cancel: t("cancel"),
              close: t("close"),
              titleLabel: t("quizzes.titleLabel"),
              trackLabel: t("trackLabel"),
              tracks: trackLabels(t),
            }}
          />
        ) : undefined
      }
    >
      <QuizzesTable
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          status: row.status,
          statusLabel: statuses[row.status] ?? row.status,
          // Exactly `publicQuizWhere()` in @repo/core, minus the `deletedAt`
          // clause the list query has already applied. Derived here rather
          // than in the table so the rule lives beside the loader that
          // enforces it, not in a component.
          isActive: row.status === "PUBLISHED" && row.visibility === "PUBLIC",
          isStandalone: row.isStandalone,
          // `Quiz.category` is free text an editor typed, so no catalog key can
          // exist for it — `humanizeKey` is ADR-044 #5's stated last resort.
          categoryLabel: row.category ? humanizeKey(row.category) : null,
          questionCount: row.questionCount,
          attemptCount: row.attemptCount,
          usageCount: row.usedByLessons + row.usedByCourses,
          usageLabel: usageLabel(row.usedByLessons, row.usedByCourses, t),
          deleted: false,
          updatedAtLabel: dateFormat.format(row.updatedAt),
          updatedAtSort: row.updatedAt.getTime(),
        }))}
        statusKeys={Object.keys(statuses)}
        canCreate={can(subject, "lessons.create")}
        canDelete={can(subject, "lessons.delete")}
        labels={labels}
      />
    </AdminPage>
  );
}

/**
 * "2 lessons · 1 course", or the honest "Not attached".
 *
 * Spelled out rather than a bare number because the two consumers mean
 * different things: a lesson attachment drives `QUIZ_PASS` completion, a course
 * attachment gates the whole course (ADR-056 #7). An editor about to delete
 * one needs to know which.
 */
function usageLabel(
  lessons: number,
  courses: number,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  const parts: string[] = [];
  if (lessons > 0) parts.push(t("quizzes.usageLessons", { count: lessons }));
  if (courses > 0) parts.push(t("quizzes.usageCourses", { count: courses }));
  return parts.length === 0 ? t("quizzes.usageNone") : parts.join(" · ");
}
