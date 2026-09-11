"use client";

// The glossary term editor (ADR-069, changes-17 PR 2).
//
// Modelled on `lesson-editor.tsx`, not `article-editor.tsx`, for ADR-063's
// reason: the glossary runs the SEVEN-state `CONTENT_TRANSITIONS` machine, so
// `ContentStatusPanel` fits and `publish-panel.tsx` does not. (A term DOES have
// a `scheduledFor` column as of ADR-071 — the panel grew the field.)
//
// What this screen replaces is an inline form on the list page that could not
// edit at all — it initialised every field to "" and its loader never selected
// a body, so opening a published term showed three blank inputs. Every field
// here arrives populated, which is the whole point.
//
// One save for the whole screen, through `saveGlossaryTermAction`:
// `saveGlossaryTerm` writes the term row and the active locale's translation in
// ONE transaction, so a term whose topic saved but whose definition did not is
// a state that cannot be reached.
//
// The FOUR prose fields are deliberate, not padding. They are the columns the
// schema has carried since Module 01 with no write path: the one-line
// definition the A–Z renders inline, the fuller explanation, the advanced
// treatment, and a worked example. All four feed the source hash (ADR-069 §2),
// so editing any of them marks stale translations OUTDATED.
import { useMemo, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  FolderTree,
  Info,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  glossaryDifficultySchema,
  type GlossaryDifficultyInput,
  type GlossaryFaqItemInput,
  type SaveGlossaryTermInput,
} from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  deleteGlossaryTermAction,
  saveGlossaryTermAction,
  transitionGlossaryAction,
} from "../../_actions/content-actions.ts";
import { createGlossaryTopicAction } from "../../_actions/glossary-topic-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { ContentStatusPanel } from "../../_components/editor/content-status-panel.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { FaqPanel } from "../../_components/editor/faq-panel.tsx";
import { SeoAnalysis } from "../../_components/editor/seo-analysis.tsx";
import { ImageUploadField } from "../../_components/image-upload-field.tsx";
import { RichTextEditor } from "../../_components/rich-text-editor.tsx";
import { CONTENT_STATUS_TONE, StatusBadge, statusTone } from "../../_components/status-badge.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import type {
  GlossaryEditorLabels,
  GlossaryTermData,
  GlossaryTranslationDraft,
} from "./editor-types.ts";

