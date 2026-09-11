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
import { Card, CardContent, CardDescription, CardHeader } from "@repo/ui/components/card";
import { SectionTitleCompact, SubText } from "@repo/ui/components/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <SectionTitleCompact>{t("analytics.coursesTitle")}</SectionTitleCompact>
              <CardDescription>{t("analytics.coursesDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
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
              <SectionTitleCompact>{t("analytics.dropOffTitle")}</SectionTitleCompact>
              {/* The description says what "drop-off" means here, because the
                  word is used loosely elsewhere and the number is only useful
                  if you know it counts opened-and-not-finished. */}
              <CardDescription>{t("analytics.dropOffDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
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
              <SectionTitleCompact>{t("analytics.quizzesTitle")}</SectionTitleCompact>
              <CardDescription>{t("analytics.quizzesDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
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
              <SectionTitleCompact>{t("analytics.unhelpfulTitle")}</SectionTitleCompact>
              {/* D28's whole justification, on screen: counters would answer
                  "what is the ratio now"; rows answer "which lessons got worse
                  after the rewrite". */}
              <CardDescription>{t("analytics.unhelpfulDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
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
 * A plain `Table` (default density), wrapped so the four above cannot
 * drift apart. It sits edge to edge in its card — the reference's
 * table-in-card has no content padding (tokens.md §3.2), so the cells' own
 * 16px is the inset — and scrolls sideways inside the card rather than
 * making the page do it.
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
    return <SubText className="px-(--card-spacing)">{emptyLabel}</SubText>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header, index) => (
            <TableHead key={header} scope="col" className={index === 0 ? undefined : "text-end"}>
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            {row.cells.map((cell, index) => (
              <TableCell
                key={index}
                className={
                  index === 0 ? "font-medium" : "text-end tabular-nums text-muted-foreground"
                }
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
