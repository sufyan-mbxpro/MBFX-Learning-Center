import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getQuizAdmin } from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../../_components/admin-page.tsx";
import type { ContentStatusLabels } from "../../../_components/editor/content-status-panel.tsx";
import { contentStatusLabels, transitionLabels } from "../../_lib/learn-labels.ts";
import { QuizEditor, type EditorQuestion } from "./quiz-editor.tsx";

// Quiz editor (changes-11 Phase 6, ADR-058).
//
// Read gate here on `lessons.view`; every write re-gates in its own action
// (security.md #1), and the publish transition adds `lessons.publish` inside
// `transitionContentStatus`. The `can()` calls below only decide what to
// render — a hidden button is not security.
//
// **This screen sees the correct answers, and the public loader does not.**
// That split is a type-level one (`QuizAdminDetail` has `correctAnswer`,
// `QuizView` has no such field) rather than one function with a flag, because
// a flag is one forgotten argument away from a leak — ADR-058 #2.
export default async function QuizEditPage({ params }: PageProps<"/admin/learn/quizzes/[id]">) {
  const subject = await requirePermission("lessons.view");
  const { id } = await params;

  const t = await getTranslations("admin");
  const detail = await getQuizAdmin(id, routing.defaultLocale);
  if (!detail) notFound();

  const translation =
    detail.translations.find((tr) => tr.locale === routing.defaultLocale) ?? detail.translations[0];

  const statusLabels: ContentStatusLabels = {
    section: t("publishingSection"),
    description: t("publishingSectionDescription"),
    hint: t("publishingHint"),
    exhausted: t("transitionsExhausted"),
    statusLabel: t("statusLabel"),
    statusLabels: contentStatusLabels(t),
    transitions: transitionLabels(t),
    publishedLabel: t("publishedLabel"),
    scheduledLabel: t("scheduledLabel"),
    scheduleFor: t("scheduleForLabel"),
    presetPlusHour: t("schedulePlusHour"),
    presetTomorrow9: t("scheduleTomorrow9"),
    presetNextWeek: t("scheduleNextWeek"),
    presetClear: t("scheduleClear"),
    updatedLabel: t("updatedLabel"),
    confirmArchiveTitle: t("confirmArchiveQuizTitle"),
    confirmArchiveBody: t("confirmArchiveQuizBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
  };

  const questions: EditorQuestion[] = detail.questions.map((question) => ({
    id: question.id,
    type: question.type,
    points: question.points,
    prompt: question.prompt,
    options: question.options,
    explanations: question.explanations,
    correctAnswer: question.correctAnswer,
  }));

  return (
    <AdminPage title={t("quizzes.editorTitle")} description={t("quizzes.editorDescription")}>
      <QuizEditor
        canPublish={can(subject, "lessons.publish")}
        canUpdate={can(subject, "lessons.update")}
        statusLabels={statusLabels}
        initial={{
          quizId: detail.id,
          status: detail.status,
          legalTransitions: detail.legalTransitions,
          publishedAt: detail.publishedAt?.toISOString() ?? null,
          scheduledFor: detail.scheduledFor?.toISOString() ?? null,
          updatedAt: detail.updatedAt.toISOString(),
          locale: translation?.locale ?? routing.defaultLocale,
          title: translation?.title ?? "",
          slug: translation?.slug ?? "",
          description: translation?.description ?? "",
          passingScore: detail.passingScore,
          maxAttempts: detail.maxAttempts,
          showAnswersAfter: detail.showAnswersAfter,
          track: detail.track,
          isStandalone: detail.isStandalone,
          category: detail.category ?? "",
          questions,
        }}
      />
    </AdminPage>
  );
}
