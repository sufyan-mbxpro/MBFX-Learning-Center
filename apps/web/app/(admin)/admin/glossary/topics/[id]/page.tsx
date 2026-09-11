import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadGlossaryTopicAdminDetail } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../../../_components/admin-page.tsx";
import { richTextLabels } from "../../../_components/editor-labels.ts";
import { TopicEditor } from "./topic-editor.tsx";
import type { TopicEditorLabels, TopicTranslationDraft } from "./editor-types.ts";

// Glossary topic editor (changes-18 PR 3). Read gate here; every write re-gates
// in its own action (security.md #1).
export default async function GlossaryTopicEditPage({
  params,
}: PageProps<"/admin/glossary/topics/[id]">) {
  const subject = await requirePermission("glossary.view");
  const { id } = await params;

  const [t, detail, activeLocales] = await Promise.all([
    getTranslations("admin"),
    loadGlossaryTopicAdminDetail(id),
    getActiveLocales(),
  ]);
  if (!detail) notFound();

  const locales = activeLocales.map((locale) => locale.code);

  // One draft per ACTIVE locale, seeded from the stored row where there is one
  // and blank where there is not — so a locale with no translation yet is an
  // empty form rather than a missing tab. ADR-043: the machinery is here for
  // all four; only `en` is active today.
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

  const defaultTranslation =
    translations.find((tr) => tr.locale === routing.defaultLocale) ?? translations[0];

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
  };

  return (
    <AdminPage
      title={defaultTranslation?.name || t("untitled")}
      description={t("topics.editorDescription")}
    >
      <TopicEditor
        topic={{
          id: detail.id,
          isActive: detail.isActive,
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
      />
    </AdminPage>
  );
}
