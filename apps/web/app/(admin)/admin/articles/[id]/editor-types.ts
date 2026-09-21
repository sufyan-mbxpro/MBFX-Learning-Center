// Shared shapes for the article editor v2 (changes-07). Extracted so the shell
// and its panels agree without importing each other, and so `page.tsx` has one
// place to look when building props.
import type { SeoCheckId } from "@repo/utils";
import type { ImageUploadLabels } from "../../_components/image-upload-field.tsx";
import type { RichTextLabels } from "../../_components/rich-text-editor.tsx";
import type { ContentStatsLabels } from "../../_components/editor/content-stats.tsx";
import type { FaqLabels } from "../../_components/editor/faq-panel.tsx";
import type { RelatedLabels } from "./_panels/related-panel.tsx";
import type { PublishLabels } from "./_panels/publish-panel.tsx";
import type { TaxonomyLabels } from "./_panels/taxonomy-panel.tsx";

/** A FAQ row being edited. `id` present = an existing row to update in place. */
export interface FaqDraft {
  id?: string;
  question: string;
  answer: string;
}

/**
 * One locale's editable state. Strings rather than `string | null` throughout:
 * a controlled input needs "" not null, and the save maps "" back to null at
 * the boundary.
 */
export interface TranslationDraft {
  locale: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  ogImageAssetId: string | null;
  canonicalUrl: string;
  noIndex: boolean;
  focusKeywords: string;
  noFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  twitterCard: string;
  twitterImageUrl: string;
  twitterImageAssetId: string | null;
  faqItems: FaqDraft[];
  /** 3-5 short takeaways (changes-29 B4). Empty means the block does not render. */
  keyTakeaways: string[];
  translationStatus: string;
  /**
   * This draft's text came from AI and has not been edited since
   * (changes-29 B3).
   *
   * It rides with the SAVE and decides one thing there: `MACHINE_TRANSLATED`
   * rather than `TRANSLATED`. `setTr` clears it whenever a translatable field
   * changes, which is what makes "has not been edited since" a fact rather than
   * a hope — and what makes a human's Save the promotion.
   */
  machineTranslated?: boolean;
}

/**
 * The fields B3 translates: prose only.
 *
 * `slug` is deliberately absent — a slug change writes a `Redirect` and is an
 * SEO act — and so is every image, URL and boolean. A model is asked for the
 * words and nothing else.
 */
export const TRANSLATABLE_FIELDS = [
  "title",
  "excerpt",
  "body",
  "seoTitle",
  "seoDescription",
  "ogTitle",
  "ogDescription",
] as const satisfies readonly (keyof TranslationDraft)[];

export function translatableFields(draft: TranslationDraft | undefined): Record<string, string> {
  if (!draft) return {};
  const fields: Record<string, string> = {};
  for (const name of TRANSLATABLE_FIELDS) {
    const value = draft[name];
    if (typeof value === "string" && value.trim()) fields[name] = value;
  }
  return fields;
}

export interface ArticleData {
  id: string;
  kind: string;
  status: string;
  isActive: boolean;
  isPremium: boolean;
  isFeatured: boolean;
  coverImageUrl: string | null;
  coverImageAssetId: string | null;
  headerImageUrl: string | null;
  headerImageAssetId: string | null;
  videoUrl: string | null;
  showRelated: boolean;
  relatedCount: number;
  categoryId: string;
  source: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  deleted: boolean;
  tagIds: string[];
  relatedArticleIds: string[];
  translations: TranslationDraft[];
  legalTransitions: string[];
}

export interface EditorLabels {
  kinds: Record<string, string>;
  statusLabels: Record<string, string>;

  // Header
  cancel: string;
  confirm: string;
  previewDraft: string;
  viewLive: string;
  /** The header's primary button says what the click will DO: "Publish"
   * while the post is an unpublished draft the actor may publish, "Update"
   * once it is live (or when they may not publish). Both run the same
   * save-then-publish submit — see article-editor.tsx. */
  updatePost: string;
  publishPost: string;
  publishedToast: string;
  openActions: string;
  duplicate: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  saved: string;

  // Content panel
  content: string;
  contentDescription: string;
  localeLabel: string;
  titleLabel: string;
  slugLabel: string;
  postUrl: string;
  body: string;
  excerpt: string;

  // SEO panel
  seoSection: string;
  seoSectionDescription: string;
  seoTabBasic: string;
  seoTabSocial: string;
  seoTabAdvanced: string;
  seoTabAnalysis: string;
  seoTitle: string;
  seoTitleHint: string;
  seoDescription: string;
  seoDescriptionHint: string;
  focusKeywords: string;
  focusKeywordsHint: string;
  canonicalUrl: string;
  canonicalUrlHint: string;
  canonicalDefault: string;
  allowIndex: string;
  allowFollow: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterCard: string;
  twitterCardOptions: Record<string, string>;
  twitterImage: string;
  robotsSummaryHint: string;
  robotsIndexRow: string;
  robotsFollowRow: string;

  // Post settings
  postSettings: string;
  postSettingsDescription: string;
  mediaTabImage: string;
  mediaTabVideo: string;
  coverImageUrl: string;
  videoUrl: string;
  videoInvalid: string;
  headerImage: string;
  headerImageHint: string;
  featuredPost: string;
  activeLabel: string;
  premium: string;
  premiumHint: string;

  // Post information
  postInfo: string;
  postInfoDescription: string;
  kind: string;
  createdLabel: string;
  createdValue: string;
  updatedLabel: string;
  idLabel: string;
  sourceLabel: string;
  sourceUrlLabel: string;

  // Nested panels
  stats: ContentStatsLabels;
  faq: FaqLabels;
  related: RelatedLabels;
  publish: PublishLabels;
  taxonomy: TaxonomyLabels;
  editor: RichTextLabels;
  upload: ImageUploadLabels;
}

export type { SeoCheckId };
