import { getTranslations } from "next-intl/server";
import { BookOpenCheck, CircleHelp, GraduationCap, MessageSquare, Users } from "lucide-react";
import {
  filterLearnAnalytics,
  loadCourseAnalytics,
  loadLearnAnalyticsSummary,
  loadLessonAnalytics,
  loadQuizAnalytics,
  rankLeastHelpful,
  sectionsOf,
} from "@repo/core";
import { isLearnTrack, LEARN_TRACK_KEYS } from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { Card, CardContent, CardDescription, CardHeader } from "@repo/ui/components/card";
import { MetaText, SectionTitleCompact } from "@repo/ui/components/typography";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { AdminPage } from "../../_components/admin-page.tsx";
import { DashboardStatCard } from "../../_components/dashboard-stat-card.tsx";
import { trackLabels } from "../_lib/learn-labels.ts";
import { AnalyticsTable, type AnalyticsPagerLabels } from "./_components/analytics-table.tsx";
import { ProgressBody, ProgressFilters } from "./_components/progress-filters.tsx";
import {
  ChartLegend,
  DivergingBars,
  passRateTone,
  percentOf,
  RateRing,
  StackedBars,
} from "./_components/progress-charts.tsx";

/** Rows a chart draws; the table under it keeps every row. */
const CHART_ROWS = 8;

