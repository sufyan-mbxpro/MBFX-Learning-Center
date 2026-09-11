// Shared shapes for the glossary term editor (ADR-069, changes-17 PR 2).
import type { GlossaryFaqItemInput } from "@repo/contracts";
import type { ContentStatusLabels } from "../../_components/editor/content-status-panel.tsx";
import type { SeoAnalysisLabels } from "../../_components/editor/seo-analysis.tsx";
import type { RichTextLabels } from "../../_components/rich-text-editor.tsx";
import type { FaqLabels } from "../../_components/editor/faq-panel.tsx";

export interface GlossaryTranslationDraft {
  locale: string;
  term: string;
  slug: string;
  /** The only required body — it is what the A–Z list and the term-of-the-day card render. */
  simpleExplanation: string;
  detailedExplanation: string;
  advancedExplanation: string;
  exampleScenario: string;
  faq: GlossaryFaqItemInput[];
  seoTitle: string;
  seoDescription: string;
  translationStatus: string;
}

export interface GlossaryTermData {
  id: string;
  status: string;
  /** Null = UNFILED. Not the same null as `track` — see ADR-069 §3. */
  topicId: string | null;
  /** Null = EVERY school (ADR-065 §3). */
  track: string | null;
  difficulty: string;
  formula: string;
  imageUrl: string | null;
  viewCount: number;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  translations: GlossaryTranslationDraft[];
  legalTransitions: string[];
}

export interface GlossaryEditorLabels {
  // Header
  updateTerm: string;
  saved: string;
  viewLive: string;
  openActions: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;

  // Definition
  definitionSection: string;
  definitionSectionDescription: string;
  localeLabel: string;
  termLabel: string;
  slugLabel: string;
  termUrl: string;
  simpleLabel: string;
  simpleHint: string;
  detailedLabel: string;
  detailedHint: string;
  advancedLabel: string;
  advancedHint: string;
  exampleLabel: string;
  exampleHint: string;

  // Filing
  filingSection: string;
  filingSectionDescription: string;
  topicLabel: string;
  topicHint: string;
  topicNone: string;
  topicCreate: string;
  topicCreateTitle: string;
  topicCreateDescription: string;
  topicNameLabel: string;
  create: string;
  trackLabel: string;
  trackHint: string;
  trackBoth: string;
  difficultyLabel: string;
  formulaLabel: string;
  formulaHint: string;
  imageLabel: string;

  // SEO
  seoSection: string;
  seoSectionDescription: string;
  seoTitleLabel: string;
  seoTitleHint: string;
  seoDescriptionLabel: string;
  seoDescriptionHint: string;

  // Info
  infoSection: string;
  infoSectionDescription: string;
  idLabel: string;
  createdLabel: string;
  updatedLabel: string;
  viewCountLabel: string;

  // Enum maps — a raw identifier never renders (ADR-044 #5).
  difficulties: Record<string, string>;
  tracks: Record<string, string>;
  statusLabels: Record<string, string>;

  // Nested panels
  status: ContentStatusLabels;
  analysis: SeoAnalysisLabels;
  faq: FaqLabels;
  editor: RichTextLabels;
  upload: {
    upload: string;
    replace: string;
    remove: string;
    uploading: string;
    hint: string;
    cancel: string;
    confirmRemoveTitle: string;
    confirmRemoveBody: string;
  };
}
