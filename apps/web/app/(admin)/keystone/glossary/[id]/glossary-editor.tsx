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
// ONE prose field since changes-46 #1: "Details", a rich body with the Visual /
// HTML tabs every editor has. It is saved to `simpleExplanation` — the required
// column every surface already reads — and the three other prose columns
// (detailed, advanced, example) are saved as null. `page.tsx` opens a legacy
// term with all four merged under their public headings (merge-prose.ts), so
// the first Save keeps every word. All four still feed the source hash
// (ADR-069 §2), so the change still marks stale translations OUTDATED.
import { useMemo, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  FolderTree,
  Info,
  ImageIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  createGlossaryTopicSchema,
  glossaryDifficultySchema,
  saveGlossaryTermSchema,
  type GlossaryDifficultyInput,
  type GlossaryFaqItemInput,
  type SaveGlossaryTermInput,
} from "@repo/contracts";
import { htmlToBlockText, slugify } from "@repo/utils";
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
import { Textarea } from "@repo/ui/components/textarea";
import {
  deleteGlossaryTermAction,
  saveGlossaryTermAction,
  transitionGlossaryAction,
} from "../../_actions/content-actions.ts";
import { createGlossaryTopicAction } from "../../_actions/glossary-topic-actions.ts";
import { AiFieldMenu, AiFillButton, type AiFillPatch } from "../../_components/ai-fill.tsx";
import { AiSeoButton } from "../../_components/ai-seo-dialog.tsx";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { ContentStatusPanel } from "../../_components/editor/content-status-panel.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import {
  ContentFlagsSection,
  type ContentFlags,
} from "../../_components/editor/content-flags-fields.tsx";
import { FaqPanel } from "../../_components/editor/faq-panel.tsx";
import { SeoAnalysis } from "../../_components/editor/seo-analysis.tsx";
import { ImageUploadField } from "../../_components/image-upload-field.tsx";
import { RichTextEditor } from "../../_components/rich-text-editor.tsx";
import { CONTENT_STATUS_TONE, StatusBadge, statusTone } from "../../_components/status-badge.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import type { EditorAi } from "../../_lib/editor-ai.ts";
import { liveHref, storedSlug } from "../../_lib/live-href.ts";
import { TranslationControls } from "../../_components/editor/translation-controls.tsx";
import {
  holdsHumanText,
  mergeTranslationPatch,
  textFields,
} from "../../_lib/machine-translation.ts";
import type {
  GlossaryEditorLabels,
  GlossaryTermData,
  GlossaryTranslationDraft,
} from "./editor-types.ts";
import { HeaderActions } from "../../_components/header-actions.tsx";

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
      className={`text-xs tabular-nums ${value.length > max ? "text-destructive-interactive" : "text-muted-foreground"}`}
    >
      {value.length}/{max}
    </span>
  );
}

/** The words AI translation carries across. Never `slug` (a redirect is a human decision). */
const TRANSLATABLE_TEXT = [
  "term",
  "details",
  "seoTitle",
  "seoDescription",
] as const satisfies readonly (keyof GlossaryTranslationDraft)[];
/** An edit to any of these clears the machine flag — the FAQ included. */
const TRANSLATABLE_FIELDS = [
  ...TRANSLATABLE_TEXT,
  "faq",
] as const satisfies readonly (keyof GlossaryTranslationDraft)[];