/**
 * The sentinel for the two dropdowns whose empty option is a REAL choice.
 *
 * Not an empty string: a listbox reads `""` as "nothing selected", and both of
 * these are deliberate selections — "Unfiled" for a topic and "Both schools"
 * for a track. They are also opposite in meaning (ADR-069 §3), which is why
 * each dropdown gets its own labelled option rather than a shared "None".
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

function blankTranslation(locale: string): GlossaryTranslationDraft {
  return {
    locale,
    term: "",
    slug: "",
    simpleExplanation: "",
    detailedExplanation: "",
    advancedExplanation: "",
    exampleScenario: "",
    faq: [],
    seoTitle: "",
    seoDescription: "",
    translationStatus: "DRAFT",
  };
}

export function GlossaryEditor({
  term,
  topicOptions,
  locales,
  defaultLocale,
  siteUrl,
  canUpdate,
  canPublish,
  canDelete,
  canCreateTopic,
  labels,
}: {
  term: GlossaryTermData;
  topicOptions: { id: string; name: string }[];
  locales: string[];
  defaultLocale: string;
  siteUrl: string;
  canUpdate: boolean;
  canPublish: boolean;
  canDelete: boolean;
  /** `glossary.create` — the key the inline topic dialog's action re-checks. */
  canCreateTopic: boolean;
  labels: GlossaryEditorLabels;
}) {
  const { run, pending } = useServerAction();

  const [locale, setLocale] = useState(defaultLocale);
  // Every locale's stored translation, keyed. Edits are held per locale so
  // switching away and back does not lose them — the article editor's rule.
  const [drafts, setDrafts] = useState<Record<string, GlossaryTranslationDraft>>(() =>
    Object.fromEntries(term.translations.map((t) => [t.locale, t])),
  );
  const [topicId, setTopicId] = useState<string | null>(term.topicId);
  // A local copy of the option list, so a topic created inline appears in the
  // picker without a round trip through the server component that fed it. The
  // server list is still the source on the next load; this is the optimistic
  // half, and it only ever grows.
  const [topics, setTopics] = useState(topicOptions);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [track, setTrack] = useState<string | null>(term.track);
  const [difficulty, setDifficulty] = useState<GlossaryDifficultyInput>(
    () => glossaryDifficultySchema.safeParse(term.difficulty).data ?? "BEGINNER",
  );
  const [formula, setFormula] = useState(term.formula);
  const [image, setImage] = useState<{ id: string | null; url: string | null }>({
    id: null,
    url: term.imageUrl,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const draft = drafts[locale] ?? blankTranslation(locale);
  const setDraft = (patch: Partial<GlossaryTranslationDraft>) =>
    setDrafts((current) => ({ ...current, [locale]: { ...draft, ...patch } }));

  // Mirrors the contract so the Save button does not offer to submit a payload
  // the schema will refuse. The schema and the service are still the gate.
  const canSave = draft.term.trim() !== "" && draft.simpleExplanation.trim() !== "";

  const publicPath = useMemo(() => `/${locale}/glossary/${draft.slug || ""}`, [locale, draft.slug]);

  const submitForm = async () => {
    const payload: SaveGlossaryTermInput = {
      termId: term.id,
      meta: {
        topicId,
        track: track as SaveGlossaryTermInput["meta"]["track"],
        difficulty,
        formula: formula.trim() === "" ? null : formula.trim(),
        imageUrl: image.url,
      },
      translation: {
        locale,
        term: draft.term.trim(),
        slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
        simpleExplanation: draft.simpleExplanation,
        detailedExplanation:
          draft.detailedExplanation.trim() === "" ? null : draft.detailedExplanation,
        advancedExplanation:
          draft.advancedExplanation.trim() === "" ? null : draft.advancedExplanation,
        exampleScenario: draft.exampleScenario.trim() === "" ? null : draft.exampleScenario,
        faq: draft.faq,
        seoTitle: draft.seoTitle.trim() === "" ? null : draft.seoTitle.trim(),
        seoDescription: draft.seoDescription.trim() === "" ? null : draft.seoDescription.trim(),
      },
    };
    await saveGlossaryTermAction(payload);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(CONTENT_STATUS_TONE, term.status)}>
            {labels.statusLabels[term.status] ?? term.status}
          </StatusBadge>
          {term.deleted && <StatusBadge tone="destructive">{labels.softDelete}</StatusBadge>}
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
          {term.status === "PUBLISHED" && draft.slug && (
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
              {labels.updateTerm}
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
                {term.deleted ? (
                  // Restore is NOT confirmed — it is the undo (ADR-044 #7).
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() => run(() => deleteGlossaryTermAction(term.id, false))}
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
            title={labels.definitionSection}
            description={labels.definitionSectionDescription}
            icon={BookOpen}
            accent="primary"
          >
            <Field
              id="glossary-term"
              label={labels.termLabel}
              adornment={<CharCount value={draft.term} max={150} />}
            >
              <Input
                id="glossary-term"
                value={draft.term}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ term: e.target.value })}
              />
            </Field>

            <Field
              id="glossary-slug"
              label={labels.slugLabel}
              hint={`${labels.termUrl}: ${publicPath}`}
            >
              <Input
                id="glossary-slug"
                value={draft.slug}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ slug: e.target.value })}
              />
            </Field>

            {/* The one required body. `allowHtmlMode` is off here on purpose:
                this is a one- or two-sentence definition that renders inline
                in the A–Z list, and a source view invites markup that the
                list would show as a wall of text. */}
            <Field label={labels.simpleLabel} hint={labels.simpleHint}>
              <RichTextEditor
                id="glossary-simple"
                value={draft.simpleExplanation}
                onChange={(html) => setDraft({ simpleExplanation: html })}
                labels={labels.editor}
              />
            </Field>

            <Field label={labels.detailedLabel} hint={labels.detailedHint}>
              <RichTextEditor
                id="glossary-detailed"
                value={draft.detailedExplanation}
                onChange={(html) => setDraft({ detailedExplanation: html })}
                labels={labels.editor}
                allowHtmlMode
              />
            </Field>

            <Field label={labels.advancedLabel} hint={labels.advancedHint}>
              <RichTextEditor
                id="glossary-advanced"
                value={draft.advancedExplanation}
                onChange={(html) => setDraft({ advancedExplanation: html })}
                labels={labels.editor}
                allowHtmlMode
              />
            </Field>

            <Field label={labels.exampleLabel} hint={labels.exampleHint}>
              <RichTextEditor
                id="glossary-example"
                value={draft.exampleScenario}
                onChange={(html) => setDraft({ exampleScenario: html })}
                labels={labels.editor}
                allowHtmlMode
              />
            </Field>
          </EditorSection>

          <FaqPanel<GlossaryFaqItemInput>
            items={draft.faq}
            onChange={(faq) => setDraft({ faq })}
            // A glossary FAQ row is exactly its two fields — nothing to carry
            // across an edit, unlike the article's `id`.
            makeItem={(fields) => fields}
            labels={labels.faq}
          />

          <EditorSection
            title={labels.seoSection}
            description={labels.seoSectionDescription}
            icon={Search}
            accent="info"
          >
            <Field
              id="glossary-seo-title"
              label={labels.seoTitleLabel}
              hint={labels.seoTitleHint}
              adornment={<CharCount value={draft.seoTitle} max={70} />}
            >
              <Input
                id="glossary-seo-title"
                value={draft.seoTitle}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoTitle: e.target.value })}
              />
            </Field>

            <Field
              id="glossary-seo-description"
              label={labels.seoDescriptionLabel}
              hint={labels.seoDescriptionHint}
              adornment={<CharCount value={draft.seoDescription} max={180} />}
            >
              <Input
                id="glossary-seo-description"
                value={draft.seoDescription}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoDescription: e.target.value })}
              />
            </Field>

            <SeoAnalysis
              title={draft.seoTitle || draft.term}
              description={draft.seoDescription}
              focusKeywords={draft.term}
              body={draft.simpleExplanation + draft.detailedExplanation}
              labels={labels.analysis}
            />
          </EditorSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ContentStatusPanel
            status={term.status}
            legalTransitions={term.legalTransitions}
            publishedAt={term.publishedAt}
            scheduledFor={term.scheduledFor}
            updatedAt={term.updatedAt}
            canPublish={canPublish}
            canSave={canUpdate && canSave}
            save={submitForm}
            transitionTo={(to, scheduledForIso) =>
              transitionGlossaryAction(term.id, to, scheduledForIso)
            }
            labels={labels.status}
          />

          <EditorSection
            title={labels.filingSection}
            description={labels.filingSectionDescription}
            icon={FolderTree}
            accent="neutral"
          >
            {/* The two nulls that mean opposite things (ADR-069 §3). They are
                adjacent on purpose — an editor filing a term meets both at
                once — and each carries its own hint saying which is which. */}
            {/* The picker carries a create affordance because the alternative
                is what editors actually did: leave a term unfiled rather than
                abandon a half-written definition to go make a topic. The
                article editor's inline category creation (changes-10, ADR-046)
                is the same move; this creates name-only and files the term
                under it immediately, and the full topic editor is where the
                description and SEO get written. */}
            <Field
              id="glossary-topic"
              label={labels.topicLabel}
              hint={labels.topicHint}
              adornment={
                canCreateTopic ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setNewTopicOpen(true)}
                  >
                    <Plus aria-hidden data-icon="inline-start" />
                    {labels.topicCreate}
                  </Button>
                ) : undefined
              }
            >
              <AdminCombobox
                id="glossary-topic"
                value={topicId ?? NONE}
                disabled={!canUpdate}
                onValueChange={(next) => setTopicId(!next || next === NONE ? null : next)}
                options={[
                  { value: NONE, label: labels.topicNone },
                  ...topics.map((topic) => ({ value: topic.id, label: topic.name })),
                ]}
              />
            </Field>

            <Field id="glossary-track" label={labels.trackLabel} hint={labels.trackHint}>
              <AdminCombobox
                id="glossary-track"
                value={track ?? NONE}
                disabled={!canUpdate}
                onValueChange={(next) => setTrack(!next || next === NONE ? null : next)}
                options={[
                  // First, because it is the right answer for most vocabulary:
                  // "leverage" and "volatility" are forex and crypto both.
                  { value: NONE, label: labels.trackBoth },
                  ...Object.entries(labels.tracks).map(([value, label]) => ({ value, label })),
                ]}
              />
            </Field>

            <Field id="glossary-difficulty" label={labels.difficultyLabel}>
              <AdminCombobox
                id="glossary-difficulty"
                value={difficulty}
                disabled={!canUpdate}
                onValueChange={(next) => {
                  const parsed = glossaryDifficultySchema.safeParse(next);
                  if (parsed.success) setDifficulty(parsed.data);
                }}
                options={Object.entries(labels.difficulties).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>

            {/* `font-mono` here is the narrow exception ADR-044 #6 carves out:
                a control whose VALUE is read character by character. */}
            <Field id="glossary-formula" label={labels.formulaLabel} hint={labels.formulaHint}>
              <Input
                id="glossary-formula"
                value={formula}
                disabled={!canUpdate}
                className="font-mono"
                onChange={(e) => setFormula(e.target.value)}
              />
            </Field>

            <ImageUploadField
              id="glossary-image"
              label={labels.imageLabel}
              value={image.url}
              purpose="content"
              category="learn"
              disabled={!canUpdate}
              onChange={(next) => setImage({ id: next?.id ?? null, url: next?.url ?? null })}
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
                <dd className="truncate font-mono text-xs">{term.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{labels.createdLabel}</dt>
                <dd>{term.createdAt}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{labels.updatedLabel}</dt>
                <dd>{term.updatedAt}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{labels.viewCountLabel}</dt>
                <dd className="tabular-nums">{term.viewCount}</dd>
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
        onConfirm={() => run(() => deleteGlossaryTermAction(term.id, true))}
      />

      <Dialog open={newTopicOpen} onOpenChange={setNewTopicOpen}>
        <DialogContent closeLabel={labels.cancel}>
          {/* Title AND description — ADR-057 #5. */}
          <DialogHeader>
            <DialogTitle>{labels.topicCreateTitle}</DialogTitle>
            <DialogDescription>{labels.topicCreateDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="glossary-new-topic">{labels.topicNameLabel}</Label>
            <Input
              id="glossary-new-topic"
              value={newTopicName}
              autoFocus
              onChange={(event) => setNewTopicName(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTopicOpen(false)}>
              {labels.cancel}
            </Button>
            <Button
              disabled={pending || newTopicName.trim() === ""}
              onClick={() =>
                run(
                  async () => {
                    const name = newTopicName.trim();
                    const id = await createGlossaryTopicAction(name);
                    // Added to the local list AND selected: the editor asked
                    // for this topic while filing this term, so leaving them
                    // to pick it again from the dropdown is a step with no
                    // decision in it.
                    setTopics((current) => [...current, { id, name }]);
                    setTopicId(id);
                    setNewTopicName("");
                    setNewTopicOpen(false);
                  },
                  // The page's own data is refetched on save; refreshing here
                  // would blow away every unsaved field in the editor behind
                  // this dialog.
                  { skipRefresh: true },
                )
              }
            >
              {labels.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
