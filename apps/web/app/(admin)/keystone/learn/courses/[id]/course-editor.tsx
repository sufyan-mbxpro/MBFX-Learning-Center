"use client";

// The course builder (changes-11 PRs 3.2/3.3).
//
// Four tabs, two save models — and the split is deliberate, not an oversight:
//
//   Details / Recommendations / SEO hold a DRAFT and commit together through
//   `saveCourseAction`, because they are one row's worth of editing and
//   `saveCourse` writes meta, translation and relations in ONE transaction.
//
//   Curriculum does NOT. Every control there is its own committed mutation
//   (curriculum-panel.tsx says why) — a structural change is not something to
//   hold in a browser tab.
//
// The LOCALE SWITCHER follows the article editor: per-translation fields
// (title, slug, summary, description, the SEO trio) swap with it; per-course
// fields (track, difficulty, cover, visibility, recommendations) do not. Edits
// are held in `drafts` so switching away and back does not lose them.
//
// ADR-043 #2: these labels are admin surface and English-only by design. The
// course CONTENT they edit is fully multilingual.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Info,
  MoreHorizontal,
  Search,
  ImageIcon,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import {
  contentVisibilitySchema,
  courseDifficultySchema,
  courseInputSchema,
  isLearnTrack,
  validateFields,
  type ContentVisibility,
  type CourseDifficulty,
  type CourseInput,
  type LearnTrackKey,
} from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { htmlToBlockText } from "@repo/utils";
import {
  saveCourseAction,
  setCourseDeletedAction,
  setCourseStatusAction,
} from "../../../_actions/learn-actions.ts";
import { AiFieldMenu, AiFillButton, type AiFillPatch } from "../../../_components/ai-fill.tsx";
import { AiSeoButton } from "../../../_components/ai-seo-dialog.tsx";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { ContentStatusPanel } from "../../../_components/editor/content-status-panel.tsx";
import { EditorSection, Field } from "../../../_components/editor/editor-section.tsx";
import { FaqPanel } from "../../../_components/editor/faq-panel.tsx";
import {
  ContentFlagsSection,
  type ContentFlags,
} from "../../../_components/editor/content-flags-fields.tsx";
import { SeoAnalysis } from "../../../_components/editor/seo-analysis.tsx";
import { ImageUploadField } from "../../../_components/image-upload-field.tsx";
import { RichTextEditor } from "../../../_components/rich-text-editor.tsx";
import {
  CONTENT_STATUS_TONE,
  StatusBadge,
  statusTone,
} from "../../../_components/status-badge.tsx";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import type { EditorAi } from "../../../_lib/editor-ai.ts";
import { liveHref, storedSlug } from "../../../_lib/live-href.ts";
import { TranslationControls } from "../../../_components/editor/translation-controls.tsx";
import {
  holdsHumanText,
  mergeTranslationPatch,
  textFields,
} from "../../../_lib/machine-translation.ts";
import { CurriculumPanel, type CurriculumSectionView } from "./_panels/curriculum-panel.tsx";
import {
  RecommendationsPanel,
  type RecommendationOption,
} from "./_panels/recommendations-panel.tsx";
import type { CourseData, CourseEditorLabels, CourseTranslationDraft } from "./editor-types.ts";
import { HeaderActions } from "../../../_components/header-actions.tsx";

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${value.length > max ? "text-destructive-interactive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

/** The words AI translation carries across. Never `slug` (a redirect is a human decision). */
const TRANSLATABLE_TEXT = [
  "title",
  "summary",
  "description",
  "seoTitle",
  "seoDescription",
  "seoFocusKeyword",
] as const satisfies readonly (keyof CourseTranslationDraft)[];
const TRANSLATABLE_FIELDS = TRANSLATABLE_TEXT;

/** The paths that live on the SEO tab; every other field is on Details. */
const SEO_PATHS = [
  "translation.seoTitle",
  "translation.seoDescription",
  "translation.seoFocusKeyword",
];

function blankTranslation(locale: string): CourseTranslationDraft {
  return {
    locale,
    title: "",
    slug: "",
    summary: "",
    description: "",
    seoTitle: "",
    seoDescription: "",
    seoFocusKeyword: "",
    faq: [],
    translationStatus: "DRAFT",
  };
}

export function CourseEditor({
  course,
  sections,
  recommendationOptions,
  quizOptions,
  fallbackPreview,
  trackKeys,
  locales,
  defaultLocale,
  siteUrl,
  canUpdate,
  canPublish,
  canDelete,
  canCreateLesson,
  canDeleteLesson,
  labels,
  ai,
}: {
  course: CourseData;
  sections: CurriculumSectionView[];
  recommendationOptions: RecommendationOption[];
  /** Every quiz an editor may set as this course's final (ADR-058 #1). */
  quizOptions: { id: string; title: string }[];
  fallbackPreview: { id: string; title: string }[];
  trackKeys: LearnTrackKey[];
  locales: string[];
  defaultLocale: string;
  siteUrl: string;
  canUpdate: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canCreateLesson: boolean;
  canDeleteLesson: boolean;
  labels: CourseEditorLabels;
  /** ADR-126. Absent when AI is off, the feature is off, or this person cannot spend. */
  ai?: EditorAi;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();

  const [tab, setTab] = useState("details");
  const [locale, setLocale] = useState(defaultLocale);
  const [drafts, setDrafts] = useState<Record<string, CourseTranslationDraft>>(() =>
    Object.fromEntries(course.translations.map((t) => [t.locale, t])),
  );
  // Narrowed on the way IN rather than cast on the way out: the row could
  // in principle hold a track key that has since left the registry, and the
  // honest response is to fall back to a registered one instead of sending
  // a value `saveCourseAction` will reject with a Zod error the editor
  // cannot explain.
  const [track, setTrack] = useState<LearnTrackKey>(() =>
    isLearnTrack(course.track) ? course.track : (trackKeys[0] ?? "forex"),
  );
  const [difficulty, setDifficulty] = useState<CourseDifficulty>(
    () => courseDifficultySchema.safeParse(course.difficulty).data ?? "BEGINNER",
  );
  const [visibility, setVisibility] = useState<ContentVisibility>(
    () => contentVisibilitySchema.safeParse(course.visibility).data ?? "PUBLIC",
  );
  const [estimatedHours, setEstimatedHours] = useState(course.estimatedHours);
  const [finalQuizId, setFinalQuizId] = useState<string | null>(course.finalQuizId);
  const [externalUrl, setExternalUrl] = useState(course.externalUrl);
  const [cover, setCover] = useState<{ id: string | null; url: string | null }>({
    id: course.coverAssetId,
    url: course.coverUrl,
  });
  const [flags, setFlags] = useState<ContentFlags>(course.flags);
  const [recommendations, setRecommendations] = useState<string[]>(course.recommendations);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const draft = drafts[locale] ?? blankTranslation(locale);
  // Merged from CURRENT state, not the last render: an AI patch and a keystroke
  // in the same tick would otherwise overwrite each other (ADR-126 §4).
  const setDraft = (patch: Partial<CourseTranslationDraft>) =>
    setDrafts((current) => ({
      ...current,
      // changes-29 B3: an edit to a translatable field clears the machine flag.
      [locale]: mergeTranslationPatch(
        current[locale] ?? blankTranslation(locale),
        patch,
        TRANSLATABLE_FIELDS,
      ),
    }));

  // ADR-126: the fillable fields as plain text — the review's "current" column,
  // the empty test behind each default tick, and the prompt's context.
  const aiFill = canUpdate ? ai?.fill : undefined;
  const aiSeo = canUpdate ? ai?.seo : undefined;
  const aiCurrent = {
    title: draft.title,
    summary: draft.summary,
    description: htmlToBlockText(draft.description),
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoFocusKeyword: draft.seoFocusKeyword,
  };
  const applyFill = (patch: AiFillPatch) => {
    const next: Partial<CourseTranslationDraft> = {};
    for (const key of Object.keys(aiCurrent) as (keyof typeof aiCurrent)[]) {
      const value = patch[key];
      if (typeof value === "string") next[key] = value;
    }
    setDraft(next);
  };
  const fieldMenu = (field: keyof typeof aiCurrent) =>
    aiFill ? (
      <AiFieldMenu
        config={aiFill}
        field={field}
        locale={locale}
        current={aiCurrent}
        onApply={(value) => setDraft({ [field]: value })}
      />
    ) : undefined;

  const publicPath = useMemo(
    () => `/${locale}/learn/${track}/${draft.slug || ""}`,
    [locale, track, draft.slug],
  );
  // Stored track and slug, not the form's: an unsaved edit has no page yet.
  const defaultSlug = storedSlug(course.translations, defaultLocale);
  const viewLiveHref = liveHref(`/learn/${course.track}/${defaultSlug}`, locale, defaultLocale);

  // Built on every render rather than at submit, so the inline validation
  // reads EXACTLY what `saveCourseAction` will be sent (ADR-077).
  const payload: CourseInput = {
    courseId: course.id,
    meta: {
      track,
      difficulty,
      visibility,
      estimatedHours: estimatedHours.trim() === "" ? null : Number(estimatedHours),
      coverAssetId: cover.id,
      externalUrl: externalUrl.trim() === "" ? null : externalUrl.trim(),
      finalQuizId,
      ...flags,
    },
    translation: {
      locale,
      title: draft.title.trim(),
      slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
      summary: draft.summary.trim() === "" ? null : draft.summary.trim(),
      description: draft.description.trim() === "" ? null : draft.description,
      seoTitle: draft.seoTitle.trim() === "" ? null : draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim() === "" ? null : draft.seoDescription.trim(),
      seoFocusKeyword: draft.seoFocusKeyword.trim() === "" ? null : draft.seoFocusKeyword.trim(),
      // Always sent, so removing the last question saves as `[]` (changes-49).
      faq: draft.faq,
      // changes-29 B3: sent only while the words are untouched AI output.
      ...(draft.machineTranslated ? { machineTranslated: true } : {}),
    },
    recommendations,
  };
  const form = useFieldErrors(courseInputSchema, payload);

  /**
   * `form.validate()`, plus opening the tab that holds the problem: an
   * inactive tab panel is not mounted, so the hook could not focus a field on
   * it. The tab switch lands in the same commit as the revealed messages, so
   * the field exists by the time the hook looks for it.
   */
  const validate = (): boolean => {
    if (form.validate()) return true;
    const paths = Object.keys(validateFields(courseInputSchema, payload));
    setTab(paths.length > 0 && paths.every((path) => SEO_PATHS.includes(path)) ? "seo" : "details");
    return false;
  };

  /**
   * One save for the whole screen, optionally followed by a transition — the
   * sequencing `PublishPanel` established. The two calls are SEQUENCED, not
   * merged: the transition still runs `courses.publish` inside the service, so
   * a save can never publish on behalf of an actor who may not.
   */
  const submitForm = async () => {
    await saveCourseAction(payload);
  };

  // changes-44 #3: the record's state and language travel with the content,
  // not on a row of their own above it.
  const stateCluster = (
    <>
      <StatusBadge tone={statusTone(CONTENT_STATUS_TONE, course.status)}>
        {labels.statusLabels[course.status] ?? course.status}
      </StatusBadge>
      {locales.length > 1 && (
        <AdminCombobox
          aria-label={labels.localeLabel}
          size="sm"
          className="w-24"
          value={locale}
          onValueChange={(next) => setLocale(next || locale)}
          options={locales.map((code) => ({ value: code, label: code.toUpperCase() }))}
        />
      )}
      <TranslationControls
        translate={ai?.translate}
        locale={locale}
        defaultLocale={defaultLocale}
        translationStatus={draft.translationStatus}
        machineTranslated={draft.machineTranslated}
        canUpdate={canUpdate}
        entity={{ type: "course", id: course.id }}
        sourceFields={textFields(drafts[defaultLocale], TRANSLATABLE_TEXT)}
        wouldOverwrite={holdsHumanText(draft, TRANSLATABLE_TEXT)}
        onApply={(translated) => setDraft({ ...translated, machineTranslated: true })}
      />
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ADR-140 §3: the actions sit on the page heading's row. */}
      <HeaderActions>
        {course.status === "PUBLISHED" && defaultSlug && (
          <Button
            variant="outline"
            render={
              <a href={`${siteUrl}${viewLiveHref}`} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink data-icon="inline-start" aria-hidden />
            {labels.viewLive}
          </Button>
        )}
        {canUpdate && (
          // Enabled while fields are wrong: pressing it names them (audit F-07).
          <Button
            loading={pending}
            onClick={() => {
              if (!validate()) return;
              run(() => submitForm(), { successMessage: labels.saved });
            }}
          >
            {labels.updateCourse}
          </Button>
        )}
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label={labels.openActions}>
                  <MoreHorizontal aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {/* Restore is the undo and is deliberately not confirmed
                  (ADR-044 #7); the destructive direction is. */}
              {course.deleted ? (
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => run(() => setCourseDeletedAction(course.id, false))}
                >
                  <SquareArrowOutUpRight aria-hidden data-icon="inline-start" />
                  {labels.restore}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 aria-hidden data-icon="inline-start" />
                  {labels.softDelete}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </HeaderActions>

      <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
        {/* changes-44 #3: the course's state and language share the tab row. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="details">{labels.tabDetails}</TabsTrigger>
            <TabsTrigger value="curriculum">{labels.tabCurriculum}</TabsTrigger>
            <TabsTrigger value="recommendations">{labels.tabRecommendations}</TabsTrigger>
            <TabsTrigger value="faq">{labels.tabFaq}</TabsTrigger>
            <TabsTrigger value="seo">{labels.tabSeo}</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">{stateCluster}</div>
        </div>

        {/* changes-50 (image-3): the settings rail — status, display, settings,
            flags, info — stays beside EVERY tab rather than only Details, so
            publishing and the course's settings are never a tab away. Each
            tab fills the main column. */}
        <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-(--grid-2-1)">
          <div className="flex min-w-0 flex-col">
            <TabsContent value="details">
              <div className="flex min-w-0 flex-col gap-4">
                <EditorSection
                  title={labels.detailsSection}
                  actions={
                    aiFill ? (
                      <AiFillButton
                        withOptions
                        config={aiFill}
                        locale={locale}
                        current={aiCurrent}
                        fieldLabels={{
                          title: labels.titleLabel,
                          summary: labels.summaryLabel,
                          description: labels.descriptionLabel,
                          seoTitle: labels.seoTitleLabel,
                          seoDescription: labels.seoDescriptionLabel,
                          seoFocusKeyword: labels.focusKeywordsLabel,
                        }}
                        onApply={applyFill}
                      />
                    ) : undefined
                  }
                  description={labels.detailsSectionDescription}
                  icon={SlidersHorizontal}
                  accent="primary"
                >
                  <Field
                    label={labels.titleLabel}
                    required
                    error={form.error("translation.title")}
                    adornment={
                      <span className="flex items-center gap-1">
                        {fieldMenu("title")}
                        <CharCount value={draft.title} max={255} />
                      </span>
                    }
                  >
                    <Input
                      value={draft.title}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft({ title: e.target.value })}
                    />
                  </Field>

                  <Field
                    label={labels.slugLabel}
                    hint={`${labels.courseUrl}: ${publicPath}`}
                    error={form.error("translation.slug")}
                  >
                    <Input
                      value={draft.slug}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft({ slug: e.target.value })}
                    />
                  </Field>

                  <Field
                    label={labels.summaryLabel}
                    hint={labels.summaryHint}
                    error={form.error("translation.summary")}
                    adornment={
                      <span className="flex items-center gap-1">
                        {fieldMenu("summary")}
                        <CharCount value={draft.summary} max={1000} />
                      </span>
                    }
                  >
                    <Textarea
                      rows={4}
                      value={draft.summary}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft({ summary: e.target.value })}
                    />
                  </Field>

                  <Field
                    label={labels.descriptionLabel}
                    error={form.error("translation.description")}
                  >
                    <RichTextEditor
                      value={draft.description}
                      onChange={(html) => setDraft({ description: html })}
                      labels={labels.editor}
                      allowHtmlMode
                      {...(ai?.assistant && canUpdate
                        ? { ai: { ...ai.assistant, config: { ...ai.assistant.config, locale } } }
                        : {})}
                    />
                  </Field>
                </EditorSection>
              </div>
            </TabsContent>

            <TabsContent value="curriculum">
              <CurriculumPanel
                courseId={course.id}
                sections={sections}
                locale={locale}
                canUpdate={canUpdate}
                canCreateLesson={canCreateLesson}
                canDeleteLesson={canDeleteLesson}
                labels={labels.curriculum}
              />
            </TabsContent>

            <TabsContent value="recommendations">
              <div className="flex min-w-0 flex-col gap-4">
                <RecommendationsPanel
                  value={recommendations}
                  onChange={setRecommendations}
                  options={recommendationOptions}
                  fallbackPreview={fallbackPreview}
                  disabled={!canUpdate}
                  labels={labels.recommendations}
                />
              </div>
            </TabsContent>

            {/* changes-49 (ADR-147): the course's own questions, per locale like
            every other field on this screen. Plain text, like the glossary's,
            and emitted as FAQPage structured data on the course page. */}
            <TabsContent value="faq">
              <div className="flex min-w-0 flex-col gap-4">
                <FaqPanel<{ question: string; answer: string }>
                  items={draft.faq}
                  onChange={(faq) => setDraft({ faq })}
                  makeItem={(fields) => fields}
                  labels={labels.faq}
                />
              </div>
            </TabsContent>

            <TabsContent value="seo">
              {/* changes-50 (image-3): the analysis sits UNDER the SEO fields it
              scores, in the one column — it was the SEO tab's right rail. */}
              <div className="flex min-w-0 flex-col gap-4">
                <EditorSection
                  title={labels.seoSection}
                  description={labels.seoSectionDescription}
                  icon={Search}
                  accent="info"
                  actions={
                    // The article editor's review dialog, in the same place: the section
                    // header, because it fills the whole section. Absent when SEO AI is off.
                    aiSeo ? (
                      <AiSeoButton
                        labels={aiSeo.labels}
                        entity={{ type: "course", id: course.id }}
                        keywords="single"
                        current={{
                          seoTitle: draft.seoTitle,
                          seoDescription: draft.seoDescription,
                          focusKeywords: draft.seoFocusKeyword,
                        }}
                        source={{
                          title: draft.title,
                          content: htmlToBlockText(draft.description),
                          ...(draft.summary ? { excerpt: draft.summary } : {}),
                          locale,
                        }}
                        onApply={(patch) =>
                          setDraft({
                            ...(patch.seoTitle !== undefined ? { seoTitle: patch.seoTitle } : {}),
                            ...(patch.seoDescription !== undefined
                              ? { seoDescription: patch.seoDescription }
                              : {}),
                            ...(patch.focusKeywords !== undefined
                              ? { seoFocusKeyword: patch.focusKeywords }
                              : {}),
                          })
                        }
                      />
                    ) : undefined
                  }
                >
                  <Field
                    label={labels.seoTitleLabel}
                    hint={labels.seoTitleHint}
                    error={form.error("translation.seoTitle")}
                    adornment={
                      <span className="flex items-center gap-1">
                        {fieldMenu("seoTitle")}
                        <CharCount value={draft.seoTitle} max={70} />
                      </span>
                    }
                  >
                    <Input
                      value={draft.seoTitle}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft({ seoTitle: e.target.value })}
                    />
                  </Field>

                  <Field
                    label={labels.seoDescriptionLabel}
                    hint={labels.seoDescriptionHint}
                    error={form.error("translation.seoDescription")}
                    adornment={
                      <span className="flex items-center gap-1">
                        {fieldMenu("seoDescription")}
                        <CharCount value={draft.seoDescription} max={180} />
                      </span>
                    }
                  >
                    <Textarea
                      rows={3}
                      value={draft.seoDescription}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft({ seoDescription: e.target.value })}
                    />
                  </Field>

                  <Field
                    label={labels.focusKeywordsLabel}
                    hint={labels.focusKeywordsHint}
                    error={form.error("translation.seoFocusKeyword")}
                    adornment={fieldMenu("seoFocusKeyword")}
                  >
                    <Input
                      value={draft.seoFocusKeyword}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft({ seoFocusKeyword: e.target.value })}
                    />
                  </Field>
                </EditorSection>

                <SeoAnalysis
                  title={draft.seoTitle || draft.title}
                  description={draft.seoDescription || draft.summary}
                  body={draft.description}
                  focusKeywords={draft.seoFocusKeyword}
                />
              </div>
            </TabsContent>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <ContentStatusPanel
              status={course.status}
              legalTransitions={course.legalTransitions}
              publishedAt={course.publishedAt}
              scheduledFor={course.scheduledFor}
              updatedAt={course.updatedAt}
              canPublish={canPublish}
              canSave={canUpdate}
              // The panel validates before a transition that saves first and
              // stops there, with the fields named inline (ADR-077).
              validate={validate}
              save={submitForm}
              transitionTo={(to, scheduledForIso) =>
                setCourseStatusAction(course.id, to, scheduledForIso)
              }
              labels={labels.status}
            />

            {/* ADR-139 #6 put the three switches in this card's footer;
                  changes-44 #5 moved them to their own card before Info. */}
            <EditorSection
              title={labels.displaySection}
              description={labels.displaySectionDescription}
              icon={ImageIcon}
              accent="warning"
            >
              <ImageUploadField
                id="course-cover"
                label={labels.coverImageLabel}
                value={cover.url}
                purpose="content"
                category="learn"
                sourceType="COURSE"
                disabled={!canUpdate}
                error={form.error("meta.coverAssetId")}
                onChange={(next) => setCover({ id: next?.id ?? null, url: next?.url ?? null })}
                labels={labels.upload}
              />
            </EditorSection>

            <EditorSection
              title={labels.settingsSection}
              description={labels.settingsSectionDescription}
              icon={SlidersHorizontal}
              accent="neutral"
            >
              <Field label={labels.trackLabel}>
                <AdminCombobox
                  disabled={!canUpdate}
                  value={track}
                  onValueChange={(v) => setTrack(v && isLearnTrack(v) ? v : track)}
                  options={Object.entries(labels.tracks).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Field>

              <Field label={labels.difficultyLabel}>
                <AdminCombobox
                  disabled={!canUpdate}
                  value={difficulty}
                  onValueChange={(v) =>
                    setDifficulty(courseDifficultySchema.safeParse(v).data ?? difficulty)
                  }
                  options={Object.entries(labels.difficulties).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Field>

              <Field label={labels.visibilityLabel}>
                <AdminCombobox
                  disabled={!canUpdate}
                  value={visibility}
                  onValueChange={(v) =>
                    setVisibility(contentVisibilitySchema.safeParse(v).data ?? visibility)
                  }
                  options={["PUBLIC", "AUTHENTICATED", "PREMIUM"].map((key) => ({
                    value: key,
                    label: labels.visibilities[key] ?? key,
                  }))}
                />
              </Field>

              <Field label={labels.estimatedHoursLabel} error={form.error("meta.estimatedHours")}>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={estimatedHours}
                  disabled={!canUpdate}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </Field>

              {/* ADR-056 #7: the final quiz is a COURSE-level completion
                    rule, not a phantom lesson. Attaching one means the course
                    is not complete until a learner passes it, however many
                    lessons they have finished. */}
              <Field label={labels.finalQuizLabel} hint={labels.finalQuizHint}>
                <AdminCombobox
                  disabled={!canUpdate}
                  value={finalQuizId ?? ""}
                  onValueChange={(v) => setFinalQuizId(v === "" ? null : v)}
                  options={[
                    { value: "", label: labels.noFinalQuiz },
                    ...quizOptions.map((option) => ({ value: option.id, label: option.title })),
                  ]}
                />
              </Field>

              <Field
                label={labels.externalUrlLabel}
                hint={labels.externalUrlHint}
                error={form.error("meta.externalUrl")}
              >
                <Input
                  type="url"
                  inputMode="url"
                  value={externalUrl}
                  disabled={!canUpdate}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </Field>
            </EditorSection>

            {/* changes-44 #5: last of the settings, before the read-only Info card. */}
            <ContentFlagsSection value={flags} onChange={setFlags} disabled={!canUpdate} />

            <EditorSection
              title={labels.infoSection}
              description={labels.infoSectionDescription}
              icon={Info}
              accent="neutral"
            >
              {/* ADR-044 #6: no <code> for admin chrome — a muted span
                    carries the same meaning without pulling in a monospace
                    family the admin does not otherwise use. */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">{labels.idLabel}</dt>
                <dd className="truncate">{course.id}</dd>
                <dt className="text-muted-foreground">{labels.createdLabel}</dt>
                <dd>{course.createdAt}</dd>
                <dt className="text-muted-foreground">{labels.updatedLabel}</dt>
                <dd>{course.updatedAt}</dd>
                <dt className="text-muted-foreground">{labels.lessonsLabel}</dt>
                <dd className="tabular-nums">{course.lessonCount}</dd>
              </dl>
            </EditorSection>
          </aside>
        </div>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={labels.confirmDeleteTitle}
        description={labels.confirmDeleteBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() =>
          run(
            async () => {
              await setCourseDeletedAction(course.id, true);
              router.push("/keystone/learn/courses");
            },
            { skipRefresh: true },
          )
        }
      />
    </div>
  );
}
