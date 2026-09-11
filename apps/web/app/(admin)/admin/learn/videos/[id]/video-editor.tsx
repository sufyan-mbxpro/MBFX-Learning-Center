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
  Info,
  MoreHorizontal,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { isLearnTrack, type VideoTopicInput } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
  saveVideoTopicAction,
  setVideoTopicDeletedAction,
  setVideoTopicStatusAction,
} from "../../../_actions/video-actions.ts";
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
import { LinksPanel, type LinkDraft } from "./_panels/links-panel.tsx";
import { VideosPanel, type VideoDraft } from "./_panels/videos-panel.tsx";
import type { VideoEditorLabels, VideoTopicData, VideoTranslationDraft } from "./editor-types.ts";

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
      className={`text-xs tabular-nums ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

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
  canPublish,
  canDelete,
  labels,
}: {
  topic: VideoTopicData;
  categoryOptions: { id: string; name: string }[];
  locales: string[];
  defaultLocale: string;
  siteUrl: string;
  canUpdate: boolean;
  canPublish: boolean;
  canDelete: boolean;
  labels: VideoEditorLabels;
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
  const [visibility, setVisibility] = useState(topic.visibility);
  const [cover, setCover] = useState<{ id: string | null; url: string | null }>({
    id: topic.coverAssetId,
    url: topic.coverUrl,
  });
  const [videos, setVideos] = useState<VideoDraft[]>(topic.videos);
  const [links, setLinks] = useState<LinkDraft[]>(topic.links);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const draft = drafts[locale] ?? blankTranslation(locale);
  const setDraft = (patch: Partial<VideoTranslationDraft>) =>
    setDrafts((current) => ({ ...current, [locale]: { ...draft, ...patch } }));

  // Mirrors the contract's capability rule so the Save button does not offer
  // to submit a payload the schema will refuse: a topic needs a video OR a
  // body, because a topic with neither is an empty page someone will find on
  // the public site. The schema and the service are still the gate.
  const hasBody = draft.content.trim() !== "";
  const hasCapability = videos.length > 0 || hasBody;
  const canSave = draft.title.trim() !== "" && hasCapability;

  const publicPath = useMemo(
    () => `/${locale}/learn/${track}/videos/${draft.slug || ""}`,
    [locale, track, draft.slug],
  );

  const submitForm = async () => {
    const payload: VideoTopicInput = {
      topicId: topic.id,
      meta: {
        track: isLearnTrack(track) ? track : undefined,
        categoryId,
        coverAssetId: cover.id,
        visibility: visibility as VideoTopicInput["meta"]["visibility"],
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
    };
    await saveVideoTopicAction(payload);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {topic.status === "PUBLISHED" && draft.slug && (
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
              {labels.updateTopic}
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
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.bodySection}
            description={labels.bodySectionDescription}
            icon={FileText}
            accent="primary"
          >
            <Field
              id="video-title"
              label={labels.titleLabel}
              adornment={<CharCount value={draft.title} max={255} />}
            >
              <Input
                id="video-title"
                value={draft.title}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ title: e.target.value })}
              />
            </Field>

            <Field
              id="video-slug"
              label={labels.slugLabel}
              hint={`${labels.topicUrl}: ${publicPath}`}
            >
              <Input
                id="video-slug"
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
              adornment={<CharCount value={draft.summary} max={1000} />}
            >
              <Textarea
                id="video-summary"
                rows={3}
                value={draft.summary}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ summary: e.target.value })}
              />
            </Field>

            <Field label={labels.contentLabel} hint={labels.contentHint}>
              <RichTextEditor
                id="video-content"
                value={draft.content}
                onChange={(html) => setDraft({ content: html })}
                labels={labels.editor}
                allowHtmlMode
              />
            </Field>

            {/* Says WHY Save is disabled rather than leaving a dead button —
                the lesson editor's `lessonCapabilityWarning` precedent. */}
            {!hasCapability && (
              <p className="text-sm text-muted-foreground">{labels.capabilityWarning}</p>
            )}
          </EditorSection>

          <VideosPanel
            items={videos}
            onChange={setVideos}
            disabled={!canUpdate}
            labels={labels.videos}
          />

          <LinksPanel
            items={links}
            onChange={setLinks}
            disabled={!canUpdate}
            labels={labels.links}
          />

          <EditorSection
            title={labels.seoSection}
            description={labels.seoSectionDescription}
            icon={Search}
            accent="info"
          >
            <Field
              id="video-seo-title"
              label={labels.seoTitleLabel}
              hint={labels.seoTitleHint}
              adornment={<CharCount value={draft.seoTitle} max={70} />}
            >
              <Input
                id="video-seo-title"
                value={draft.seoTitle}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoTitle: e.target.value })}
              />
            </Field>

            <Field
              id="video-seo-description"
              label={labels.seoDescriptionLabel}
              hint={labels.seoDescriptionHint}
              adornment={<CharCount value={draft.seoDescription} max={180} />}
            >
              <Input
                id="video-seo-description"
                value={draft.seoDescription}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoDescription: e.target.value })}
              />
            </Field>

            <Field
              id="video-seo-keyword"
              label={labels.seoKeywordLabel}
              hint={labels.seoKeywordHint}
            >
              <Input
                id="video-seo-keyword"
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
              labels={labels.analysis}
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
            canSave={canUpdate && canSave}
            save={submitForm}
            transitionTo={(to, scheduledForIso) =>
              setVideoTopicStatusAction(topic.id, to, scheduledForIso)
            }
            labels={labels.status}
          />

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
            <Field id="video-track" label={labels.trackLabel} hint={labels.trackHint}>
              <AdminCombobox
                id="video-track"
                value={track}
                disabled={!canUpdate}
                // The guard, not a cast: the dropdown hands back a plain
                // string and only a registered track key may reach the action.
                onValueChange={(next) => setTrack(next && isLearnTrack(next) ? next : track)}
                options={Object.entries(labels.tracks).map(([value, label]) => ({ value, label }))}
              />
            </Field>

            <Field id="video-category" label={labels.categoryLabel} hint={labels.categoryHint}>
              <AdminCombobox
                id="video-category"
                value={categoryId ?? NONE}
                disabled={!canUpdate}
                onValueChange={(next) => setCategoryId(!next || next === NONE ? null : next)}
                options={[
                  { value: NONE, label: labels.categoryNone },
                  ...categoryOptions.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>

            <Field id="video-visibility" label={labels.visibilityLabel}>
              <AdminCombobox
                id="video-visibility"
                value={visibility}
                disabled={!canUpdate}
                onValueChange={(next) => setVisibility(next || visibility)}
                options={Object.entries(labels.visibilities).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>

            <ImageUploadField
              id="video-cover"
              label={labels.coverLabel}
              value={cover.url}
              purpose="content"
              category="learn"
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
