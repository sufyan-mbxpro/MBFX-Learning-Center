"use client";

// The glossary topic editor (changes-18 PR 3).
//
// Modelled on the TERM editor next door, deliberately: same section shells,
// same locale switcher, same one-save-per-screen. What it does NOT have is the
// seven-state machine — a topic is taxonomy, not content (changes-18 §2 D2), so
// it carries one switch, and the screen calls that switch Published / Draft
// because those are the words an editor thinks in. `isActive` is the column
// underneath and nothing else changed about it.
//
// Multilingual works exactly as ADR-043 describes: one translation row per
// locale, a switcher to move between them, and only `en` active today. The
// admin chrome stays English; the CONTENT here is public-facing and translated.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, FolderTree, ImageIcon, Search, Tags, Trash2 } from "lucide-react";
import { saveGlossaryTopicSchema, type SaveGlossaryTopicInput } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Field as FieldRoot,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { htmlToBlockText } from "@repo/utils";
import { AiFieldMenu, AiFillButton, type AiFillPatch } from "../../../_components/ai-fill.tsx";
import { AiSeoButton } from "../../../_components/ai-seo-dialog.tsx";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { RichTextEditor } from "../../../_components/rich-text-editor.tsx";
import { EditorSection, Field } from "../../../_components/editor/editor-section.tsx";
import { SeoAnalysis } from "../../../_components/editor/seo-analysis.tsx";
import { ContentFlagsSection } from "../../../_components/editor/content-flags-fields.tsx";
import { ImageUploadField } from "../../../_components/image-upload-field.tsx";
import { SlugField } from "../../../_components/editor/slug-field.tsx";
import { StatusBadge } from "../../../_components/status-badge.tsx";
import {
  deleteGlossaryTopicAction,
  duplicateGlossaryTopicAction,
  saveGlossaryTopicAction,
} from "../../../_actions/glossary-topic-actions.ts";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import type { RichTextLabels } from "../../../_components/rich-text-editor.tsx";
import type { EditorAi } from "../../../_lib/editor-ai.ts";
import { liveHref, storedSlug } from "../../../_lib/live-href.ts";
import type { TopicEditorLabels, TopicTranslationDraft, TopicView } from "./editor-types.ts";
import { HeaderActions } from "../../../_components/header-actions.tsx";

function blankTranslation(locale: string): TopicTranslationDraft {
  return {
    locale,
    name: "",
    slug: "",
    description: "",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
  };
}

