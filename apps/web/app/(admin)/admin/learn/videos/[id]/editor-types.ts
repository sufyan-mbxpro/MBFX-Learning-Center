// Shared shapes for the video topic editor (changes-16 PR 6, ADR-068).
import type { ContentStatusLabels } from "../../../_components/editor/content-status-panel.tsx";
import type { SeoAnalysisLabels } from "../../../_components/editor/seo-analysis.tsx";
import type { RichTextLabels } from "../../../_components/rich-text-editor.tsx";
import type { LinkDraft, LinksPanelLabels } from "./_panels/links-panel.tsx";
import type { VideoDraft, VideosPanelLabels } from "./_panels/videos-panel.tsx";

export interface VideoTranslationDraft {
  locale: string;
  title: string;
  slug: string;
  summary: string;
  /** Rich text, sanitized server-side on save regardless of what is sent. */
  content: string;
  seoTitle: string;
  seoDescription: string;
  seoFocusKeyword: string;
  translationStatus: string;
}

export interface VideoTopicData {
  id: string;
  status: string;
  /** Required — it is the URL's second segment (ADR-068 §1), never a filter. */
  track: string;
  /** Null = uncategorised. Taxonomy, not address: a topic outlives its category. */
  categoryId: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  visibility: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  translations: VideoTranslationDraft[];
  /**
   * Not translatable and shared across every locale (ADR-068 §4/§5) — which is
   * why they live here rather than on the translation draft. A video is one
   * recording whichever language the page is read in.
   */
  videos: VideoDraft[];
  links: LinkDraft[];
  legalTransitions: string[];
}

export interface VideoEditorLabels {
  // Header
  updateTopic: string;
  saved: string;
  viewLive: string;
  openActions: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;

  // Body
  bodySection: string;
  bodySectionDescription: string;
  localeLabel: string;
  titleLabel: string;
  slugLabel: string;
  topicUrl: string;
  summaryLabel: string;
  summaryHint: string;
  contentLabel: string;
  contentHint: string;
  capabilityWarning: string;

  // Filing
  filingSection: string;
  filingSectionDescription: string;
  trackLabel: string;
  trackHint: string;
  categoryLabel: string;
  categoryHint: string;
  categoryNone: string;
  visibilityLabel: string;
  coverLabel: string;

  // SEO
  seoSection: string;
  seoSectionDescription: string;
  seoTitleLabel: string;
  seoTitleHint: string;
  seoDescriptionLabel: string;
  seoDescriptionHint: string;
  seoKeywordLabel: string;
  seoKeywordHint: string;

  // Info
  infoSection: string;
  infoSectionDescription: string;
  idLabel: string;
  createdLabel: string;
  updatedLabel: string;

  // Enum maps — a raw identifier never renders (ADR-044 #5).
  tracks: Record<string, string>;
  visibilities: Record<string, string>;
  statusLabels: Record<string, string>;

  // Nested panels
  status: ContentStatusLabels;
  analysis: SeoAnalysisLabels;
  videos: VideosPanelLabels;
  links: LinksPanelLabels;
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
