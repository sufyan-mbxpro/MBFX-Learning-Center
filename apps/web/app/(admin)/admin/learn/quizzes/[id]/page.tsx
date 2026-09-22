import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAiAvailability } from "@repo/ai";
import { getQuizAdmin, getQuizSourceLesson } from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { EditorPage } from "../../../_components/admin-page.tsx";
import type { ContentStatusLabels } from "../../../_components/editor/content-status-panel.tsx";
import { aiQuizLabels } from "../../../_components/ai-labels.ts";
import { loadEditorAi } from "../../../_lib/editor-ai.ts";
import {
  contentStatusLabels,
  difficultyLabels,
  transitionLabels,
} from "../../_lib/learn-labels.ts";
import { QuizEditor, type EditorQuestion } from "./quiz-editor.tsx";
import { formatDateTime, siteOrigin } from "@repo/utils";

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
export default async function QuizEditPage({
  params,
  searchParams,
}: PageProps<"/admin/learn/quizzes/[id]">) {
  const subject = await requirePermission("lessons.view");
  const { id } = await params;
  // The language being edited. A search parameter rather than client state,
  // unlike the other editors: a question's words for another locale are a
  // second read, and the structure they hang on must come from the server.
  // An unknown value is the default locale, never an error.
  const requested = (await searchParams).locale;
  const locale =
    typeof requested === "string" && (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;
  const translating = locale !== routing.defaultLocale;

  const [t, detail, localized] = await Promise.all([
    getTranslations("admin"),
    getQuizAdmin(id, routing.defaultLocale),
    translating ? getQuizAdmin(id, locale) : null,
  ]);
  if (!detail) notFound();

  // changes-29 B6. THREE conditions, and all three are absence rather than
  // disablement: the feature is on, this person may spend and may edit
  // lessons, and this quiz has a published lesson to build from. A standalone
  // quiz has no source, so the button does not exist for it.
  const [tAi, availability, sourceLesson, editorAi] = await Promise.all([
    getTranslations("admin.ai"),
    getAiAvailability(),
    getQuizSourceLesson(detail.id, routing.defaultLocale),
    // ADR-126's brief bar and field menus — independent of the lesson-based
    // generator above, so a standalone quiz still gets them.
    loadEditorAi(subject, {
      module: "quiz",
      entity: { type: "quiz", id: detail.id },
      contentKeys: ["lessons.update"],
    }),
  ]);
  const ai =
    availability.features.quiz_generation &&
    can(subject, "ai.use") &&
    can(subject, "lessons.update") &&
    sourceLesson
      ? {
          labels: aiQuizLabels(
            (key) => tAi(key as "quizAction"),
            (key) => t(key as "cancel"),
            difficultyLabels(t),
          ),
          lesson: { ...sourceLesson, locale: routing.defaultLocale },
        }
      : undefined;

  const sourceTranslation =
    detail.translations.find((tr) => tr.locale === routing.defaultLocale) ?? detail.translations[0];
  const translation = translating
    ? detail.translations.find((tr) => tr.locale === locale)
    : sourceTranslation;

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

  // The STRUCTURE always comes from the default locale (type, points, correct
  // answer, option count); on a translation only the words come from
  // `localized`, padded to the source's option count so an option index means
  // the same thing in every language. `saveQuiz` refuses anything else.
  const questions: EditorQuestion[] = detail.questions.map((question) => {
    const words = localized?.questions.find((q) => q.id === question.id);
    return {
      id: question.id,
      type: question.type,
      points: question.points,
      prompt: translating ? (words?.prompt ?? "") : question.prompt,
      options: translating
        ? question.options.map((_, index) => words?.options[index] ?? "")
        : question.options,
      explanations: translating
        ? question.options.map((_, index) => words?.explanations[index] ?? "")
        : question.explanations,
      correctAnswer: question.correctAnswer,
    };
  });

  return (
    <EditorPage
      title={t("quizzes.editorTitle")}
      description={t("quizzes.editorDescription")}
      backHref="/admin/learn/quizzes"
      backLabel={t("learnQuizzes")}
    >
      <QuizEditor
        // A fresh editor per language: its state is one locale's words.
        key={locale}
        locales={[...routing.locales]}
        defaultLocale={routing.defaultLocale}
        {...(translating
          ? {
              source: {
                title: sourceTranslation?.title ?? "",
                description: sourceTranslation?.description ?? "",
                questions: detail.questions.map((question) => ({
                  prompt: question.prompt,
                  options: question.options,
                  explanations: question.explanations,
                })),
              },
            }
          : {})}
        ai={ai}
        {...(editorAi?.fill ? { fillAi: editorAi.fill } : {})}
        liveSlug={sourceTranslation?.slug ?? ""}
        siteUrl={siteOrigin()}
        canPublish={can(subject, "lessons.publish")}
        canUpdate={can(subject, "lessons.update")}
        statusLabels={statusLabels}
        initial={{
          quizId: detail.id,
          status: detail.status,
          legalTransitions: detail.legalTransitions,
          publishedAt: detail.publishedAt ? formatDateTime(detail.publishedAt) : null,
          scheduledFor: detail.scheduledFor ? formatDateTime(detail.scheduledFor) : null,
          updatedAt: formatDateTime(detail.updatedAt),
          locale,
          title: translation?.title ?? "",
          slug: translation?.slug ?? "",
          description: translation?.description ?? "",
          passingScore: detail.passingScore,
          maxAttempts: detail.maxAttempts,
          showAnswersAfter: detail.showAnswersAfter,
          track: detail.track,
          isStandalone: detail.isStandalone,
          category: detail.category ?? "",
          cover: { id: detail.coverAssetId, url: detail.coverUrl },
          flags: {
            isFeatured: detail.isFeatured,
            isActive: detail.isActive,
            isPremium: detail.isPremium,
          },
          questions,
        }}
      />
    </EditorPage>
  );
}
