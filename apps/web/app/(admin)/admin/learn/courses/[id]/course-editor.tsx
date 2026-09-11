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
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import {
  contentVisibilitySchema,
  courseDifficultySchema,
  isLearnTrack,
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
import {
  saveCourseAction,
  setCourseDeletedAction,
  setCourseStatusAction,
} from "../../../_actions/learn-actions.ts";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { ContentStatusPanel } from "../../../_components/editor/content-status-panel.tsx";
import { EditorSection, Field } from "../../../_components/editor/editor-section.tsx";
import { SeoAnalysis } from "../../../_components/editor/seo-analysis.tsx";
import { ImageUploadField } from "../../../_components/image-upload-field.tsx";
import { RichTextEditor } from "../../../_components/rich-text-editor.tsx";
import {
  CONTENT_STATUS_TONE,
  StatusBadge,
  statusTone,
} from "../../../_components/status-badge.tsx";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { CurriculumPanel, type CurriculumSectionView } from "./_panels/curriculum-panel.tsx";
import {
  RecommendationsPanel,
  type RecommendationOption,
} from "./_panels/recommendations-panel.tsx";
import type { CourseData, CourseEditorLabels, CourseTranslationDraft } from "./editor-types.ts";

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

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
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();

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
  const [recommendations, setRecommendations] = useState<string[]>(course.recommendations);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const draft = drafts[locale] ?? blankTranslation(locale);
  const setDraft = (patch: Partial<CourseTranslationDraft>) =>
    setDrafts((current) => ({ ...current, [locale]: { ...draft, ...patch } }));

  const canSave = draft.title.trim() !== "";

  const publicPath = useMemo(() => `/${locale}/learn/${draft.slug || ""}`, [locale, draft.slug]);

  /**
   * One save for the whole screen, optionally followed by a transition — the
   * sequencing `PublishPanel` established. The two calls are SEQUENCED, not
   * merged: the transition still runs `courses.publish` inside the service, so
   * a save can never publish on behalf of an actor who may not.
   */
  const submitForm = async () => {
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
      },
      recommendations,
    };
    await saveCourseAction(payload);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {course.status === "PUBLISHED" && draft.slug && (
            <Button
              variant="outline"
              size="sm"
              render={
                <a href={`${siteUrl}${publicPath}`} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink data-icon="inline-start" aria-hidden />
              {labels.viewLive}
            </Button>
          )}
          {canUpdate && (
            <Button
              size="sm"
              disabled={pending || !canSave}
              onClick={() => run(() => submitForm(), { successMessage: labels.saved })}
            >
              {labels.updateCourse}
            </Button>
          )}
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={labels.openActions}>
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
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{labels.tabDetails}</TabsTrigger>
          <TabsTrigger value="curriculum">{labels.tabCurriculum}</TabsTrigger>
          <TabsTrigger value="recommendations">{labels.tabRecommendations}</TabsTrigger>
          <TabsTrigger value="seo">{labels.tabSeo}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <EditorSection
                title={labels.detailsSection}
                description={labels.detailsSectionDescription}
                icon={SlidersHorizontal}
                accent="primary"
              >
                <Field
                  id="course-title"
                  label={labels.titleLabel}
                  adornment={<CharCount value={draft.title} max={255} />}
                >
                  <Input
                    id="course-title"
                    value={draft.title}
                    disabled={!canUpdate}
                    onChange={(e) => setDraft({ title: e.target.value })}
                  />
                </Field>

                <Field
                  id="course-slug"
                  label={labels.slugLabel}
                  hint={`${labels.courseUrl}: ${publicPath}`}
                >
                  <Input
                    id="course-slug"
                    value={draft.slug}
                    disabled={!canUpdate}
                    onChange={(e) => setDraft({ slug: e.target.value })}
                  />
                </Field>

                <Field
                  id="course-summary"
                  label={labels.summaryLabel}
                  hint={labels.summaryHint}
                  adornment={<CharCount value={draft.summary} max={1000} />}
                >
                  <Textarea
                    id="course-summary"
                    rows={3}
                    value={draft.summary}
                    disabled={!canUpdate}
                    onChange={(e) => setDraft({ summary: e.target.value })}
                  />
                </Field>

                <Field label={labels.descriptionLabel}>
                  <RichTextEditor
                    id="course-description"
                    value={draft.description}
                    onChange={(html) => setDraft({ description: html })}
                    labels={labels.editor}
                    allowHtmlMode
                  />
                </Field>
              </EditorSection>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <ContentStatusPanel
                status={course.status}
                legalTransitions={course.legalTransitions}
                publishedAt={course.publishedAt}
                scheduledFor={course.scheduledFor}
                updatedAt={course.updatedAt}
                canPublish={canPublish}
                canSave={canSave && canUpdate}
                save={submitForm}
                transitionTo={(to, scheduledForIso) =>
                  setCourseStatusAction(course.id, to, scheduledForIso)
                }
                labels={labels.status}
              />

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

                <Field id="course-hours" label={labels.estimatedHoursLabel}>
                  <Input
                    id="course-hours"
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
                  id="course-external"
                  label={labels.externalUrlLabel}
                  hint={labels.externalUrlHint}
                >
                  <Input
                    id="course-external"
                    type="url"
                    inputMode="url"
                    value={externalUrl}
                    disabled={!canUpdate}
                    onChange={(e) => setExternalUrl(e.target.value)}
                  />
                </Field>

                <ImageUploadField
                  id="course-cover"
                  label={labels.coverImageLabel}
                  value={cover.url}
                  purpose="content"
                  category="learn"
                  sourceType="COURSE"
                  disabled={!canUpdate}
                  onChange={(next) => setCover({ id: next?.id ?? null, url: next?.url ?? null })}
                  labels={labels.upload}
                />
              </EditorSection>

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
            </div>
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
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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

        <TabsContent value="seo">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <EditorSection
              title={labels.seoSection}
              description={labels.seoSectionDescription}
              icon={Search}
              accent="info"
            >
              <Field
                id="course-seo-title"
                label={labels.seoTitleLabel}
                hint={labels.seoTitleHint}
                adornment={<CharCount value={draft.seoTitle} max={70} />}
              >
                <Input
                  id="course-seo-title"
                  value={draft.seoTitle}
                  disabled={!canUpdate}
                  onChange={(e) => setDraft({ seoTitle: e.target.value })}
                />
              </Field>

              <Field
                id="course-seo-description"
                label={labels.seoDescriptionLabel}
                hint={labels.seoDescriptionHint}
                adornment={<CharCount value={draft.seoDescription} max={180} />}
              >
                <Textarea
                  id="course-seo-description"
                  rows={3}
                  value={draft.seoDescription}
                  disabled={!canUpdate}
                  onChange={(e) => setDraft({ seoDescription: e.target.value })}
                />
              </Field>

              <Field
                id="course-seo-keyword"
                label={labels.focusKeywordsLabel}
                hint={labels.focusKeywordsHint}
              >
                <Input
                  id="course-seo-keyword"
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
              labels={labels.analysis}
            />
          </div>
        </TabsContent>
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
              router.push("/admin/learn/courses");
            },
            { skipRefresh: true },
          )
        }
      />
    </div>
  );
}
