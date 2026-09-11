// Types shared between the topic editor route and its client component
// (changes-18 PR 3) — the split `glossary/[id]/editor-types.ts` already uses,
// so a server page can build the label bag without importing a client module.
import type { SlugFieldLabels } from "../../../_components/editor/slug-field.tsx";

export interface TopicTranslationDraft {
  locale: string;
  name: string;
  slug: string;
  /** RAW rich text. Flattening this is the ADR-069 bug. */
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

export interface TopicView {
  id: string;
  isActive: boolean;
  termCount: number;
  defaultLocale: string;
  translations: TopicTranslationDraft[];
}

export interface TopicEditorLabels {
  save: string;
  saved: string;
  saveHint: string;
  viewLive: string;
  openActions: string;
  duplicate: string;
  deleteTopic: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;

  published: string;
  draft: string;
  termCount: string;
  localeLabel: string;

  detailsSection: string;
  detailsSectionDescription: string;
  nameLabel: string;
  descriptionLabel: string;
  descriptionHint: string;
  slug: SlugFieldLabels;

  seoSection: string;
  seoSectionDescription: string;
  seoTitleLabel: string;
  seoTitleHint: string;
  seoDescriptionLabel: string;
  seoKeywordsLabel: string;
  seoKeywordsHint: string;

  visibilitySection: string;
  visibilitySectionDescription: string;
  publishedLabel: string;
  publishedHint: string;
}
