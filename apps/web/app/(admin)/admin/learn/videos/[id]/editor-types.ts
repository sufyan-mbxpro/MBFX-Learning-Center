// Shared shapes for the video topic editor (changes-16 PR 6, ADR-068).
import type { ContentStatusLabels } from "../../../_components/editor/content-status-panel.tsx";
import type { RichTextLabels } from "../../../_components/rich-text-editor.tsx";
import type { LinkDraft, LinksPanelLabels } from "./_panels/links-panel.tsx";
import type { VideoDraft, VideosPanelLabels } from "./_panels/videos-panel.tsx";

import type { ContentFlags } from "../../../_components/editor/content-flags-fields.tsx";

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
  /**
   * Untouched AI output (changes-29 B3). Set by "Translate", cleared by any
   * edit to a translatable field; the save turns it into `MACHINE_TRANSLATED`.
   */
  machineTranslated?: boolean;
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
  /** ADR-139 â€” Featured / Active / Premium, edited in the Display card. */
  flags: ContentFlags;
  /** ADR-144 §2 — also listed on every other school's video pages. */
  showOnAllTracks: boolean;
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
  displaySection: string;
  displaySectionDescription: string;
  trackLabel: string;
  trackHint: string;
  categoryLabel: string;
  categoryHint: string;
  categoryNone: string;
  newCategory: string;
  showOnAllTracksLabel: string;
  showOnAllTracksHint: string;
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
