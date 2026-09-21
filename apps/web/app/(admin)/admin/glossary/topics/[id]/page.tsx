import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadGlossaryTopicAdminDetail } from "@repo/core";
import { getAuthoringLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { EditorPage } from "../../../_components/admin-page.tsx";
import { richTextLabels } from "../../../_components/editor-labels.ts";
import { loadEditorAi } from "../../../_lib/editor-ai.ts";
import { TopicEditor } from "./topic-editor.tsx";
import type { TopicEditorLabels, TopicTranslationDraft } from "./editor-types.ts";

// Glossary topic editor (changes-18 PR 3). Read gate here; every write re-gates
// in its own action (security.md #1).
export default async function GlossaryTopicEditPage({
  params,
}: PageProps<"/admin/glossary/topics/[id]">) {
  const subject = await requirePermission("glossary.view");
  const { id } = await params;

  const [t, detail, authoringLocales, ai] = await Promise.all([
    getTranslations("admin"),
    loadGlossaryTopicAdminDetail(id),
    getAuthoringLocales(),
    // ADR-126: the "Generate with AI" bar, each field's ✨ menu, and the
    // writing assistant on the description — each present only when available.
    loadEditorAi(subject, {
      module: "glossary_topic",
      entity: { type: "glossary_topic", id },
      contentKeys: ["glossary.update"],
    }),
  ]);
  if (!detail) notFound();

  const locales = authoringLocales.map((locale) => locale.code);

  // One draft per AUTHORING locale (every seeded one, active or not), seeded
  // from the stored row where there is one and blank where there is not — so a
  // locale with no translation yet is an empty form rather than a missing tab.
  // Only `en` is active, which is exactly why this is not the active list: it
  // hid the switcher.
  const translations: TopicTranslationDraft[] = locales.map((locale) => {
    const stored = detail.translations.find((tr) => tr.locale === locale);
    return {
      locale,
      name: stored?.name ?? "",
      slug: stored?.slug ?? "",
      description: stored?.description ?? "",
      seoTitle: stored?.seoTitle ?? "",
      seoDescription: stored?.seoDescription ?? "",
      seoKeywords: stored?.seoKeywords ?? "",
    };
  });

  const labels: TopicEditorLabels = {
    save: t("save"),
    saved: t("saved"),
    saveHint: t("topics.saveHint"),
    viewLive: t("viewLive"),
    openActions: t("openActions"),
    duplicate: t("duplicate"),
    deleteTopic: t("delete"),
    confirmDeleteTitle: t("topics.confirmDeleteTitle"),
    confirmDeleteBody: t("topics.confirmDeleteBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),

    published: t("topics.published"),
    draft: t("topics.draft"),
    termCount: t("topics.columnTerms"),
    localeLabel: t("localeLabel"),

    detailsSection: t("topics.detailsSection"),
    detailsSectionDescription: t("topics.detailsSectionDescription"),
    nameLabel: t("topics.nameLabel"),
    descriptionLabel: t("topics.descriptionLabel"),
    descriptionHint: t("topics.descriptionHint"),
    slug: {
      label: t("slugLabel"),
      urlLabel: t("topics.topicUrl"),
      willBeSaved: t("topics.slugWillBeSaved"),
      derivedFromTitle: t("topics.slugDerived"),
    },

    seoSection: t("topics.seoSection"),
    seoSectionDescription: t("topics.seoSectionDescription"),
    seoTitleLabel: t("seoTitleLabel"),
    seoTitleHint: t("topics.seoTitleHint"),
    seoDescriptionLabel: t("seoDescriptionLabel"),
    seoKeywordsLabel: t("topics.seoKeywordsLabel"),
    seoKeywordsHint: t("topics.seoKeywordsHint"),

    visibilitySection: t("topics.visibilitySection"),
    visibilitySectionDescription: t("topics.visibilitySectionDescription"),
    publishedLabel: t("topics.publishedLabel"),
    publishedHint: t("topics.publishedHint"),

    coverSection: t("topics.coverSection"),
    coverSectionDescription: t("topics.coverSectionDescription"),
    coverLabel: t("topics.coverLabel"),
    upload: {
      upload: t("uploadImage"),
      replace: t("replaceImage"),
      remove: t("removeImage"),
      uploading: t("uploading"),
      hint: t("topics.coverHint"),
      cancel: t("cancel"),
      confirmRemoveTitle: t("confirmRemoveImageTitle"),
      confirmRemoveBody: t("confirmRemoveImageBody"),
    },
  };

  return (
    <EditorPage
      title={t("editorHeading.glossaryTopic")}
      description={t("topics.editorDescription")}
      backHref="/admin/glossary/topics"
      backLabel={t("glossaryTopics")}
    >
      <TopicEditor
        topic={{
          id: detail.id,
          isActive: detail.isActive,
          isFeatured: detail.isFeatured,
          isPremium: detail.isPremium,
          cover: { id: detail.coverAssetId, url: detail.coverUrl },
          termCount: detail.termCount,
          defaultLocale: routing.defaultLocale,
          translations,
        }}
        locales={locales}
        canUpdate={can(subject, "glossary.update")}
        canCreate={can(subject, "glossary.create")}
        canDelete={can(subject, "glossary.delete")}
        labels={labels}
        richTextLabels={richTextLabels(t)}
        {...(ai ? { ai } : {})}
      />
    </EditorPage>
  );
}
