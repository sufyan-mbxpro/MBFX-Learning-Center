"use client";

// The video topic editor (changes-16 PR 6, ADR-068).
//
// Modelled on `glossary-editor.tsx` and `lesson-editor.tsx` rather than the
// article editor, for ADR-063's reason: video topics run the SEVEN-state
// `CONTENT_TRANSITIONS` machine, so `ContentStatusPanel` fits and
// `publish-panel.tsx` does not. (They DO have a `scheduledFor` column as of
// ADR-071 — the panel grew the field rather than the editor changing panels.)
//
// One save for the whole screen, through `saveVideoTopicAction`:
// `saveVideoTopic` writes the meta, the active locale's translation, the whole
// video list, the whole link list and the media references in ONE transaction,
// so a topic whose videos saved but whose body did not is a state that cannot
// be reached.
//
// **What is translatable and what is not is a decision, not an oversight.**
// The title, summary, body and SEO fields are per-locale and live in `drafts`.
// The videos and links are NOT: a recording is the same recording whichever
// language the page is read in, and a link's destination does not change with
// the reader (@repo/i18n's `Link` adds the locale prefix at render, which is
// why no prefix is stored). So they sit on the topic and are shared.
import { useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  FolderTree,
  ImageIcon,
  Info,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { isLearnTrack, videoTopicInputSchema, type VideoTopicInput } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Field as UiField,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { htmlToBlockText } from "@repo/utils";
import {
  saveVideoTopicAction,
  setVideoTopicDeletedAction,
  setVideoTopicStatusAction,
} from "../../../_actions/video-actions.ts";
import { AiFieldMenu, AiFillButton, type AiFillPatch } from "../../../_components/ai-fill.tsx";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { ContentStatusPanel } from "../../../_components/editor/content-status-panel.tsx";
import { AiSeoButton } from "../../../_components/ai-seo-dialog.tsx";
import { EditorSection, Field } from "../../../_components/editor/editor-section.tsx";
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
import { LinksPanel, type LinkDraft } from "./_panels/links-panel.tsx";
import { VideosPanel, type VideoDraft } from "./_panels/videos-panel.tsx";
import type { VideoEditorLabels, VideoTopicData, VideoTranslationDraft } from "./editor-types.ts";
import { HeaderActions } from "../../../_components/header-actions.tsx";
import { CategoryDialog } from "../(browse)/categories/category-dialog.tsx";

/**
 * The sentinel for the category dropdown's empty option.
 *
 * Not an empty string: a listbox reads `""` as "nothing selected", and
 * "Uncategorised" is a deliberate choice — the same call the glossary editor
 * makes for its two nullable dropdowns.
 */
const NONE = "__none__";

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
  "content",
  "seoTitle",
  "seoDescription",
  "seoFocusKeyword",
] as const satisfies readonly (keyof VideoTranslationDraft)[];
const TRANSLATABLE_FIELDS = TRANSLATABLE_TEXT;

function blankTranslation(locale: string): VideoTranslationDraft {
  return {
    locale,
    title: "",
    slug: "",
    summary: "",
    content: "",
    seoTitle: "",
    seoDescription: "",
    seoFocusKeyword: "",
    translationStatus: "DRAFT",
  };
}

