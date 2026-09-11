import { getTranslations } from "next-intl/server";
import { BookOpenCheck, CircleHelp, GraduationCap, MessageSquare, Users } from "lucide-react";
import {
  loadCourseAnalytics,
  loadLeastHelpfulLessons,
  loadLearnAnalyticsSummary,
  loadLessonAnalytics,
  loadQuizAnalytics,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { AdminPage } from "../../_components/admin-page.tsx";
import { DashboardStatCard } from "../../_components/dashboard-stat-card.tsx";

// Learning analytics (changes-11 Phase 9).
//
// **Read-only, gated on `analytics.view`** — an existing seeded key, not a new
// one. Nothing on this screen writes, so `requirePermission` here IS the
// boundary rather than a UI convenience.
//
// Deliberately plain tables rather than the shared `DataTable`: every list here
// is already sorted by the question it answers (worst drop-off first, most
// attempts first), and giving an editor a sort control invites them to reorder
// away from the ordering that makes the screen legible. There is no filtering,
// no export and no row action, so `DataTable`'s toolbar would be five disabled
// controls.
//
// One row of the plan's §51 is **absent on purpose**: "most frequently missed
// questions". ADR-058 #5 stores quiz answers as JSON on the attempt, which
// cannot be aggregated in SQL, and that analytic is the single named trigger
// for adding `QuizAttemptAnswer`. Showing an approximation would remove the
// pressure to do it properly.
export default async function LearnProgressPage() {
  await requirePermission("analytics.view");

  const [t, summary, courses, lessons, quizzes, unhelpful] = await Promise.all([
    getTranslations("admin"),
    loadLearnAnalyticsSummary(),
    loadCourseAnalytics(),
    loadLessonAnalytics(),
    loadQuizAnalytics(),
    loadLeastHelpfulLessons(8),
  ]);

  const hasData = summary.enrolments > 0 || summary.quizAttempts > 0;

  return (
    <AdminPage title={t("learnProgress")} description={t("pageDesc.learnProgress")}>
      {!hasData ? (
        <Empty>
          <EmptyTitle>{t("analytics.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("analytics.emptyBody")}</EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DashboardStatCard
              icon={Users}
              label={t("analytics.activeLearners")}
              value={summary.activeLearners}
            />
            <DashboardStatCard
              icon={GraduationCap}
              label={t("analytics.coursesCompleted")}
              value={summary.coursesCompleted}
              accent="success"
            />
            <DashboardStatCard
              icon={BookOpenCheck}
              label={t("analytics.lessonsCompleted")}
              value={summary.lessonsCompleted}
              accent="info"
            />
            <DashboardStatCard
              icon={CircleHelp}
              label={t("analytics.quizAttempts")}
              value={summary.quizAttempts}
              accent="info"
            />
            <DashboardStatCard
              icon={MessageSquare}
              label={t("analytics.feedbackVotes")}
              value={summary.feedbackVotes}
              accent="warning"
            />
            <DashboardStatCard
              icon={Users}
              label={t("analytics.enrolments")}
              value={summary.enrolments}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("analytics.coursesTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("analytics.coursesDescription")}</p>
            </CardHeader>
            <CardContent>
              <AnalyticsTable
                headers={[
                  t("analytics.colCourse"),
                  t("analytics.colStarted"),
                  t("analytics.colCompleted"),
                  t("analytics.colCompletionRate"),
                  t("analytics.colAverageLessons"),
                ]}
                rows={courses.map((row) => ({
                  key: row.courseId,
                  cells: [
                    row.title || t("untitled"),
                    String(row.started),
                    String(row.completed),
                    `${row.completionRate}%`,
                    `${row.averageLessonsCompleted} / ${row.lessonCount}`,
                  ],
                }))}
                emptyLabel={t("analytics.noRows")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("analytics.dropOffTitle")}</CardTitle>
              {/* The description says what "drop-off" means here, because the
                  word is used loosely elsewhere and the number is only useful
                  if you know it counts opened-and-not-finished. */}
              <p className="text-sm text-muted-foreground">{t("analytics.dropOffDescription")}</p>
            </CardHeader>
            <CardContent>
              <AnalyticsTable
                headers={[
                  t("analytics.colLesson"),
                  t("analytics.colCourse"),
                  t("analytics.colReached"),
                  t("analytics.colCompleted"),
                  t("analytics.colDroppedOff"),
                ]}
                rows={lessons.slice(0, 15).map((row) => ({
                  key: row.lessonId,
                  cells: [
                    row.title || t("untitled"),
                    row.courseTitle,
                    String(row.reached),
                    String(row.completed),
                    String(row.droppedOff),
                  ],
                }))}
                emptyLabel={t("analytics.noRows")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("analytics.quizzesTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("analytics.quizzesDescription")}</p>
            </CardHeader>
            <CardContent>
              <AnalyticsTable
                headers={[
                  t("analytics.colQuiz"),
                  t("analytics.colAttempts"),
                  t("analytics.colLearners"),
                  t("analytics.colPassRate"),
                  t("analytics.colAverageScore"),
                ]}
                rows={quizzes.map((row) => ({
                  key: row.quizId,
                  cells: [
                    row.title || t("untitled"),
                    String(row.attempts),
                    String(row.learners),
                    `${row.passRate}%`,
                    `${row.averagePercentage}%`,
                  ],
                }))}
                emptyLabel={t("analytics.noRows")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("analytics.unhelpfulTitle")}</CardTitle>
              {/* D28's whole justification, on screen: counters would answer
                  "what is the ratio now"; rows answer "which lessons got worse
                  after the rewrite". */}
              <p className="text-sm text-muted-foreground">{t("analytics.unhelpfulDescription")}</p>
            </CardHeader>
            <CardContent>
              <AnalyticsTable
                headers={[
                  t("analytics.colLesson"),
                  t("analytics.colCourse"),
                  t("analytics.colHelpful"),
                  t("analytics.colNotHelpful"),
                  t("analytics.colNet"),
                ]}
                rows={unhelpful.map((row) => ({
                  key: row.lessonId,
                  cells: [
                    row.title || t("untitled"),
                    row.courseTitle,
                    String(row.helpful),
                    String(row.notHelpful),
                    row.net > 0 ? `+${row.net}` : String(row.net),
                  ],
                }))}
                emptyLabel={t("analytics.noFeedback")}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </AdminPage>
  );
}

/**
 * A plain table, wrapped so the four above cannot drift apart.
 *
 * `overflow-x-auto` on the wrapper rather than the page: five numeric columns
 * fit on a laptop and not on a narrow admin sidebar layout, and a page that
 * scrolls sideways is a worse answer than a table that does.
 */
function AnalyticsTable({
  headers,
  rows,
  emptyLabel,
}: {
  headers: string[];
  rows: { key: string; cells: string[] }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-start">
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={
                  index === 0
                    ? "py-2 pe-3 text-start font-medium text-muted-foreground"
                    : "py-2 pe-3 text-end font-medium text-muted-foreground"
                }
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b last:border-0">
              {row.cells.map((cell, index) => (
                <td
                  key={index}
                  className={
                    index === 0
                      ? "py-2 pe-3 font-medium"
                      : "py-2 pe-3 text-end tabular-nums text-muted-foreground"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
