// Shared shapes for the lesson editor (changes-11 PR 3.4).
import type { ContentStatusLabels } from "../../../_components/editor/content-status-panel.tsx";
import type { SeoAnalysisLabels } from "../../../_components/editor/seo-analysis.tsx";
import type { RichTextLabels } from "../../../_components/rich-text-editor.tsx";
import type { AttachmentDraft, ResourcesLabels } from "./_panels/resources-panel.tsx";
import type { ObjectivesLabels } from "./_panels/objectives-panel.tsx";

export interface LessonTranslationDraft {
  locale: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  learningObjectives: string[];
  seoTitle: string;
  seoDescription: string;
  seoFocusKeyword: string;
  translationStatus: string;
}

export interface LessonData {
  id: string;
  sectionId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  difficulty: string;
  /** A string because it drives a number input; "" means "not set" → null. */
  estimatedMinutes: string;
  videoUrl: string;
  externalUrl: string;
  heroAssetId: string | null;
  heroUrl: string | null;
  completionRule: string;
  quizId: string | null;
  isRequired: boolean;
  prerequisiteLessonId: string | null;
  visibility: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  translations: LessonTranslationDraft[];
  attachments: AttachmentDraft[];
  legalTransitions: string[];
}

export interface LessonEditorLabels {
  // Header
  updateLesson: string;
  saved: string;
  viewLive: string;
  openActions: string;
  duplicate: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;

  // Content
  bodySection: string;
  bodySectionDescription: string;
  localeLabel: string;
  titleLabel: string;
  slugLabel: string;
  lessonUrl: string;
  summaryLabel: string;
  bodyLabel: string;

  // Placement
  placementSection: string;
  placementSectionDescription: string;
  courseLabel: string;
  sectionLabel: string;
  prerequisiteLabel: string;
  noPrerequisite: string;

  // Lesson settings
  settingsSection: string;
  settingsSectionDescription: string;
  difficultyLabel: string;
  visibilityLabel: string;
  estimatedMinutesLabel: string;
  completionRuleLabel: string;
  isRequiredLabel: string;
  isRequiredHint: string;
  quizLabel: string;
  quizHint: string;
  noQuiz: string;
  quizPassNeedsQuiz: string;

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

  // Enum maps
  difficulties: Record<string, string>;
  visibilities: Record<string, string>;
  completionRules: Record<string, string>;
  statusLabels: Record<string, string>;

  // Nested panels
  status: ContentStatusLabels;
  analysis: SeoAnalysisLabels;
  resources: ResourcesLabels;
  objectives: ObjectivesLabels;
  editor: RichTextLabels;
}
