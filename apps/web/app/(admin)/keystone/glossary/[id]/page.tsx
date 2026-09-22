import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadGlossaryTermAdminDetail, listGlossaryTopics } from "@repo/core";
import { LEARN_TRACK_KEYS } from "@repo/contracts";
import { getAuthoringLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { EditorPage } from "../../_components/admin-page.tsx";
import { richTextLabels } from "../../_components/editor-labels.ts";
import { loadEditorAi } from "../../_lib/editor-ai.ts";
import { trackLabels } from "../../learn/_lib/learn-labels.ts";
import { GlossaryEditor } from "./glossary-editor.tsx";
import type { GlossaryEditorLabels } from "./editor-types.ts";
import { mergeGlossaryProse, type GlossaryProseHeadings } from "./merge-prose.ts";
import { formatDateTime, siteOrigin } from "@repo/utils";

// Glossary term editor (ADR-069). Read gate here; every write re-gates in its
// own action (security.md #1).
export default async function GlossaryTermEditPage({ params }: PageProps<"/keystone/glossary/[id]">) {
  const subject = await requirePermission("glossary.view");
  const { id } = await params;

  const [t, detail, topics, authoringLocales, ai] = await Promise.all([
    getTranslations("admin"),
    loadGlossaryTermAdminDetail(id),
    listGlossaryTopics(),
    getAuthoringLocales(),
    // ADR-126: the "Generate with AI" bar, each field's menu, and the writing
    // assistant on the Details body — each present only when available.
    loadEditorAi(subject, {
      module: "glossary_term",
      entity: { type: "glossary_term", id },
      contentKeys: ["glossary.update"],
    }),
  ]);
  if (!detail) notFound();

  // The public page's own section headings, in the translation's language
  // where that catalog has them (an inactive locale's may not — ADR-091),
  // English otherwise. The merged body is CONTENT in that language.
  const tGlossaryEn = await getTranslations({
    locale: routing.defaultLocale,
    namespace: "glossary",
  });
  const localHeadings = new Map<string, GlossaryProseHeadings>();
  await Promise.all(
    detail.translations.map(async (tr) => {
      const local = await getTranslations({ locale: tr.locale, namespace: "glossary" }).catch(
        () => tGlossaryEn,
      );
      const pick = (key: "detailedHeading" | "advancedHeading" | "exampleHeading") =>
        local.has(key) ? local(key) : tGlossaryEn(key);
      localHeadings.set(tr.locale, {
        detailed: pick("detailedHeading"),
        advanced: pick("advancedHeading"),
        example: pick("exampleHeading"),
      });
    }),
  );
  const headingsFor = (locale: string): GlossaryProseHeadings =>
    localHeadings.get(locale) ?? {
      detailed: tGlossaryEn("detailedHeading"),
      advanced: tGlossaryEn("advancedHeading"),
      example: tGlossaryEn("exampleHeading"),
    };

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
    detailsLabel: t("glossaryEditor.detailsLabel"),
    detailsHint: t("glossaryEditor.detailsHint"),

    filingSection: t("glossaryEditor.filingSection"),
    filingSectionDescription: t("glossaryEditor.filingSectionDescription"),
    displaySection: t("contentFlags.title"),
    displaySectionDescription: t("contentFlags.description"),
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
    <EditorPage
      title={t("editorHeading.glossaryTerm")}
      description={t("pageDesc.glossaryDetail")}
      backHref="/keystone/glossary"
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
          flags: {
            isFeatured: detail.isFeatured,
            isActive: detail.isActive,
            isPremium: detail.isPremium,
          },
          viewCount: detail.viewCount,
          publishedAt: detail.publishedAt ? formatDateTime(detail.publishedAt) : null,
          scheduledFor: detail.scheduledFor ? formatDateTime(detail.scheduledFor) : null,
          createdAt: formatDateTime(detail.createdAt),
          updatedAt: formatDateTime(detail.updatedAt),
          deleted: detail.deletedAt !== null,
          // The prefill ADR-069 exists to deliver: every stored field, in
          // every locale, reaching the form as its initial value.
          //
          // changes-46 #1: the four stored prose columns reach the ONE Details
          // editor merged, under the headings the public page gives them, so
          // the first Save of a legacy term keeps every word (merge-prose.ts).
          translations: detail.translations.map((tr) => ({
            locale: tr.locale,
            term: tr.term,
            slug: tr.slug,
            details: mergeGlossaryProse(tr, headingsFor(tr.locale)),
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
        locales={authoringLocales.map((l) => l.code)}
        defaultLocale={routing.defaultLocale}
        siteUrl={siteOrigin()}
        canUpdate={can(subject, "glossary.update")}
        canPublish={can(subject, "glossary.publish")}
        canDelete={can(subject, "glossary.delete")}
        canCreateTopic={can(subject, "glossary.create")}
        labels={labels}
        {...(ai ? { ai } : {})}
      />
    </EditorPage>
  );
}