/** The FAQ as numbered fields (`faq.0.question`), the payload being a flat record. */
function faqFields(faq: readonly { question: string; answer: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  faq.forEach((item, index) => {
    if (item.question.trim()) fields[`faq.${index}.question`] = item.question;
    if (item.answer.trim()) fields[`faq.${index}.answer`] = item.answer;
  });
  return fields;
}

function blankTranslation(locale: string): GlossaryTranslationDraft {
  return {
    locale,
    term: "",
    slug: "",
    details: "",
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
  ai,
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
  /** ADR-126. Absent when AI is off, the feature is off, or this person cannot spend. */
  ai?: EditorAi;
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
  const [flags, setFlags] = useState<ContentFlags>(term.flags);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const draft = drafts[locale] ?? blankTranslation(locale);
  // Merged from CURRENT state, not the last render: an AI patch and a keystroke
  // in the same tick would otherwise overwrite each other (ADR-126 §4).
  const setDraft = (patch: Partial<GlossaryTranslationDraft>) =>
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
  // The assistant writes in the locale being edited (the switcher above).
  const aiAssistant =
    canUpdate && ai?.assistant
      ? { ...ai.assistant, config: { ...ai.assistant.config, locale } }
      : undefined;
  const aiSeo = canUpdate ? ai?.seo : undefined;
  const aiCurrent = {
    term: draft.term,
    // The AI registry names the COLUMN (`AI_FILL_FIELDS.glossary_term`).
    simpleExplanation: htmlToBlockText(draft.details),
    faq: draft.faq.map((item) => `${item.question}\n${item.answer}`).join("\n\n"),
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
  };
  const applyFill = (patch: AiFillPatch) => {
    const next: Partial<GlossaryTranslationDraft> = {};
    for (const key of ["term", "seoTitle", "seoDescription"] as const) {
      const value = patch[key];
      if (typeof value === "string") next[key] = value;
    }
    if (typeof patch.simpleExplanation === "string") next.details = patch.simpleExplanation;
    // A glossary FAQ row is exactly its two fields — no id to mint — so the
    // generated pair IS the row.
    const faq = patch.faq;
    if (Array.isArray(faq)) {
      next.faq = faq.flatMap((item) =>
        typeof item === "object" && "question" in item && "answer" in item
          ? [{ question: item.question, answer: item.answer }]
          : [],
      );
    }
    setDraft(next);
  };
  const fieldMenu = (field: Exclude<keyof typeof aiCurrent, "faq">) =>
    aiFill ? (
      <AiFieldMenu
        config={aiFill}
        field={field}
        locale={locale}
        current={aiCurrent}
        onApply={(value) => setDraft({ [field]: value })}
      />
    ) : undefined;

  // The slug the SERVER will store if this field is left blank —
  // `saveGlossaryTerm` derives it with exactly this `slugify` over exactly
  // this term. Shown as the input's placeholder and used in the URL preview
  // (changes-22): the field looked required-but-empty and the preview read
  // "/en/glossary/" with nothing after it, so a term saved with a blank slug
  // looked like a term with no address. Placeholder rather than writing into
  // the field, which is what the article editor does — filling it would turn
  // a derived value into a typed one, and then renaming the term would stop
  // moving the URL with it.
  const derivedSlug = useMemo(
    () => draft.slug.trim() || slugify(draft.term),
    [draft.slug, draft.term],
  );
  const publicPath = useMemo(() => `/${locale}/glossary/${derivedSlug}`, [locale, derivedSlug]);
  const defaultSlug = storedSlug(term.translations, defaultLocale);
  const viewLiveHref = liveHref(`/glossary/${defaultSlug}`, locale, defaultLocale);

  // Exactly what the action receives — so the inline messages come from the
  // same schema, over the same values, that the server will parse (ADR-077).
  const payload: SaveGlossaryTermInput = {
    termId: term.id,
    meta: {
      topicId,
      track: track as SaveGlossaryTermInput["meta"]["track"],
      difficulty,
      formula: formula.trim() === "" ? null : formula.trim(),
      imageUrl: image.url,
      ...flags,
    },
    translation: {
      locale,
      term: draft.term.trim(),
      slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
      // changes-46 #1: the one body, and the three retired columns cleared —
      // their words are already in `details`, merged when the editor opened.
      simpleExplanation: draft.details,
      detailedExplanation: null,
      advancedExplanation: null,
      exampleScenario: null,
      faq: draft.faq,
      seoTitle: draft.seoTitle.trim() === "" ? null : draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim() === "" ? null : draft.seoDescription.trim(),
      // changes-29 B3: sent only while the words are untouched AI output.
      ...(draft.machineTranslated ? { machineTranslated: true } : {}),
    },
  };
  const form = useFieldErrors(saveGlossaryTermSchema, payload);

  const submitForm = async () => {
    await saveGlossaryTermAction(payload);
  };

  const topicForm = useFieldErrors(createGlossaryTopicSchema, { name: newTopicName });
  const closeNewTopic = () => {
    setNewTopicOpen(false);
    topicForm.reset();
  };

  // changes-44 #3: the record's state and language travel with the content,
  // not on a row of their own above it.
  const stateCluster = (
    <>
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
      <TranslationControls
        translate={ai?.translate}
        locale={locale}
        defaultLocale={defaultLocale}
        translationStatus={draft.translationStatus}
        machineTranslated={draft.machineTranslated}
        canUpdate={canUpdate}
        entity={{ type: "glossary_term", id: term.id }}
        sourceFields={{
          ...textFields(drafts[defaultLocale], TRANSLATABLE_TEXT),
          ...faqFields(drafts[defaultLocale]?.faq ?? []),
        }}
        wouldOverwrite={holdsHumanText(draft, TRANSLATABLE_TEXT)}
        onApply={(translated) => {
          // The FAQ keeps the SOURCE's shape, the source's own words where the
          // model returned nothing for an entry.
          const sourceFaq = drafts[defaultLocale]?.faq ?? [];
          const faqTranslated = sourceFaq.some(
            (_, index) =>
              `faq.${index}.question` in translated || `faq.${index}.answer` in translated,
          );
          setDraft({
            ...textFields(translated as Partial<GlossaryTranslationDraft>, TRANSLATABLE_TEXT),
            ...(faqTranslated
              ? {
                  faq: sourceFaq.map((item, index) => ({
                    question: translated[`faq.${index}.question`] ?? item.question,
                    answer: translated[`faq.${index}.answer`] ?? item.answer,
                  })),
                }
              : {}),
            machineTranslated: true,
          });
        }}
      />
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ADR-140 §3: the actions sit on the page heading's row. */}
      <HeaderActions>
        {term.status === "PUBLISHED" && defaultSlug && (
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
          // Enabled while fields are wrong: pressing it names them (ADR-077).
          <Button
            loading={pending}
            onClick={() => {
              if (!form.validate()) return;
              run(() => submitForm(), { successMessage: labels.saved });
            }}
          >
            {labels.updateTerm}
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
      </HeaderActions>

      <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-(--grid-2-1)">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.definitionSection}
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
                      term: labels.termLabel,
                      simpleExplanation: labels.detailsLabel,
                      faq: labels.faq.section,
                      seoTitle: labels.seoTitleLabel,
                      seoDescription: labels.seoDescriptionLabel,
                    }}
                    onApply={applyFill}
                  />
                ) : null}
              </>
            }
            description={labels.definitionSectionDescription}
            icon={BookOpen}
            accent="primary"
          >
            <Field
              label={labels.termLabel}
              required
              error={form.error("translation.term")}
              adornment={
                <span className="flex items-center gap-2">
                  <CharCount value={draft.term} max={150} />
                  {fieldMenu("term")}
                </span>
              }
            >
              <Input
                value={draft.term}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ term: e.target.value })}
              />
            </Field>

            <Field
              label={labels.slugLabel}
              hint={`${labels.termUrl}: ${publicPath}`}
              error={form.error("translation.slug")}
            >
              <Input
                value={draft.slug}
                placeholder={slugify(draft.term)}
                className="font-mono text-xs"
                disabled={!canUpdate}
                onChange={(e) => setDraft({ slug: e.target.value })}
              />
            </Field>

            {/* ONE body with the Visual / HTML tabs (changes-46 #1). Its first
                paragraph is the definition every listing prints (`htmlLead`),
                which is what the hint tells the author. */}
            <Field
              label={labels.detailsLabel}
              hint={labels.detailsHint}
              required
              error={form.error("translation.simpleExplanation")}
            >
              <RichTextEditor
                value={draft.details}
                onChange={(html) => setDraft({ details: html })}
                labels={labels.editor}
                mediaCategory="learn"
                {...(aiAssistant ? { ai: aiAssistant } : {})}
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
            actions={
              // The article editor's review dialog, in the same place: the section
              // header, because it fills the whole section. Absent when SEO AI is off.
              aiSeo ? (
                <AiSeoButton
                  labels={aiSeo.labels}
                  entity={{ type: "glossary_term", id: term.id }}
                  current={{ seoTitle: draft.seoTitle, seoDescription: draft.seoDescription }}
                  source={{
                    title: draft.term,
                    content: aiCurrent.simpleExplanation,
                    locale,
                  }}
                  onApply={(patch) =>
                    setDraft({
                      ...(patch.seoTitle !== undefined ? { seoTitle: patch.seoTitle } : {}),
                      ...(patch.seoDescription !== undefined
                        ? { seoDescription: patch.seoDescription }
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
                <span className="flex items-center gap-2">
                  <CharCount value={draft.seoTitle} max={70} />
                  {fieldMenu("seoTitle")}
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
                <span className="flex items-center gap-2">
                  <CharCount value={draft.seoDescription} max={180} />
                  {fieldMenu("seoDescription")}
                </span>
              }
            >
              <Textarea
                value={draft.seoDescription}
                rows={3}
                maxLength={180}
                disabled={!canUpdate}
                onChange={(e) => setDraft({ seoDescription: e.target.value })}
              />
            </Field>

            <SeoAnalysis
              title={draft.seoTitle || draft.term}
              description={draft.seoDescription}
              focusKeywords={draft.term}
              body={draft.details}
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
            canSave={canUpdate}
            // Publishing saves first, so the panel validates first and stops
            // there, with the fields named inline (ADR-077).
            validate={form.validate}
            save={submitForm}
            transitionTo={(to, scheduledForIso) =>
              transitionGlossaryAction(term.id, to, scheduledForIso)
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
              label={labels.imageLabel}
              value={image.url}
              purpose="content"
              category="learn"
              disabled={!canUpdate}
              error={form.error("meta.imageUrl")}
              onChange={(next) => setImage({ id: next?.id ?? null, url: next?.url ?? null })}
              labels={labels.upload}
            />
          </EditorSection>

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
              label={labels.topicLabel}
              hint={labels.topicHint}
              error={form.error("meta.topicId")}
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
                value={topicId ?? NONE}
                disabled={!canUpdate}
                onValueChange={(next) => setTopicId(!next || next === NONE ? null : next)}
                options={[
                  { value: NONE, label: labels.topicNone },
                  ...topics.map((topic) => ({ value: topic.id, label: topic.name })),
                ]}
              />
            </Field>

            <Field
              label={labels.trackLabel}
              hint={labels.trackHint}
              error={form.error("meta.track")}
            >
              <AdminCombobox
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

            <Field label={labels.difficultyLabel} error={form.error("meta.difficulty")}>
              <AdminCombobox
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
            <Field
              label={labels.formulaLabel}
              hint={labels.formulaHint}
              error={form.error("meta.formula")}
            >
              <Input
                value={formula}
                disabled={!canUpdate}
                className="font-mono"
                onChange={(e) => setFormula(e.target.value)}
              />
            </Field>
          </EditorSection>

          {/* changes-44 #5: last of the settings, before the read-only Info card. */}
          <ContentFlagsSection
            value={flags}
            onChange={setFlags}
            disabled={!canUpdate}
            featuredEffect="first"
            premiumEffect="stored"
          />

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

      <Dialog
        open={newTopicOpen}
        onOpenChange={(next) => (next ? setNewTopicOpen(true) : closeNewTopic())}
      >
        <DialogContent closeLabel={labels.cancel}>
          {/* Title AND description — ADR-057 #5. */}
          <DialogHeader>
            <DialogTitle>{labels.topicCreateTitle}</DialogTitle>
            <DialogDescription>{labels.topicCreateDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field label={labels.topicNameLabel} required error={topicForm.error("name")}>
              <Input
                value={newTopicName}
                autoFocus
                onChange={(event) => setNewTopicName(event.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeNewTopic}>
              {labels.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                if (!topicForm.validate()) return;
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
                    closeNewTopic();
                  },
                  // The page's own data is refetched on save; refreshing here
                  // would blow away every unsaved field in the editor behind
                  // this dialog.
                  { skipRefresh: true },
                );
              }}
            >
              {labels.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
