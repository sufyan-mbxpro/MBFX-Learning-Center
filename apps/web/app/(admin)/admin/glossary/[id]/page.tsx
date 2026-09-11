import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadGlossaryTermAdminDetail, listGlossaryTopics } from "@repo/core";
import { LEARN_TRACK_KEYS } from "@repo/contracts";
import { getActiveLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../_components/admin-page.tsx";
import { richTextLabels } from "../../_components/editor-labels.ts";
import { trackLabels } from "../../learn/_lib/learn-labels.ts";
import { GlossaryEditor } from "./glossary-editor.tsx";
import type { GlossaryEditorLabels } from "./editor-types.ts";

// Glossary term editor (ADR-069). Read gate here; every write re-gates in its
// own action (security.md #1).
export default async function GlossaryTermEditPage({ params }: PageProps<"/admin/glossary/[id]">) {
  const subject = await requirePermission("glossary.view");
  const { id } = await params;

  const [t, detail, topics, activeLocales] = await Promise.all([
    getTranslations("admin"),
    loadGlossaryTermAdminDetail(id),
    listGlossaryTopics(),
    getActiveLocales(),
  ]);
  if (!detail) notFound();

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

  const statusLabels: Record<string, string> = {
    DRAFT: t("statusDraft"),
    IN_REVIEW: t("statusInReview"),
    SEO_REVIEW: t("statusSeoReview"),
    APPROVED: t("statusApproved"),
    SCHEDULED: t("statusScheduled"),
    PUBLISHED: t("statusPublished"),
    ARCHIVED: t("statusArchived"),
    OUTDATED: t("statusOutdated"),
  };

  const defaultTranslation =
    detail.translations.find((tr) => tr.locale === routing.defaultLocale) ?? detail.translations[0];

  const labels: GlossaryEditorLabels = {
    updateTerm: t("glossaryEditor.updateTerm"),
    saved: t("saved"),
    viewLive: t("viewLive"),
    openActions: t("openActions"),
    softDelete: t("softDelete"),
    restore: t("restore"),
    confirmDeleteTitle: t("confirmDeleteGlossaryTitle"),
    confirmDeleteBody: t("confirmDeleteGlossaryBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),

    definitionSection: t("glossaryEditor.definitionSection"),
    definitionSectionDescription: t("glossaryEditor.definitionSectionDescription"),
    localeLabel: t("localeLabel"),
    termLabel: t("termLabel"),
    slugLabel: t("slugLabel"),
    termUrl: t("postUrlLabel"),
    simpleLabel: t("glossaryEditor.simpleLabel"),
    simpleHint: t("glossaryEditor.simpleHint"),
    detailedLabel: t("glossaryEditor.detailedLabel"),
    detailedHint: t("glossaryEditor.detailedHint"),
    advancedLabel: t("glossaryEditor.advancedLabel"),
    advancedHint: t("glossaryEditor.advancedHint"),
    exampleLabel: t("glossaryEditor.exampleLabel"),
    exampleHint: t("glossaryEditor.exampleHint"),

    filingSection: t("glossaryEditor.filingSection"),
    filingSectionDescription: t("glossaryEditor.filingSectionDescription"),
    topicLabel: t("glossaryEditor.topicLabel"),
    topicHint: t("glossaryEditor.topicHint"),
    topicNone: t("glossaryEditor.topicNone"),
    topicCreate: t("topics.create"),
    topicCreateTitle: t("topics.createTitle"),
    topicCreateDescription: t("topics.createDescription"),
    topicNameLabel: t("topics.nameLabel"),
    create: t("create"),
    trackLabel: t("trackLabel"),
    trackHint: t("glossaryEditor.trackHint"),
    trackBoth: t("glossaryTrackBoth"),
    difficultyLabel: t("difficultyLabel"),
    formulaLabel: t("glossaryEditor.formulaLabel"),
    formulaHint: t("glossaryEditor.formulaHint"),
    imageLabel: t("glossaryEditor.imageLabel"),

    seoSection: t("seoSection"),
    seoSectionDescription: t("seoSectionDescription"),
    seoTitleLabel: t("seoTitleLabel"),
    seoTitleHint: t("seoTitleHint"),
    seoDescriptionLabel: t("seoDescriptionLabel"),
    seoDescriptionHint: t("seoDescriptionHint"),

    infoSection: t("glossaryEditor.infoSection"),
    infoSectionDescription: t("glossaryEditor.infoSectionDescription"),
    idLabel: t("idLabel"),
    createdLabel: t("createdLabel"),
    updatedLabel: t("updatedLabel"),
    viewCountLabel: t("glossaryEditor.viewCountLabel"),

    difficulties: {
      BEGINNER: t("difficultyBeginner"),
      INTERMEDIATE: t("difficultyIntermediate"),
      ADVANCED: t("difficultyAdvanced"),
    },
    tracks: Object.fromEntries(
      LEARN_TRACK_KEYS.map((key) => [key, trackLabels(t)[key] ?? key]),
    ) as Record<string, string>,
    statusLabels,

    status: {
      section: t("publishingSection"),
      description: t("publishingSectionDescription"),
      hint: t("publishingHint"),
      exhausted: t("transitionsExhausted"),
      statusLabel: t("statusLabel"),
      statusLabels,
      transitions: statusLabels,
      publishedLabel: t("publishedLabel"),
      scheduledLabel: t("scheduledLabel"),
      scheduleFor: t("scheduleForLabel"),
      presetPlusHour: t("schedulePlusHour"),
      presetTomorrow9: t("scheduleTomorrow9"),
      presetNextWeek: t("scheduleNextWeek"),
      presetClear: t("scheduleClear"),
      updatedLabel: t("updatedLabel"),
      confirmArchiveTitle: t("glossaryEditor.confirmArchiveTitle"),
      confirmArchiveBody: t("glossaryEditor.confirmArchiveBody"),
      confirm: t("confirm"),
      cancel: t("cancel"),
    },
    analysis: {
      score: t("seoScoreLabel"),
      checks: {
        titleLength: t("seoCheckTitleLength"),
        descriptionLength: t("seoCheckDescriptionLength"),
        focusKeywordInTitle: t("seoCheckKeywordInTitle"),
        focusKeywordInDescription: t("seoCheckKeywordInDescription"),
        focusKeywordInFirstParagraph: t("seoCheckKeywordEarly"),
        contentLength: t("seoCheckContentLength"),
        hasSubheadings: t("seoCheckSubheadings"),
        hasImages: t("seoCheckImages"),
        hasInternalLink: t("seoCheckInternalLink"),
      },
    },
    faq: {
      section: t("faqSection"),
      description: t("glossaryEditor.faqSectionDescription"),
      emptyTitle: t("glossaryEditor.faqEmptyTitle"),
      emptyBody: t("glossaryEditor.faqEmptyBody"),
      add: t("addFaq"),
      addFirst: t("addFirstFaq"),
      edit: t("editFaq"),
      dialogDescription: t("faqDialogDescription"),
      answerHint: t("faqAnswerHint"),
      saveItem: t("faqSaveItem"),
      unanswered: t("faqUnanswered"),
      question: t("questionLabel"),
      answer: t("answerLabel"),
      remove: t("remove"),
      cancel: t("cancel"),
      confirm: t("confirm"),
      confirmRemoveTitle: t("confirmRemoveFaqTitle"),
      confirmRemoveBody: t("confirmRemoveFaqBody"),
      moveUp: t("moveUp"),
      moveDown: t("moveDown"),
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
    <AdminPage
      title={defaultTranslation?.term || t("untitled")}
      description={t("pageDesc.glossaryDetail")}
      backHref="/admin/glossary"
      backLabel={t("glossaryEditor.backToList")}
    >
      <GlossaryEditor
        term={{
          id: detail.id,
          status: detail.status,
          topicId: detail.topicId,
          track: detail.track,
          difficulty: detail.difficulty,
          formula: detail.formula ?? "",
          imageUrl: detail.imageUrl,
          viewCount: detail.viewCount,
          publishedAt: detail.publishedAt ? dateFormat.format(detail.publishedAt) : null,
          scheduledFor: detail.scheduledFor ? dateFormat.format(detail.scheduledFor) : null,
          createdAt: dateFormat.format(detail.createdAt),
          updatedAt: dateFormat.format(detail.updatedAt),
          deleted: detail.deletedAt !== null,
          // The prefill ADR-069 exists to deliver: every stored field, in
          // every locale, reaching the form as its initial value.
          translations: detail.translations.map((tr) => ({
            locale: tr.locale,
            term: tr.term,
            slug: tr.slug,
            simpleExplanation: tr.simpleExplanation,
            detailedExplanation: tr.detailedExplanation ?? "",
            advancedExplanation: tr.advancedExplanation ?? "",
            exampleScenario: tr.exampleScenario ?? "",
            faq: tr.faq,
            seoTitle: tr.seoTitle ?? "",
            seoDescription: tr.seoDescription ?? "",
            translationStatus: tr.translationStatus,
          })),
          legalTransitions: detail.legalTransitions,
        }}
        topicOptions={topics.map((topic) => ({
          id: topic.id,
          name: topic.name || t("untitled"),
        }))}
        locales={activeLocales.map((l) => l.code)}
        defaultLocale={routing.defaultLocale}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        canUpdate={can(subject, "glossary.update")}
        canPublish={can(subject, "glossary.publish")}
        canDelete={can(subject, "glossary.delete")}
        canCreateTopic={can(subject, "glossary.create")}
        labels={labels}
      />
    </AdminPage>
  );
}
