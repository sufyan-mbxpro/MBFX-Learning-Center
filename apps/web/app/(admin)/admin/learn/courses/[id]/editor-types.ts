// Shared shapes for the course builder (changes-11 PRs 3.2/3.3). Extracted for
// the same reason the article editor has one: the shell and its panels agree
// without importing each other, and `page.tsx` has one place to look when it
// builds props.
import type { ContentStatusLabels } from "../../../_components/editor/content-status-panel.tsx";
import type { FaqLabels } from "../../../_components/editor/faq-panel.tsx";
import type { ImageUploadLabels } from "../../../_components/image-upload-field.tsx";
import type { RichTextLabels } from "../../../_components/rich-text-editor.tsx";
import type { CurriculumLabels } from "./_panels/curriculum-panel.tsx";
import type { RecommendationsLabels } from "./_panels/recommendations-panel.tsx";

/**
 * One locale's editable state. Strings rather than `string | null` throughout:
 * a controlled input needs "" not null, and the save maps "" back to null at
 * the boundary — the article editor's convention, kept so the two screens read
 * the same way.
 */
import type { ContentFlags } from "../../../_components/editor/content-flags-fields.tsx";

export interface CourseTranslationDraft {
  locale: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoFocusKeyword: string;
  /** changes-49 — this locale's questions; `[]` for none. */
  faq: { question: string; answer: string }[];
  translationStatus: string;
  /**
   * Untouched AI output (changes-29 B3). Set by "Translate", cleared by any
   * edit to a translatable field; the save turns it into `MACHINE_TRANSLATED`.
   */
  machineTranslated?: boolean;
}

export interface CourseData {
  id: string;
  track: string;
  status: string;
  difficulty: string;
  /** A string because it drives a number input; "" means "not set" → null. */
  estimatedHours: string;
  finalQuizId: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  /** ADR-139 â€” Featured / Active / Premium, edited in the Display card. */
  flags: ContentFlags;
  externalUrl: string;
  visibility: string;
  sortOrder: number;
  lessonCount: number;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  translations: CourseTranslationDraft[];
  recommendations: string[];
  legalTransitions: string[];
}

export interface CourseEditorLabels {
  // Header
  tabDetails: string;
  tabCurriculum: string;
  tabRecommendations: string;
  tabSeo: string;
  tabFaq: string;
  updateCourse: string;
  saved: string;
  viewLive: string;
  openActions: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;

  // Details
  detailsSection: string;
  detailsSectionDescription: string;
  localeLabel: string;
  titleLabel: string;
  slugLabel: string;
  courseUrl: string;
  summaryLabel: string;
  summaryHint: string;
  descriptionLabel: string;

  // Settings
  settingsSection: string;
  settingsSectionDescription: string;
  displaySection: string;
  displaySectionDescription: string;
  trackLabel: string;
  difficultyLabel: string;
  visibilityLabel: string;
  estimatedHoursLabel: string;
  finalQuizLabel: string;
  finalQuizHint: string;
  noFinalQuiz: string;
  externalUrlLabel: string;
  externalUrlHint: string;
  coverImageLabel: string;
  sortOrderLabel: string;

  // SEO
  seoSection: string;
  seoSectionDescription: string;
  seoTitleLabel: string;
  seoTitleHint: string;
  seoDescriptionLabel: string;
  seoDescriptionHint: string;
  focusKeywordsLabel: string;
  focusKeywordsHint: string;

  // Info
  infoSection: string;
  infoSectionDescription: string;
  idLabel: string;
  createdLabel: string;
  updatedLabel: string;
  lessonsLabel: string;

  // Enum label maps
  tracks: Record<string, string>;
  difficulties: Record<string, string>;
  visibilities: Record<string, string>;
  statusLabels: Record<string, string>;

  // Nested panels
  status: ContentStatusLabels;
  curriculum: CurriculumLabels;
  recommendations: RecommendationsLabels;
  /** changes-49 — the course FAQ tab. */
  faq: FaqLabels;
  editor: RichTextLabels;
  upload: ImageUploadLabels;
}