export function TopicEditor({
  topic,
  locales,
  canUpdate,
  canCreate,
  canDelete,
  labels,
  richTextLabels,
  ai,
}: {
  topic: TopicView;
  locales: string[];
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
  labels: TopicEditorLabels;
  richTextLabels: RichTextLabels;
  /** ADR-126. Absent when AI is off, the feature is off, or this person cannot spend. */
  ai?: EditorAi;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [locale, setLocale] = useState(topic.defaultLocale);
  const [isActive, setIsActive] = useState(topic.isActive);
  // ADR-139 — `isActive` keeps its own Published/Draft switch above.
  const [isFeatured, setIsFeatured] = useState(topic.isFeatured);
  const [isPremium, setIsPremium] = useState(topic.isPremium);
  const [cover, setCover] = useState(topic.cover);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Seeded from what the loader actually returned — the ADR-069 bug in one
  // line. A draft map keyed by locale rather than one flat form, so switching
  // language does not discard unsaved edits to the one you were on.
  const [drafts, setDrafts] = useState<Record<string, TopicTranslationDraft>>(() =>
    Object.fromEntries(topic.translations.map((tr) => [tr.locale, tr])),
  );

  const draft = drafts[locale] ?? blankTranslation(locale);
  // Merged from CURRENT state, not the last render: an AI patch and a keystroke
  // in the same tick would otherwise overwrite each other (ADR-126 §4).
  const setDraft = (patch: Partial<TopicTranslationDraft>) =>
    setDrafts((current) => ({
      ...current,
      [locale]: { ...(current[locale] ?? blankTranslation(locale)), ...patch },
    }));

  // ADR-126: the fillable fields as plain text — the review's "current" column,
  // the empty test behind each default tick, and the prompt's context.
  const aiFill = canUpdate ? ai?.fill : undefined;
  const aiSeo = canUpdate ? ai?.seo : undefined;
  const aiCurrent = {
    name: draft.name,
    description: htmlToBlockText(draft.description),
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoKeywords: draft.seoKeywords,
  };
  const applyFill = (patch: AiFillPatch) => {
    const next: Partial<TopicTranslationDraft> = {};
    for (const key of [
      "name",
      "description",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
    ] as const) {
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

  const previewPath = useMemo(
    () => (slug: string) =>
      `${locale === topic.defaultLocale ? "" : `/${locale}`}/glossary/topics/${slug}`,
    [locale, topic.defaultLocale],
  );
  const defaultSlug = storedSlug(topic.translations, topic.defaultLocale);
  const viewLiveHref = liveHref(`/glossary/topics/${defaultSlug}`, locale, topic.defaultLocale);

  // Exactly what the action receives, checked by the schema it parses with
  // (ADR-077) — so a message on screen is the refusal the server would give.
  const payload: SaveGlossaryTopicInput = {
    topicId: topic.id,
    meta: { isActive, isFeatured, isPremium, coverAssetId: cover.id },
    translation: {
      locale,
      name: draft.name.trim(),
      slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
      description: draft.description.trim() === "" ? null : draft.description,
      seoTitle: draft.seoTitle.trim() === "" ? null : draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim() === "" ? null : draft.seoDescription.trim(),
      seoKeywords: draft.seoKeywords.trim() === "" ? null : draft.seoKeywords.trim(),
    },
  };
  const form = useFieldErrors(saveGlossaryTopicSchema, payload);

  const submitForm = async () => {
    await saveGlossaryTopicAction(payload);
  };

  // changes-44 #3: the record's state and language travel with the content,
  // not on a row of their own above it.
  const stateCluster = (
    <>
      <StatusBadge tone={isActive ? "success" : "neutral"}>
        {isActive ? labels.published : labels.draft}
      </StatusBadge>
      <span className="text-xs text-muted-foreground">
        {labels.termCount}: {topic.termCount}
      </span>
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
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ADR-140 §3: the actions sit on the page heading's row. */}
      <HeaderActions>
        {/* A new tab, like every other "View live" in the admin: the editor
            was mid-edit, and replacing the document loses unsaved state.
            `rel` because `target="_blank"` hands the opened page a
            `window.opener` otherwise. */}
        {isActive && defaultSlug && (
          <Button
            variant="outline"
            render={<a href={viewLiveHref} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink aria-hidden data-icon="inline-start" />
            {labels.viewLive}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" aria-label={labels.openActions}>
                <Tags aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {canCreate && (
              <DropdownMenuItem
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const id = await duplicateGlossaryTopicAction(topic.id);
                    router.push(`/keystone/glossary/topics/${id}`);
                  })
                }
              >
                <Copy aria-hidden data-icon="inline-start" />
                {labels.duplicate}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 aria-hidden data-icon="inline-start" />
                  {labels.deleteTopic}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Enabled while fields are wrong: pressing it names them (ADR-077). */}
        <Button
          disabled={!canUpdate}
          loading={pending}
          onClick={() => {
            if (!form.validate()) return;
            run(() => submitForm(), { successMessage: labels.saved });
          }}
        >
          {labels.save}
        </Button>
      </HeaderActions>

      <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-(--grid-main-aside)">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.detailsSection}
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
                      name: labels.nameLabel,
                      description: labels.descriptionLabel,
                      seoTitle: labels.seoTitleLabel,
                      seoDescription: labels.seoDescriptionLabel,
                      seoKeywords: labels.seoKeywordsLabel,
                    }}
                    onApply={applyFill}
                  />
                ) : null}
              </>
            }
            description={labels.detailsSectionDescription}
            icon={FolderTree}
            accent="primary"
          >
            <Field
              label={labels.nameLabel}
              required
              error={form.error("translation.name")}
              adornment={fieldMenu("name")}
            >
              <Input
                value={draft.name}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ name: event.target.value })}
              />
            </Field>

            <SlugField
              value={draft.slug}
              source={draft.name}
              previewPath={previewPath}
              disabled={!canUpdate}
              error={form.error("translation.slug")}
              onChange={(next) => setDraft({ slug: next })}
              labels={labels.slug}
            />

            {/* Rich text since changes-18 PR 3: this renders as prose on the
                public topic page, not as a caption under a heading. Sanitized
                server-side on save (security.md #8) regardless of what this
                editor emits. */}
            <Field
              label={labels.descriptionLabel}
              hint={labels.descriptionHint}
              error={form.error("translation.description")}
            >
              <RichTextEditor
                value={draft.description}
                onChange={(html) => setDraft({ description: html })}
                mediaCategory="learn"
                labels={richTextLabels}
                {...(ai?.assistant && canUpdate
                  ? { ai: { ...ai.assistant, config: { ...ai.assistant.config, locale } } }
                  : {})}
              />
            </Field>
          </EditorSection>

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
                  entity={{ type: "glossary_topic", id: topic.id }}
                  current={{
                    seoTitle: draft.seoTitle,
                    seoDescription: draft.seoDescription,
                    focusKeywords: draft.seoKeywords,
                  }}
                  source={{ title: draft.name, content: aiCurrent.description, locale }}
                  onApply={(patch) =>
                    setDraft({
                      ...(patch.seoTitle !== undefined ? { seoTitle: patch.seoTitle } : {}),
                      ...(patch.seoDescription !== undefined
                        ? { seoDescription: patch.seoDescription }
                        : {}),
                      ...(patch.focusKeywords !== undefined
                        ? { seoKeywords: patch.focusKeywords }
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
              adornment={fieldMenu("seoTitle")}
            >
              <Input
                value={draft.seoTitle}
                maxLength={70}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ seoTitle: event.target.value })}
              />
            </Field>

            <Field
              label={labels.seoDescriptionLabel}
              error={form.error("translation.seoDescription")}
              adornment={fieldMenu("seoDescription")}
            >
              <Textarea
                value={draft.seoDescription}
                maxLength={180}
                rows={3}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ seoDescription: event.target.value })}
              />
            </Field>

            {/* Plural, free text, straight into the meta tag. The analysis
                below scores against the FIRST of them, as every other module
                scores its one focus keyword (changes-46 #3 put the panel here:
                the description IS this page's prose). */}
            <Field
              label={labels.seoKeywordsLabel}
              hint={labels.seoKeywordsHint}
              error={form.error("translation.seoKeywords")}
              adornment={fieldMenu("seoKeywords")}
            >
              <Input
                value={draft.seoKeywords}
                maxLength={255}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ seoKeywords: event.target.value })}
              />
            </Field>

            <SeoAnalysis
              title={draft.seoTitle || draft.name}
              description={draft.seoDescription}
              body={draft.description}
              focusKeywords={draft.seoKeywords}
            />
          </EditorSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.visibilitySection}
            description={labels.visibilitySectionDescription}
            icon={Tags}
            accent="success"
          >
            {/* A switch row, so @repo/ui's horizontal Field rather than the
                section's label-above-control wrapper — and the switch leads
                it (ADR-089). */}
            <FieldRoot orientation="horizontal">
              <Switch checked={isActive} disabled={!canUpdate} onCheckedChange={setIsActive} />
              <FieldContent>
                <FieldLabel>{labels.publishedLabel}</FieldLabel>
                <FieldDescription>{labels.publishedHint}</FieldDescription>
              </FieldContent>
            </FieldRoot>

            <p className="border-t pt-3 text-xs text-muted-foreground">{labels.saveHint}</p>
          </EditorSection>

          {/* ADR-133. The picture belongs to the topic, not to a language, so
              it saves with every locale's Save — the column is on the topic
              row, like `isActive` above. */}
          <EditorSection
            title={labels.coverSection}
            description={labels.coverSectionDescription}
            icon={ImageIcon}
            accent="warning"
          >
            <ImageUploadField
              id="topic-cover"
              label={labels.coverLabel}
              value={cover.url}
              purpose="content"
              category="learn"
              sourceType="GLOSSARY_TOPIC"
              disabled={!canUpdate}
              error={form.error("meta.coverAssetId")}
              onChange={(next) => setCover({ id: next?.id ?? null, url: next?.url ?? null })}
              labels={labels.upload}
            />
          </EditorSection>
          <ContentFlagsSection
            showActive={false}
            featuredEffect="first"
            premiumEffect="stored"
            value={{ isFeatured, isActive, isPremium }}
            onChange={(next) => {
              setIsFeatured(next.isFeatured);
              setIsPremium(next.isPremium);
            }}
            disabled={!canUpdate}
          />
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
          run(async () => {
            await deleteGlossaryTopicAction(topic.id);
            router.push("/keystone/glossary/topics");
          })
        }
      />
    </div>
  );
}
