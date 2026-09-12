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
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
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

  const previewPath = useMemo(
    () => (slug: string) =>
      `${locale === topic.defaultLocale ? "" : `/${locale}`}/glossary/topics/${slug}`,
    [locale, topic.defaultLocale],
  );

  // Exactly what the action receives, checked by the schema it parses with
  // (ADR-077) — so a message on screen is the refusal the server would give.
  const payload: SaveGlossaryTopicInput = {
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
  };
  const form = useFieldErrors(saveGlossaryTopicSchema, payload);

  const submitForm = async () => {
    await saveGlossaryTopicAction(payload);
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
        </div>
      </div>

      <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-(--grid-main-aside)">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.detailsSection}
            description={labels.detailsSectionDescription}
            icon={FolderTree}
            accent="primary"
          >
            <Field label={labels.nameLabel} required error={form.error("translation.name")}>
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
              />
            </Field>
          </EditorSection>

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
            >
              <Textarea
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
              label={labels.seoKeywordsLabel}
              hint={labels.seoKeywordsHint}
              error={form.error("translation.seoKeywords")}
            >
              <Input
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
            {/* A switch row, so @repo/ui's horizontal Field rather than the
                section's label-above-control wrapper. */}
            <FieldRoot orientation="horizontal">
              <FieldContent>
                <FieldLabel>{labels.publishedLabel}</FieldLabel>
                <FieldDescription>{labels.publishedHint}</FieldDescription>
              </FieldContent>
              <Switch checked={isActive} disabled={!canUpdate} onCheckedChange={setIsActive} />
            </FieldRoot>

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