export function VideoEditor({
  topic,
  categoryOptions,
  locales,
  defaultLocale,
  siteUrl,
  canUpdate,
  canCreateCategory = false,
  canPublish,
  canDelete,
  labels,
  ai,
}: {
  topic: VideoTopicData;
  categoryOptions: { id: string; name: string }[];
  locales: string[];
  defaultLocale: string;
  siteUrl: string;
  canUpdate: boolean;
  /** `lessons.create` — the category action's own gate on a create. */
  canCreateCategory?: boolean;
  canPublish: boolean;
  canDelete: boolean;
  labels: VideoEditorLabels;
  /** ADR-126. Absent when AI is off, the feature is off, or this person cannot spend. */
  ai?: EditorAi;
}) {
  const { run, pending } = useServerAction();

  const [locale, setLocale] = useState(defaultLocale);
  // Every locale's stored translation, keyed. Edits are held per locale so
  // switching away and back does not lose them — the article editor's rule.
  const [drafts, setDrafts] = useState<Record<string, VideoTranslationDraft>>(() =>
    Object.fromEntries(topic.translations.map((t) => [t.locale, t])),
  );
  const [track, setTrack] = useState(topic.track);
  const [categoryId, setCategoryId] = useState<string | null>(topic.categoryId);
  // Categories created from this editor (ADR-144 §2). The action's refresh
  // brings them back in `categoryOptions` too; holding them here means the
  // new row is selectable the moment the action returns, not a refresh later.
  const [createdCategories, setCreatedCategories] = useState<{ id: string; name: string }[]>([]);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const allCategories = useMemo(() => {
    const ids = new Set(categoryOptions.map((c) => c.id));
    return [...categoryOptions, ...createdCategories.filter((c) => !ids.has(c.id))];
  }, [categoryOptions, createdCategories]);
  const [showOnAllTracks, setShowOnAllTracks] = useState(topic.showOnAllTracks);
  const [visibility, setVisibility] = useState(topic.visibility);
  const [cover, setCover] = useState<{ id: string | null; url: string | null }>({
    id: topic.coverAssetId,
    url: topic.coverUrl,
  });
  const [flags, setFlags] = useState<ContentFlags>(topic.flags);
  const [videos, setVideos] = useState<VideoDraft[]>(topic.videos);
  const [links, setLinks] = useState<LinkDraft[]>(topic.links);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const draft = drafts[locale] ?? blankTranslation(locale);
  // Merged from CURRENT state, not the last render: an AI patch and a keystroke
  // in the same tick would otherwise overwrite each other (ADR-126 §4).
  const setDraft = (patch: Partial<VideoTranslationDraft>) =>
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
    content: htmlToBlockText(draft.content),
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoFocusKeyword: draft.seoFocusKeyword,
  };
  const applyFill = (patch: AiFillPatch) => {
    const next: Partial<VideoTranslationDraft> = {};
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

  // Mirrors the contract's capability rule: a topic needs a video OR a body,
  // because a topic with neither is an empty page someone will find on the
  // public site. Saving validates against the schema itself (ADR-077); this
  // only drives the up-front hint below.
  const hasBody = draft.content.trim() !== "";
  const hasCapability = videos.length > 0 || hasBody;

  const publicPath = useMemo(
    () => `/${locale}/learn/${track}/videos/${draft.slug || ""}`,
    [locale, track, draft.slug],
  );
  const defaultSlug = storedSlug(topic.translations, defaultLocale);
  const viewLiveHref = liveHref(
    `/learn/${topic.track}/videos/${defaultSlug}`,
    locale,
    defaultLocale,
  );

  const buildPayload = (): VideoTopicInput => ({
    topicId: topic.id,
    meta: {
      track: isLearnTrack(track) ? track : undefined,
      categoryId,
      showOnAllTracks,
      coverAssetId: cover.id,
      visibility: visibility as VideoTopicInput["meta"]["visibility"],
      ...flags,
    },
    translation: {
      locale,
      title: draft.title.trim(),
      slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
      summary: draft.summary.trim() === "" ? null : draft.summary.trim(),
      content: hasBody ? draft.content : null,
      seoTitle: draft.seoTitle.trim() === "" ? null : draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim() === "" ? null : draft.seoDescription.trim(),
      seoFocusKeyword: draft.seoFocusKeyword.trim() === "" ? null : draft.seoFocusKeyword.trim(),
      // changes-29 B3: sent only while the words are untouched AI output.
      ...(draft.machineTranslated ? { machineTranslated: true } : {}),
    },
    // The panels carry preview URLs the contract has no field for; strip
    // them rather than letting the schema drop them silently, so what is
    // sent is exactly what was meant.
    videos: videos.map((video, index) => ({
      id: video.id,
      assetId: video.assetId ?? null,
      externalUrl:
        (video.externalUrl ?? "").trim() === "" ? null : (video.externalUrl ?? "").trim(),
      posterAssetId: video.posterAssetId ?? null,
      title: video.title,
      sortOrder: index,
    })),
    links: links.map((link) => ({
      label: link.label.trim(),
      path: (link.path ?? "").trim() === "" ? null : (link.path ?? "").trim(),
      url: (link.url ?? "").trim() === "" ? null : (link.url ?? "").trim(),
    })),
  });

  // `saveVideoTopicAction`'s own schema over the exact payload (ADR-077).
  const form = useFieldErrors(videoTopicInputSchema, buildPayload());

  const submitForm = async () => {
    await saveVideoTopicAction(buildPayload());
  };

  // The capability rule's issue lands on `videos`, but the fix is as often a
  // body as a video — so the body field carries the message.
  const contentError =
    form.error("translation.content") ??
    (form.invalid("videos") ? labels.capabilityWarning : undefined);

  // changes-44 #3: the record's state and language travel with the content,
  // not on a row of their own above it.
  const stateCluster = (
    <>
      <StatusBadge tone={statusTone(CONTENT_STATUS_TONE, topic.status)}>
        {labels.statusLabels[topic.status] ?? topic.status}
      </StatusBadge>
      {topic.deleted && <StatusBadge tone="destructive">{labels.softDelete}</StatusBadge>}
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
        entity={{ type: "video_topic", id: topic.id }}
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
        {topic.status === "PUBLISHED" && defaultSlug && (
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
              if (!form.validate()) return;
              run(() => saveVideoTopicAction(buildPayload()), { successMessage: labels.saved });
            }}
          >
            {labels.updateTopic}
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
              {topic.deleted ? (
                // Restore is NOT confirmed — it is the undo (ADR-044 #7).
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => run(() => setVideoTopicDeletedAction(topic.id, false))}
                >
                  <RotateCcw aria-hidden data-icon="inline-start" />
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

      <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-(--grid-2-1)">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.bodySection}
            actions={
              <>
                {stateCluster}
                {aiFill ? (
                  <AiFillButton
                    withOptions
                    config={aiFill}
                    locale={locale}
                    current={aiCurrent}
                    fieldLabels={{
                      title: labels.titleLabel,
                      summary: labels.summaryLabel,
                      content: labels.contentLabel,
                      seoTitle: labels.seoTitleLabel,
                      seoDescription: labels.seoDescriptionLabel,
                      seoFocusKeyword: labels.seoKeywordLabel,
                    }}
                    onApply={applyFill}
                  />
                ) : null}
              </>
            }
            description={labels.bodySectionDescription}
            icon={FileText}
            accent="primary"
          >
            <Field
              id="video-title"
              label={labels.titleLabel}
              adornment={
                <span className="flex items-center gap-1">
                  {fieldMenu("title")}
                  <CharCount value={draft.title} max={255} />
                </span>
              }
              required
              error={form.error("translation.title")}
            >
              <Input
                value={draft.title}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ title: e.target.value })}
              />
            </Field>

            <Field
              id="video-slug"
              label={labels.slugLabel}
              hint={`${labels.topicUrl}: ${publicPath}`}
              error={form.error("translation.slug")}
            >
              <Input
                value={draft.slug}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ slug: e.target.value })}
              />
            </Field>

            {/* Plain text, not rich: the summary renders inside a card and in
                meta descriptions, both of which take a string. */}
            <Field
              id="video-summary"
              label={labels.summaryLabel}
              hint={labels.summaryHint}
              adornment={
                <span className="flex items-center gap-1">
                  {fieldMenu("summary")}
                  <CharCount value={draft.summary} max={1000} />
                </span>
              }
              error={form.error("translation.summary")}
            >
              <Textarea
                rows={4}
                value={draft.summary}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ summary: e.target.value })}
              />
            </Field>

            <Field label={labels.contentLabel} hint={labels.contentHint} error={contentError}>
              <RichTextEditor
                value={draft.content}
                onChange={(html) => setDraft({ content: html })}
                labels={labels.editor}
                allowHtmlMode
                {...(ai?.assistant && canUpdate
                  ? { ai: { ...ai.assistant, config: { ...ai.assistant.config, locale } } }
                  : {})}
              />
            </Field>

            {/* The capability rule, said up front — the lesson editor's
                `lessonCapabilityWarning` precedent. Once a save has been
                attempted the body field's message says it instead. */}
            {!hasCapability && !form.invalid("videos") && (
              <p className="text-sm text-muted-foreground">{labels.capabilityWarning}</p>
            )}
          </EditorSection>

          <VideosPanel
            items={videos}
            onChange={setVideos}
            disabled={!canUpdate}
            labels={labels.videos}
            issues={{
              invalid: (path) => form.invalid(`videos.${path}`),
              error: (path) => form.error(`videos.${path}`),
            }}
          />

          <LinksPanel
            items={links}
            onChange={setLinks}
            disabled={!canUpdate}
            labels={labels.links}
            issues={{
              invalid: (path) => form.invalid(`links.${path}`),
              error: (path) => form.error(`links.${path}`),
            }}
          />

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
                  entity={{ type: "video_topic", id: topic.id }}
                  keywords="single"
                  current={{
                    seoTitle: draft.seoTitle,
                    seoDescription: draft.seoDescription,
                    focusKeywords: draft.seoFocusKeyword,
                  }}
                  source={{
                    title: draft.title,
                    content: htmlToBlockText(draft.content),
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
              id="video-seo-title"
              label={labels.seoTitleLabel}
              hint={labels.seoTitleHint}
              adornment={
                <span className="flex items-center gap-1">
                  {fieldMenu("seoTitle")}
                  <CharCount value={draft.seoTitle} max={70} />
                </span>
              }
              error={form.error("translation.seoTitle")}
            >
              <Input
                value={draft.seoTitle}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoTitle: e.target.value })}
              />
            </Field>

            <Field
              id="video-seo-description"
              label={labels.seoDescriptionLabel}
              hint={labels.seoDescriptionHint}
              adornment={
                <span className="flex items-center gap-1">
                  {fieldMenu("seoDescription")}
                  <CharCount value={draft.seoDescription} max={180} />
                </span>
              }
              error={form.error("translation.seoDescription")}
            >
              <Textarea
                rows={3}
                maxLength={180}
                value={draft.seoDescription}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoDescription: e.target.value })}
              />
            </Field>

            <Field
              id="video-seo-keyword"
              label={labels.seoKeywordLabel}
              hint={labels.seoKeywordHint}
              error={form.error("translation.seoFocusKeyword")}
              adornment={fieldMenu("seoFocusKeyword")}
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
              focusKeywords={draft.seoFocusKeyword || draft.title}
              body={draft.content}
            />
          </EditorSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ContentStatusPanel
            status={topic.status}
            legalTransitions={topic.legalTransitions}
            publishedAt={topic.publishedAt}
            scheduledFor={topic.scheduledFor}
            updatedAt={topic.updatedAt}
            canPublish={canPublish}
            canSave={canUpdate}
            // Validates before a transition that saves first (ADR-077).
            validate={form.validate}
            save={submitForm}
            transitionTo={(to, scheduledForIso) =>
              setVideoTopicStatusAction(topic.id, to, scheduledForIso)
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
              id="video-cover"
              label={labels.coverLabel}
              value={cover.url}
              purpose="content"
              category="learn"
              disabled={!canUpdate}
              onChange={(next) => setCover({ id: next?.id ?? null, url: next?.url ?? null })}
              error={form.error("meta.coverAssetId")}
              labels={labels.upload}
            />
          </EditorSection>

          <EditorSection
            title={labels.filingSection}
            description={labels.filingSectionDescription}
            icon={FolderTree}
            accent="neutral"
          >
            {/* The track is ADDRESS, the category is TAXONOMY (ADR-068 §1).
                They sit together because an editor meets both at once, and
                each hint says which is which — changing the track relocates
                the page and writes a redirect; changing the category does not. */}
            <Field
              id="video-track"
              label={labels.trackLabel}
              hint={labels.trackHint}
              error={form.error("meta.track")}
            >
              <AdminCombobox
                value={track}
                disabled={!canUpdate}
                // The guard, not a cast: the dropdown hands back a plain
                // string and only a registered track key may reach the action.
                onValueChange={(next) => setTrack(next && isLearnTrack(next) ? next : track)}
                options={Object.entries(labels.tracks).map(([value, label]) => ({ value, label }))}
              />
            </Field>

            {/* ADR-144 §2 — LISTING under the other school, not a second
                address: the track above stays the one URL segment. Switch
                first, on a horizontal Field (code-style.md #25). */}
            <UiField orientation="horizontal">
              <Switch
                checked={showOnAllTracks}
                disabled={!canUpdate}
                onCheckedChange={setShowOnAllTracks}
              />
              <FieldContent>
                <FieldLabel className="font-normal">{labels.showOnAllTracksLabel}</FieldLabel>
                <FieldDescription className="text-xs">
                  {labels.showOnAllTracksHint}
                </FieldDescription>
              </FieldContent>
            </UiField>

            <Field
              id="video-category"
              label={labels.categoryLabel}
              hint={labels.categoryHint}
              error={form.error("meta.categoryId")}
              adornment={
                canUpdate && canCreateCategory ? (
                  <Button variant="outline" size="xs" onClick={() => setNewCategoryOpen(true)}>
                    <Plus data-icon="inline-start" aria-hidden />
                    {labels.newCategory}
                  </Button>
                ) : undefined
              }
            >
              <AdminCombobox
                value={categoryId ?? NONE}
                disabled={!canUpdate}
                onValueChange={(next) => setCategoryId(!next || next === NONE ? null : next)}
                options={[
                  { value: NONE, label: labels.categoryNone },
                  ...allCategories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
            {/* The categories screen's own dialog and action (ADR-144 §2):
                one create path, one permission check, one audit row. Filing
                the topic under what was just created is why it is here. */}
            <CategoryDialog
              open={newCategoryOpen}
              onOpenChange={setNewCategoryOpen}
              target={null}
              locale={defaultLocale}
              onSaved={(saved) => {
                setCreatedCategories((list) => [...list, saved]);
                setCategoryId(saved.id);
              }}
            />

            <Field
              id="video-visibility"
              label={labels.visibilityLabel}
              error={form.error("meta.visibility")}
            >
              <AdminCombobox
                value={visibility}
                disabled={!canUpdate}
                onValueChange={(next) => setVisibility(next || visibility)}
                options={Object.entries(labels.visibilities).map(([value, label]) => ({
                  value,
                  label,
                }))}
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
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{labels.idLabel}</dt>
                <dd className="truncate font-mono text-xs">{topic.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{labels.createdLabel}</dt>
                <dd>{topic.createdAt}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{labels.updatedLabel}</dt>
                <dd>{topic.updatedAt}</dd>
              </div>
            </dl>
          </EditorSection>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={labels.confirmDeleteTitle}
        description={labels.confirmDeleteBody}
        confirmLabel={labels.softDelete}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => setVideoTopicDeletedAction(topic.id, true))}
      />
    </div>
  );
}
