import { getTranslations } from "next-intl/server";
import { loadTranslationReviewQueue } from "@repo/core";
import { loadAuthoringLocales } from "@repo/i18n";
import { requirePermission } from "@repo/rbac";
import { formatDateTime, humanizeKey } from "@repo/utils";
import { ReviewTable, type ReviewLabels, type ReviewRowView } from "./review-table.tsx";

// Settings → Translation → Review (ADR-159 #5, ADR-163 #1): the translations a
// person should read — machine-written ones nobody has saved yet, ones whose
// English changed after a person saved them (OUTDATED), and ones where a figure
// changed in translation (NEEDS_REVIEW, ADR-160 #8). `translations.view`; opening one goes to its own editor, whose
// Save is the only thing that clears it.

/**
 * Where each type's translation is edited. Most open their own editor; a
 * course section, a quiz question and a tool are reached through a screen that
 * a review row cannot address directly (their editor is keyed by a parent, or
 * by the tool's key), so they open the list it lives on. Menu items have no
 * editor (ADR-038) and are not linked.
 */
const EDITOR_HREF: Record<string, (id: string, locale: string) => string> = {
  article: (id, locale) => `/keystone/articles/${id}?locale=${encodeURIComponent(locale)}`,
  course: (id) => `/keystone/learn/courses/${id}`,
  course_section: () => "/keystone/learn/courses",
  lesson: (id) => `/keystone/learn/lessons/${id}`,
  glossary_term: (id) => `/keystone/glossary/${id}`,
  glossary_topic: (id) => `/keystone/glossary/topics/${id}`,
  video_topic: (id) => `/keystone/learn/videos/${id}`,
  video_category: () => "/keystone/learn/videos/categories",
  tool: () => "/keystone/tools",
  article_category: () => "/keystone/articles/categories",
  article_tag: () => "/keystone/articles/tags",
  quiz: (id) => `/keystone/learn/quizzes/${id}`,
  quiz_question: () => "/keystone/learn/quizzes",
  promotion: (id, locale) => `/keystone/promotions/${id}?locale=${encodeURIComponent(locale)}`,
  // ADR-165 #8: every setting is on one screen, opened on the row's language.
  setting: (_id, locale) =>
    `/keystone/settings/translation/site-text?locale=${encodeURIComponent(locale)}`,
};

export default async function TranslationReviewPage() {
  await requirePermission("translations.view");
  const t = await getTranslations("admin.translate");
  const tAdmin = await getTranslations("admin");
  const [queue, locales] = await Promise.all([
    loadTranslationReviewQueue({ take: 500 }),
    loadAuthoringLocales(),
  ]);
  const targets = locales.filter((l) => !l.isDefault);
  const localeName = new Map(targets.map((l) => [l.code, l.name]));
  const typeLabel = (type: string) =>
    t.has(`entityTypes.${type}`) ? t(`entityTypes.${type}`) : humanizeKey(type);

  const rows: ReviewRowView[] = queue.map((row) => ({
    key: `${row.entityType}:${row.entityId}:${row.locale}`,
    title: row.title,
    sourceTitle: row.sourceTitle,
    locale: row.locale,
    language: localeName.get(row.locale) ?? row.locale,
    type: typeLabel(row.entityType),
    status: row.status,
    href: EDITOR_HREF[row.entityType]?.(row.entityId, row.locale) ?? null,
    updatedLabel: row.updatedAt ? formatDateTime(new Date(row.updatedAt)) : "—",
    updatedSort: row.updatedAt ? new Date(row.updatedAt).getTime() : 0,
  }));

  const labels: ReviewLabels = {
    table: {
      search: t("review.search"),
      columns: tAdmin("columns"),
      export: tAdmin("export"),
      selectedSuffix: tAdmin("selectedCount"),
      pageWord: tAdmin("pageWord"),
      ofWord: tAdmin("ofWord"),
      previous: tAdmin("previous"),
      next: tAdmin("next"),
      noResults: tAdmin("noResults"),
      actionsCol: tAdmin("actionsCol"),
    },
    titleCol: t("review.colTitle"),
    languageCol: t("overview.colLanguage"),
    typeCol: t("review.colType"),
    statusCol: t("overview.colStatus"),
    updatedCol: t("review.colUpdated"),
    sourceTitle: t("review.sourceTitle", { title: "{title}" }),
    statuses: {
      MACHINE_TRANSLATED: t("review.statusMachine"),
      OUTDATED: t("review.statusOutdated"),
      NEEDS_REVIEW: t("review.statusNeedsReview"),
    },
    open: t("review.open"),
    allLanguages: t("review.allLanguages"),
    languageFilter: t("review.languageFilter"),
    allStatuses: t("review.allStatuses"),
    statusFilter: t("review.statusFilter"),
    emptyTitle: t("review.emptyTitle"),
    emptyBody: t("review.emptyBody"),
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">{t("review.intro")}</p>
      <ReviewTable
        rows={rows}
        languages={targets.map((l) => ({ value: l.code, label: l.name }))}
        labels={labels}
      />
    </>
  );
}