// Learning analytics (changes-11 Phase 9).
//
// **Read-only, gated on `analytics.view`** — an existing seeded key, not a new
// one. Nothing on this screen writes, so `requirePermission` here IS the
// boundary rather than a UI convenience.
//
// changes-44 #4: each list opens with a graph of the same rows (drawn in CSS,
// `_components/progress-charts.tsx`), and an "At a glance" card carries the
// two headline rates as rings. The tables stay under the graphs as the exact
// figures and the graphs' table view.
//
// Deliberately plain tables rather than the shared `DataTable`: every list here
// is already sorted by the question it answers (worst drop-off first, most
// attempts first), and giving an editor a sort control invites them to reorder
// away from the ordering that makes the screen legible. There is no export and
// no row action, so `DataTable`'s toolbar would be disabled controls.
//
// changes-48 #4: a school → course → module filter above everything, in the
// URL (the tiles are counted in the database for the chosen courses), and
// every table pages ten rows at a time instead of the lesson table stopping
// silently at fifteen. The narrowing rules live in `@repo/core`
// (`filterLearnAnalytics`), because they are not obvious: a quiz is USED by
// courses rather than owned by one.
//
// One row of the plan's §51 is **absent on purpose**: "most frequently missed
// questions". ADR-058 #5 stores quiz answers as JSON on the attempt, which
// cannot be aggregated in SQL, and that analytic is the single named trigger
// for adding `QuizAttemptAnswer`. Showing an approximation would remove the
// pressure to do it properly.
export default async function LearnProgressPage({
  searchParams,
}: PageProps<"/admin/learn/progress">) {
  await requirePermission("analytics.view");

  const [t, allCourses, allLessons, allQuizzes] = await Promise.all([
    getTranslations("admin"),
    loadCourseAnalytics(),
    loadLessonAnalytics(),
    loadQuizAnalytics(),
  ]);

  // External input, parsed (security.md #6): an unknown school or course is
  // "all", never an error and never a query against an arbitrary id.
  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  const track = param("track");
  const courseParam = param("course");
  const filter = {
    track: track && isLearnTrack(track) ? track : undefined,
    courseId: allCourses.some((row) => row.courseId === courseParam) ? courseParam : undefined,
    sectionId: param("section"),
  };
  const { courses, lessons, quizzes, scope } = filterLearnAnalytics(
    { courses: allCourses, lessons: allLessons, quizzes: allQuizzes },
    filter,
  );
  const summary = await loadLearnAnalyticsSummary(scope);
  const unhelpful = rankLeastHelpful(lessons, 8);
  const resetKey = [filter.track, filter.courseId, filter.sectionId].join("|");

  const tracks = trackLabels(t);
  const pager: AnalyticsPagerLabels = {
    label: t("analytics.pagerLabel"),
    previous: t("previous"),
    next: t("next"),
    morePages: t("analytics.morePages"),
    page: t.raw("analytics.pagerPage") as string,
  };
  const filters = (
    <ProgressFilters
      tracks={LEARN_TRACK_KEYS.map((key) => ({ value: key, label: tracks[key] ?? key }))}
      courses={allCourses
        .filter((row) => !filter.track || row.track === filter.track)
        .map((row) => ({ value: row.courseId, label: row.title || t("untitled") }))}
      sections={
        filter.courseId
          ? sectionsOf(allLessons, filter.courseId).map((section) => ({
              value: section.id,
              label: section.title || t("untitled"),
            }))
          : []
      }
      labels={{
        track: t("analytics.filterTrack"),
        allTracks: t("analytics.filterAllTracks"),
        course: t("analytics.filterCourse"),
        allCourses: t("analytics.filterAllCourses"),
        section: t("analytics.filterSection"),
        allSections: t("analytics.filterAllSections"),
      }}
    />
  );

  // With a filter on, an empty result is an answer about THAT course, so the
  // screen keeps its filters and tables rather than claiming the platform has
  // no activity at all.
  const hasData = scope !== undefined || summary.enrolments > 0 || summary.quizAttempts > 0;

  // The headline pass rate is weighted by attempts, so a quiz taken once does
  // not count as much as one taken a hundred times.
  const quizAttemptTotal = quizzes.reduce((sum, row) => sum + row.attempts, 0);
  const quizPassed = quizzes.reduce(
    (sum, row) => sum + Math.round((row.passRate / 100) * row.attempts),
    0,
  );
  const overallPassRate = percentOf(quizPassed, quizAttemptTotal);
  const courseChart = [...courses].sort((a, b) => b.started - a.started).slice(0, CHART_ROWS);
  const lessonChart = lessons.slice(0, CHART_ROWS);
  // One scale for every lesson row — the most-opened lesson — so the bars
  // compare lessons by size as well as by share.
  const lessonScale = Math.max(1, ...lessonChart.map((row) => row.reached));
  const quizChart = [...quizzes].sort((a, b) => b.attempts - a.attempts).slice(0, CHART_ROWS);
  const topNote = (total: number) =>
    total > CHART_ROWS ? (
      <MetaText>{t("analytics.chartTopNote", { count: CHART_ROWS })}</MetaText>
    ) : null;

  return (
    <AdminPage title={t("learnProgress")} description={t("pageDesc.learnProgress")}>
      {!hasData ? (
        <Empty>
          <EmptyTitle>{t("analytics.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("analytics.emptyBody")}</EmptyDescription>
        </Empty>
      ) : (
        <ProgressBody>
          {filters}
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
              <SectionTitleCompact>{t("analytics.overviewTitle")}</SectionTitleCompact>
              <CardDescription>{t("analytics.overviewDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <RateRing
                value={percentOf(summary.coursesCompleted, summary.enrolments)}
                tone="success"
                label={t("analytics.completionRing")}
                detail={t("analytics.completionRingDetail", {
                  completed: summary.coursesCompleted,
                  started: summary.enrolments,
                })}
              />
              <RateRing
                value={overallPassRate}
                tone={passRateTone(overallPassRate)}
                label={t("analytics.passRing")}
                detail={t("analytics.passRingDetail", {
                  passed: quizPassed,
                  attempts: quizAttemptTotal,
                })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitleCompact>{t("analytics.coursesTitle")}</SectionTitleCompact>
              <CardDescription>{t("analytics.coursesDescription")}</CardDescription>
            </CardHeader>
            {courseChart.length > 0 && (
              <CardContent className="flex flex-col gap-4 pb-6">
                <ChartLegend
                  items={[
                    { tone: "success", label: t("analytics.colCompleted") },
                    { tone: "muted", label: t("analytics.legendNotFinished") },
                  ]}
                />
                <StackedBars
                  rows={courseChart.map((row) => ({
                    key: row.courseId,
                    label: row.title || t("untitled"),
                    readout: t("analytics.courseReadout", {
                      completed: row.completed,
                      started: row.started,
                      rate: row.completionRate,
                    }),
                    title: `${row.title || t("untitled")} — ${t("analytics.colStarted")}: ${row.started}, ${t("analytics.colCompleted")}: ${row.completed}`,
                    scale: row.started,
                    segments: [{ value: row.completed, tone: "success" }],
                  }))}
                />
                {topNote(courses.length)}
              </CardContent>
            )}
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
                pager={pager}
                resetKey={resetKey}
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
            {lessonChart.length > 0 && (
              <CardContent className="flex flex-col gap-4 pb-6">
                <ChartLegend
                  items={[
                    { tone: "success", label: t("analytics.colCompleted") },
                    { tone: "warning", label: t("analytics.colDroppedOff") },
                  ]}
                />
                <StackedBars
                  rows={lessonChart.map((row) => ({
                    key: row.lessonId,
                    label: row.title || t("untitled"),
                    readout: t("analytics.dropReadout", {
                      dropped: row.droppedOff,
                      reached: row.reached,
                    }),
                    title: `${row.title || t("untitled")} (${row.courseTitle}) — ${t("analytics.colReached")}: ${row.reached}, ${t("analytics.colCompleted")}: ${row.completed}, ${t("analytics.colDroppedOff")}: ${row.droppedOff}`,
                    scale: lessonScale,
                    segments: [
                      { value: row.completed, tone: "success" },
                      { value: row.droppedOff, tone: "warning" },
                    ],
                  }))}
                />
                {topNote(lessons.length)}
              </CardContent>
            )}
            <CardContent className="px-0">
              <AnalyticsTable
                headers={[
                  t("analytics.colLesson"),
                  t("analytics.colCourse"),
                  t("analytics.colReached"),
                  t("analytics.colCompleted"),
                  t("analytics.colDroppedOff"),
                ]}
                rows={lessons.map((row) => ({
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
                pager={pager}
                resetKey={resetKey}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitleCompact>{t("analytics.quizzesTitle")}</SectionTitleCompact>
              <CardDescription>{t("analytics.quizzesDescription")}</CardDescription>
            </CardHeader>
            {quizChart.length > 0 && (
              <CardContent className="flex flex-col gap-4 pb-6">
                {/* One series, so no legend: the band colour is backed by the
                    percentage printed on every row. */}
                <StackedBars
                  rows={quizChart.map((row) => ({
                    key: row.quizId,
                    label: row.title || t("untitled"),
                    readout: t("analytics.quizReadout", {
                      rate: row.passRate,
                      score: row.averagePercentage,
                    }),
                    title: `${row.title || t("untitled")} — ${t("analytics.colAttempts")}: ${row.attempts}, ${t("analytics.colLearners")}: ${row.learners}`,
                    scale: 100,
                    segments: [{ value: row.passRate, tone: passRateTone(row.passRate) }],
                  }))}
                />
                {topNote(quizzes.length)}
              </CardContent>
            )}
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
                pager={pager}
                resetKey={resetKey}
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
            {unhelpful.length > 0 && (
              <CardContent className="flex flex-col gap-4 pb-6">
                <ChartLegend
                  items={[
                    { tone: "destructive", label: t("analytics.colNotHelpful") },
                    { tone: "success", label: t("analytics.colHelpful") },
                  ]}
                />
                <DivergingBars
                  positiveLabel={t("analytics.colHelpful")}
                  negativeLabel={t("analytics.colNotHelpful")}
                  rows={unhelpful.map((row) => ({
                    key: row.lessonId,
                    label: row.title || t("untitled"),
                    positive: row.helpful,
                    negative: row.notHelpful,
                  }))}
                />
              </CardContent>
            )}
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
                pager={pager}
                resetKey={resetKey}
              />
            </CardContent>
          </Card>
        </ProgressBody>
      )}
    </AdminPage>
  );
}
