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
import { Copy, ExternalLink, FolderTree, Search, Tags, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { RichTextEditor } from "../../../_components/rich-text-editor.tsx";
import { EditorSection, Field } from "../../../_components/editor/editor-section.tsx";
import { SlugField } from "../../../_components/editor/slug-field.tsx";
import { StatusBadge } from "../../../_components/status-badge.tsx";
import {
  deleteGlossaryTopicAction,
  duplicateGlossaryTopicAction,
  saveGlossaryTopicAction,
} from "../../../_actions/glossary-topic-actions.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import type { RichTextLabels } from "../../../_components/rich-text-editor.tsx";
import type { TopicEditorLabels, TopicTranslationDraft, TopicView } from "./editor-types.ts";

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
}: {
  topic: TopicView;
  locales: string[];
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
  labels: TopicEditorLabels;
  richTextLabels: RichTextLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [locale, setLocale] = useState(topic.defaultLocale);
  const [isActive, setIsActive] = useState(topic.isActive);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Seeded from what the loader actually returned — the ADR-069 bug in one
  // line. A draft map keyed by locale rather than one flat form, so switching
  // language does not discard unsaved edits to the one you were on.
  const [drafts, setDrafts] = useState<Record<string, TopicTranslationDraft>>(() =>
    Object.fromEntries(topic.translations.map((tr) => [tr.locale, tr])),
  );

  const draft = drafts[locale] ?? blankTranslation(locale);
  const setDraft = (patch: Partial<TopicTranslationDraft>) =>
    setDrafts((current) => ({ ...current, [locale]: { ...draft, ...patch } }));

  const canSave = draft.name.trim() !== "";

  const previewPath = useMemo(
    () => (slug: string) =>
      `${locale === topic.defaultLocale ? "" : `/${locale}`}/glossary/topics/${slug}`,
    [locale, topic.defaultLocale],
  );

  const submitForm = async () => {
    await saveGlossaryTopicAction({
      topicId: topic.id,
      meta: { isActive },
      translation: {
        locale,
        name: draft.name.trim(),
        slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
        description: draft.description.trim() === "" ? null : draft.description,
        seoTitle: draft.seoTitle.trim() === "" ? null : draft.seoTitle.trim(),
        seoDescription: draft.seoDescription.trim() === "" ? null : draft.seoDescription.trim(),
        seoKeywords: draft.seoKeywords.trim() === "" ? null : draft.seoKeywords.trim(),
      },
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive && draft.slug && (
            <Button variant="outline" size="sm" render={<a href={previewPath(draft.slug)} />}>
              <ExternalLink aria-hidden data-icon="inline-start" />
              {labels.viewLive}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon-sm" aria-label={labels.openActions}>
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
                      router.push(`/admin/glossary/topics/${id}`);
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

          <Button
            disabled={pending || !canSave || !canUpdate}
            onClick={() => run(() => submitForm(), { successMessage: labels.saved })}
          >
            {labels.save}
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.detailsSection}
            description={labels.detailsSectionDescription}
            icon={FolderTree}
            accent="primary"
          >
            <Field id="topic-name" label={labels.nameLabel}>
              <Input
                id="topic-name"
                value={draft.name}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ name: event.target.value })}
              />
            </Field>

            <SlugField
              id="topic-slug"
              value={draft.slug}
              source={draft.name}
              previewPath={previewPath}
              disabled={!canUpdate}
              onChange={(next) => setDraft({ slug: next })}
              labels={labels.slug}
            />

            {/* Rich text since changes-18 PR 3: this renders as prose on the
                public topic page, not as a caption under a heading. Sanitized
                server-side on save (security.md #8) regardless of what this
                editor emits. */}
            <Field label={labels.descriptionLabel} hint={labels.descriptionHint}>
              <RichTextEditor
                id="topic-description"
                value={draft.description}
                onChange={(html) => setDraft({ description: html })}
                mediaCategory="learn"
                labels={richTextLabels}
              />
            </Field>
          </EditorSection>

          <EditorSection
            title={labels.seoSection}
            description={labels.seoSectionDescription}
            icon={Search}
            accent="info"
          >
            <Field id="topic-seo-title" label={labels.seoTitleLabel} hint={labels.seoTitleHint}>
              <Input
                id="topic-seo-title"
                value={draft.seoTitle}
                maxLength={70}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ seoTitle: event.target.value })}
              />
            </Field>

            <Field id="topic-seo-description" label={labels.seoDescriptionLabel}>
              <Textarea
                id="topic-seo-description"
                value={draft.seoDescription}
                maxLength={180}
                rows={3}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ seoDescription: event.target.value })}
              />
            </Field>

            {/* Plural, free text, straight into the meta tag. No `SeoAnalysis`
                here: it scores prose against ONE focus keyword and a topic page
                has no prose to score (changes-18 §2 D4). */}
            <Field
              id="topic-seo-keywords"
              label={labels.seoKeywordsLabel}
              hint={labels.seoKeywordsHint}
            >
              <Input
                id="topic-seo-keywords"
                value={draft.seoKeywords}
                maxLength={255}
                disabled={!canUpdate}
                onChange={(event) => setDraft({ seoKeywords: event.target.value })}
              />
            </Field>
          </EditorSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.visibilitySection}
            description={labels.visibilitySectionDescription}
            icon={Tags}
            accent="success"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{labels.publishedLabel}</span>
                <span className="text-xs text-muted-foreground">{labels.publishedHint}</span>
              </div>
              <Switch checked={isActive} disabled={!canUpdate} onCheckedChange={setIsActive} />
            </div>

            <p className="border-t pt-3 text-xs text-muted-foreground">{labels.saveHint}</p>
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
          run(async () => {
            await deleteGlossaryTopicAction(topic.id);
            router.push("/admin/glossary/topics");
          })
        }
      />
    </div>
  );
}
