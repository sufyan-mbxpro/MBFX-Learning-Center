"use client";

// The lesson editor (changes-11 PR 3.4).
//
// Plan §8.3 is explicit that this REUSES the article editor rather than being a
// second editor: the body is `rich-text-editor.tsx` as-is, the SEO analysis is
// `seo-analysis.tsx` as-is, and the section shell is `editor-section.tsx`. What
// is new is the four panels a lesson needs and an article does not — Placement,
// Lesson settings, Resources and Objectives.
//
// One save for the whole screen, through `saveLessonAction`: `saveLesson`
// writes meta, translation and attachments in ONE transaction, and
// `lessonInputSchema`'s capability rule can only be decided from a payload that
// carries all of them together.
//
// The one control that does NOT wait for Save is the section move. Changing
// which section a lesson sits in is a structural change (the same argument
// curriculum-panel.tsx makes), and `moveLesson` renumbers `sortOrder` on both
// sides — not something to hold in a browser tab.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Info,
  MapPin,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import {
  completionRuleSchema,
  contentVisibilitySchema,
  courseDifficultySchema,
  lessonInputSchema,
  type ContentVisibility,
  type CourseDifficulty,
  type LessonInput,
} from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Field as FieldRoot,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
  duplicateLessonAction,
  moveLessonAction,
  saveLessonAction,
  setLessonDeletedAction,
  setLessonStatusAction,
} from "../../../_actions/learn-actions.ts";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { ContentStatusPanel } from "../../../_components/editor/content-status-panel.tsx";
import { EditorSection, Field } from "../../../_components/editor/editor-section.tsx";
import { SeoAnalysis } from "../../../_components/editor/seo-analysis.tsx";
import { RichTextEditor } from "../../../_components/rich-text-editor.tsx";
import {
  CONTENT_STATUS_TONE,
  StatusBadge,
  statusTone,
} from "../../../_components/status-badge.tsx";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { ObjectivesPanel } from "./_panels/objectives-panel.tsx";
import { ResourcesPanel, type AttachmentDraft } from "./_panels/resources-panel.tsx";
import type { LessonData, LessonEditorLabels, LessonTranslationDraft } from "./editor-types.ts";

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${value.length > max ? "text-destructive-interactive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

function blankTranslation(locale: string): LessonTranslationDraft {
  return {
    locale,
    title: "",
    slug: "",
    summary: "",
    content: "",
    learningObjectives: [],
    seoTitle: "",
    seoDescription: "",
    seoFocusKeyword: "",
    translationStatus: "DRAFT",
  };
}

/** Strips the empty rows an objectives list accumulates while being typed. */
function cleanObjectives(list: string[]): string[] {
  return list.map((entry) => entry.trim()).filter((entry) => entry !== "");
}

export function LessonEditor({
  lesson,
  sections,
  prerequisiteOptions,
  quizOptions,
  locales,
  defaultLocale,
  siteUrl,
  canUpdate,
  canPublish,
  canCreate,
  canDelete,
  labels,
}: {
  lesson: LessonData;
  sections: { id: string; title: string; lessonCount: number }[];
  prerequisiteOptions: { id: string; title: string }[];
  /** Every quiz an editor may attach (ADR-058 #1). */
  quizOptions: { id: string; title: string }[];
  locales: string[];
  defaultLocale: string;
  siteUrl: string;
  canUpdate: boolean;
  canPublish: boolean;
  canCreate: boolean;
  canDelete: boolean;
  labels: LessonEditorLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();

  const [locale, setLocale] = useState(defaultLocale);
  const [drafts, setDrafts] = useState<Record<string, LessonTranslationDraft>>(() =>
    Object.fromEntries(lesson.translations.map((t) => [t.locale, t])),
  );
  const [difficulty, setDifficulty] = useState<CourseDifficulty>(
    () => courseDifficultySchema.safeParse(lesson.difficulty).data ?? "BEGINNER",
  );
  const [visibility, setVisibility] = useState<ContentVisibility>(
    () => contentVisibilitySchema.safeParse(lesson.visibility).data ?? "PUBLIC",
  );
  const [completionRule, setCompletionRule] = useState(
    () => completionRuleSchema.safeParse(lesson.completionRule).data ?? "MANUAL",
  );
  const [quizId, setQuizId] = useState<string | null>(lesson.quizId);
  const [isRequired, setIsRequired] = useState(lesson.isRequired);
  const [estimatedMinutes, setEstimatedMinutes] = useState(lesson.estimatedMinutes);
  const [prerequisiteLessonId, setPrerequisiteLessonId] = useState(lesson.prerequisiteLessonId);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl);
  const [externalUrl, setExternalUrl] = useState(lesson.externalUrl);
  const [hero, setHero] = useState<{ id: string | null; url: string | null }>({
    id: lesson.heroAssetId,
    url: lesson.heroUrl,
  });
  const [attachments, setAttachments] = useState<AttachmentDraft[]>(lesson.attachments);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const draft = drafts[locale] ?? blankTranslation(locale);
  const setDraft = (patch: Partial<LessonTranslationDraft>) =>
    setDrafts((current) => ({ ...current, [locale]: { ...draft, ...patch } }));

  // `lessonInputSchema`'s capability rule, mirrored so the body field's
  // message can say WHAT is missing rather than "check this value". The
  // contract and `saveLesson` are still the gate.
  const hasBody = draft.content.trim() !== "";
  const hasCapability =
    hasBody || videoUrl.trim() !== "" || externalUrl.trim() !== "" || attachments.length > 0;

  const publicPath = useMemo(
    () => `/${locale}/learn/${lesson.courseSlug}/${draft.slug || ""}`,
    [locale, lesson.courseSlug, draft.slug],
  );

  // Built on every render rather than at submit, so the inline validation
  // reads EXACTLY what `saveLessonAction` will be sent (ADR-077).
  const payload: LessonInput = {
    lessonId: lesson.id,
    meta: {
      difficulty,
      visibility,
      completionRule,
      quizId,
      isRequired,
      estimatedMinutes: estimatedMinutes.trim() === "" ? null : Number(estimatedMinutes),
      videoUrl: videoUrl.trim() === "" ? null : videoUrl.trim(),
      externalUrl: externalUrl.trim() === "" ? null : externalUrl.trim(),
      heroAssetId: hero.id,
      prerequisiteLessonId,
    },
    translation: {
      locale,
      title: draft.title.trim(),
      slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
      summary: draft.summary.trim() === "" ? null : draft.summary.trim(),
      content: draft.content.trim() === "" ? null : draft.content,
      learningObjectives: cleanObjectives(draft.learningObjectives),
      seoTitle: draft.seoTitle.trim() === "" ? null : draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim() === "" ? null : draft.seoDescription.trim(),
      seoFocusKeyword: draft.seoFocusKeyword.trim() === "" ? null : draft.seoFocusKeyword.trim(),
    },
    attachments: attachments.map((entry) => ({
      assetId: entry.assetId,
      label: entry.label.trim() === "" ? null : entry.label.trim(),
    })),
  };
  const form = useFieldErrors(lessonInputSchema, payload);

  // The capability rule reports on the body path; the Resources panel's own
  // warning says what would satisfy it, which "check this value" does not.
  const bodyError =
    form.invalid("translation.content") && !hasCapability
      ? labels.resources.capabilityWarning
      : form.error("translation.content");

  const submitForm = async () => {
    await saveLessonAction(payload);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(CONTENT_STATUS_TONE, lesson.status)}>
            {labels.statusLabels[lesson.status] ?? lesson.status}
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
          {lesson.status === "PUBLISHED" && draft.slug && lesson.courseSlug && (
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
            // Enabled while fields are wrong: pressing it names them (audit F-07).
            <Button
              size="sm"
              loading={pending}
              onClick={() => {
                if (!form.validate()) return;
                run(() => submitForm(), { successMessage: labels.saved });
              }}
            >
              {labels.updateLesson}
            </Button>
          )}
          {(canCreate || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={labels.openActions}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {canCreate && (
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() =>
                      run(
                        async () => {
                          const id = await duplicateLessonAction(lesson.id);
                          router.push(`/admin/learn/lessons/${id}`);
                        },
                        { skipRefresh: true },
                      )
                    }
                  >
                    <SquareArrowOutUpRight aria-hidden data-icon="inline-start" />
                    {labels.duplicate}
                  </DropdownMenuItem>
                )}
                {canDelete &&
                  (lesson.deleted ? (
                    <DropdownMenuItem
                      disabled={pending}
                      onClick={() => run(() => setLessonDeletedAction(lesson.id, false))}
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
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-(--grid-2-1)">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.bodySection}
            description={labels.bodySectionDescription}
            icon={FileText}
            accent="primary"
          >
            <Field
              label={labels.titleLabel}
              required
              error={form.error("translation.title")}
              adornment={<CharCount value={draft.title} max={255} />}
            >
              <Input
                value={draft.title}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ title: e.target.value })}
              />
            </Field>

            <Field
              label={labels.slugLabel}
              hint={`${labels.lessonUrl}: ${publicPath}`}
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
              error={form.error("translation.summary")}
              adornment={<CharCount value={draft.summary} max={1000} />}
            >
              <Textarea
                rows={2}
                value={draft.summary}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ summary: e.target.value })}
              />
            </Field>

            <Field label={labels.bodyLabel} error={bodyError}>
              <RichTextEditor
                value={draft.content}
                onChange={(html) => setDraft({ content: html })}
                labels={labels.editor}
                allowHtmlMode
              />
            </Field>
          </EditorSection>

          <ResourcesPanel
            hero={hero}
            onHeroChange={setHero}
            videoUrl={videoUrl}
            onVideoUrlChange={setVideoUrl}
            videoUrlError={form.error("meta.videoUrl")}
            externalUrl={externalUrl}
            onExternalUrlChange={setExternalUrl}
            externalUrlError={form.error("meta.externalUrl")}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            hasBody={hasBody}
            disabled={!canUpdate}
            labels={labels.resources}
          />

          <ObjectivesPanel
            value={draft.learningObjectives}
            onChange={(next) => setDraft({ learningObjectives: next })}
            disabled={!canUpdate}
            labels={labels.objectives}
          />

          <EditorSection
            title={labels.seoSection}
            description={labels.seoSectionDescription}
            icon={Search}
            accent="info"
          >
            <Field
              label={labels.seoTitleLabel}
              hint={labels.seoTitleHint}
              error={form.error("translation.seoTitle")}
              adornment={<CharCount value={draft.seoTitle} max={70} />}
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
              adornment={<CharCount value={draft.seoDescription} max={180} />}
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
            >
              <Input
                value={draft.seoFocusKeyword}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoFocusKeyword: e.target.value })}
              />
            </Field>
            <SeoAnalysis
              title={draft.seoTitle || draft.title}
              description={draft.seoDescription || draft.summary}
              body={draft.content}
              focusKeywords={draft.seoFocusKeyword}
              labels={labels.analysis}
            />
          </EditorSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ContentStatusPanel
            status={lesson.status}
            legalTransitions={lesson.legalTransitions}
            publishedAt={lesson.publishedAt}
            scheduledFor={lesson.scheduledFor}
            updatedAt={lesson.updatedAt}
            canPublish={canPublish}
            canSave={canUpdate}
            // The panel validates before a transition that saves first and
            // stops there, with the fields named inline (ADR-077).
            validate={form.validate}
            save={submitForm}
            transitionTo={(to, scheduledForIso) =>
              setLessonStatusAction(lesson.id, to, scheduledForIso)
            }
            labels={labels.status}
          />

          <EditorSection
            title={labels.placementSection}
            description={labels.placementSectionDescription}
            icon={MapPin}
            accent="neutral"
          >
            {/* A link, not a form control: a label element would name
                nothing, so the heading is a FieldTitle (ADR-077). */}
            <div className="flex min-w-0 flex-col gap-2">
              <FieldTitle>{labels.courseLabel}</FieldTitle>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                render={<Link href={`/admin/learn/courses/${lesson.courseId}`} />}
              >
                {lesson.courseTitle}
              </Button>
            </div>

            <Field label={labels.sectionLabel}>
              <AdminCombobox
                value={lesson.sectionId}
                onValueChange={(v) => {
                  const target = sections.find((section) => section.id === v);
                  if (!target || target.id === lesson.sectionId) return;
                  // Committed immediately, not on Save: `moveLesson` renumbers
                  // `sortOrder` in both sections, which is not a change to hold
                  // unsaved beside a form that shows neither ordering.
                  run(() =>
                    moveLessonAction({
                      lessonId: lesson.id,
                      toSectionId: target.id,
                      index: target.lessonCount,
                    }),
                  );
                }}
                disabled={!canUpdate || pending}
                options={sections.map((section) => ({
                  value: section.id,
                  label: section.title,
                }))}
              />
            </Field>

            <Field label={labels.prerequisiteLabel}>
              <AdminCombobox
                disabled={!canUpdate}
                value={prerequisiteLessonId ?? ""}
                onValueChange={(v) => setPrerequisiteLessonId(v === "" ? null : v)}
                options={[
                  { value: "", label: labels.noPrerequisite },
                  ...prerequisiteOptions.map((option) => ({
                    value: option.id,
                    label: option.title,
                  })),
                ]}
              />
            </Field>
          </EditorSection>

          <EditorSection
            title={labels.settingsSection}
            description={labels.settingsSectionDescription}
            icon={SlidersHorizontal}
            accent="neutral"
          >
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

            <Field label={labels.estimatedMinutesLabel} error={form.error("meta.estimatedMinutes")}>
              <Input
                type="number"
                min={0}
                max={6000}
                value={estimatedMinutes}
                disabled={!canUpdate}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
              />
            </Field>

            <Field label={labels.completionRuleLabel}>
              <AdminCombobox
                disabled={!canUpdate}
                value={completionRule}
                onValueChange={(v) =>
                  setCompletionRule(completionRuleSchema.safeParse(v).data ?? completionRule)
                }
                options={Object.entries(labels.completionRules).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>

            {/* ADR-058 #1: the LESSON holds the FK, so attaching is an ordinary
                field on this save rather than its own action. The two controls
                sit together because QUIZ_PASS with nothing attached is a lesson
                no learner can ever complete — the hint says so rather than the
                form silently allowing it. */}
            <Field
              label={labels.quizLabel}
              hint={
                completionRule === "QUIZ_PASS" && quizId === null
                  ? labels.quizPassNeedsQuiz
                  : labels.quizHint
              }
            >
              <AdminCombobox
                disabled={!canUpdate}
                value={quizId ?? ""}
                onValueChange={(v) => setQuizId(v === "" ? null : v)}
                options={[
                  { value: "", label: labels.noQuiz },
                  ...quizOptions.map((option) => ({ value: option.id, label: option.title })),
                ]}
              />
            </Field>

            <FieldRoot orientation="horizontal">
              <Checkbox
                checked={isRequired}
                disabled={!canUpdate}
                onCheckedChange={(checked) => setIsRequired(checked === true)}
              />
              <FieldContent>
                <FieldLabel className="font-normal">{labels.isRequiredLabel}</FieldLabel>
                <FieldDescription className="text-xs">{labels.isRequiredHint}</FieldDescription>
              </FieldContent>
            </FieldRoot>
          </EditorSection>

          <EditorSection
            title={labels.infoSection}
            description={labels.infoSectionDescription}
            icon={Info}
            accent="neutral"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">{labels.idLabel}</dt>
              <dd className="truncate">{lesson.id}</dd>
              <dt className="text-muted-foreground">{labels.createdLabel}</dt>
              <dd>{lesson.createdAt}</dd>
              <dt className="text-muted-foreground">{labels.updatedLabel}</dt>
              <dd>{lesson.updatedAt}</dd>
            </dl>
          </EditorSection>
        </div>
      </div>

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
              await setLessonDeletedAction(lesson.id, true);
              router.push(`/admin/learn/courses/${lesson.courseId}`);
            },
            { skipRefresh: true },
          )
        }
      />
    </div>
  );
}
