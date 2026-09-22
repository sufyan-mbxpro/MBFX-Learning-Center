"use client";

// The tool editor (changes-25 T5, ADR-086).
//
// Modelled on the glossary term editor (ADR-069), with one structural
// difference: **there is no `ContentStatusPanel`.** A tool has no status, no
// `scheduledFor` and no seven-state machine (ADR-086 #8) — it is a fixture of
// the site, on or off. ADR-071 gave `scheduledFor` to the five entities a
// reader browses as a feed, where "publish this on Tuesday" is a real
// editorial act; scheduling a calculator solves nothing and would add a fourth
// switch to a surface that already has three (the feature flag, `isEnabled`,
// and the translation's own status).
//
// One save for the whole screen: `saveTool` writes the tool row, one
// translation and the mixed relation set in ONE transaction, so a tool whose
// copy saved and whose related list did not is a state that cannot be reached.
import { useState } from "react";
import {
  BookOpen,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Search,
  Settings2,
  Wrench,
} from "lucide-react";
import {
  saveToolSchema,
  type ToolFaqEntry,
  type ToolHighlight,
  type ToolKey,
  toolPath,
} from "@repo/contracts";
import { htmlToBlockText } from "@repo/utils";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Field as FieldRoot,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { saveToolAction, setToolEnabledAction } from "../../_actions/tool-actions.ts";
import {
  AiFieldMenu,
  AiFillButton,
  type AiFaqValue,
  type AiFillPatch,
} from "../../_components/ai-fill.tsx";
import { AiSeoButton } from "../../_components/ai-seo-dialog.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { SeoAnalysis } from "../../_components/editor/seo-analysis.tsx";
import type { EditorAi } from "../../_lib/editor-ai.ts";
import { FaqPanel, type FaqLabels } from "../../_components/editor/faq-panel.tsx";
import { ImageUploadField } from "../../_components/image-upload-field.tsx";
import { RichTextEditor, type RichTextLabels } from "../../_components/rich-text-editor.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import {
  ConfigPanel,
  type ConfigPanelLabels,
  type InstrumentOption,
} from "./_panels/config-panel.tsx";
import { HighlightsPanel, type HighlightsLabels } from "./_panels/highlights-panel.tsx";
import {
  RelatedPanel,
  type RelatedOption,
  type RelatedPanelLabels,
} from "./_panels/related-panel.tsx";
import { HeaderActions } from "../../_components/header-actions.tsx";

export interface ToolEditorLabels extends ConfigPanelLabels, RelatedPanelLabels {
  contentSection: string;
  contentDescription: string;
  configSection: string;
  configDescription: string;
  relatedSection: string;
  relatedDescription: string;
  mediaSection: string;
  mediaDescription: string;
  seoSection: string;
  seoDescription: string;
  settingsSection: string;
  settingsDescription: string;
  titleField: string;
  taglineField: string;
  taglineHint: string;
  introField: string;
  introHint: string;
  bodyField: string;
  bodyHint: string;
  coverField: string;
  seoTitleField: string;
  seoDescriptionField: string;
  seoKeywordField: string;
  enabledField: string;
  enabledHint: string;
  showRelatedField: string;
  relatedCountField: string;
  relatedCountHint: string;
  save: string;
  saved: string;
  viewLive: string;
  enabledBadge: string;
  disabledBadge: string;
  faq: FaqLabels;
  highlights: HighlightsLabels;
  editor: RichTextLabels;
  upload: { upload: string; replace: string; remove: string; uploading: string; hint: string };
}

export interface ToolEditorData {
  key: ToolKey;
  isEnabled: boolean;
  sortOrder: number;
  coverAssetId: string | null;
  coverUrl: string | null;
  config: Record<string, unknown>;
  relatedCount: number;
  showRelated: boolean;
  locale: string;
  title: string;
  tagline: string;
  intro: string;
  body: string;
  faq: ToolFaqEntry[];
  highlights: ToolHighlight[];
  seoTitle: string;
  seoDescription: string;
  seoFocusKeyword: string;
  related: { targetType: string; targetId: string }[];
}

export function ToolEditor({
  tool,
  instruments,
  relatedOptions,
  canPublish,
  siteUrl,
  labels,
  ai,
}: {
  tool: ToolEditorData;
  instruments: InstrumentOption[];
  relatedOptions: RelatedOption[];
  canPublish: boolean;
  /** The public origin "View Live" opens, as the other editors receive it. */
  siteUrl: string;
  labels: ToolEditorLabels;
  /** ADR-126. Absent when AI is off, every feature is off, or this person cannot spend. */
  ai?: EditorAi;
}) {
  const { run, pending } = useServerAction();

  const [isEnabled, setIsEnabled] = useState(tool.isEnabled);
  const [config, setConfig] = useState<Record<string, unknown>>(tool.config);
  const [relatedCount, setRelatedCount] = useState(String(tool.relatedCount));
  const [showRelated, setShowRelated] = useState(tool.showRelated);
  const [coverAssetId, setCoverAssetId] = useState(tool.coverAssetId);
  const [coverUrl, setCoverUrl] = useState(tool.coverUrl);

  const [title, setTitle] = useState(tool.title);
  const [tagline, setTagline] = useState(tool.tagline);
  const [intro, setIntro] = useState(tool.intro);
  const [body, setBody] = useState(tool.body);
  const [faq, setFaq] = useState<ToolFaqEntry[]>(tool.faq);
  const [highlights, setHighlights] = useState<ToolHighlight[]>(tool.highlights);
  const [seoTitle, setSeoTitle] = useState(tool.seoTitle);
  const [seoDescription, setSeoDescription] = useState(tool.seoDescription);
  const [seoFocusKeyword, setSeoFocusKeyword] = useState(tool.seoFocusKeyword);
  const [related, setRelated] = useState(tool.related);

  // ADR-126: the fillable fields as plain text — the review's "current" column,
  // the empty test behind each default tick, and the prompt's context.
  const aiFill = ai?.fill;
  const aiSeo = ai?.seo;
  const aiCurrent = {
    title,
    tagline,
    intro: htmlToBlockText(intro),
    body: htmlToBlockText(body),
    faq: faq.map((item) => `${item.question}\n${item.answer}`).join("\n\n"),
    seoTitle,
    seoDescription,
    seoFocusKeyword,
  };
  // Each field is its own state here, so one setter per field cannot race the
  // way a single merged draft object would (ADR-126 §4).
  const textSetters = {
    title: setTitle,
    tagline: setTagline,
    intro: setIntro,
    body: setBody,
    seoTitle: setSeoTitle,
    seoDescription: setSeoDescription,
    seoFocusKeyword: setSeoFocusKeyword,
  };
  const applyFill = (patch: AiFillPatch) => {
    for (const [key, set] of Object.entries(textSetters)) {
      const value = patch[key];
      if (typeof value === "string") set(value);
    }
    if (Array.isArray(patch.faq)) {
      setFaq((patch.faq as AiFaqValue[]).map(({ question, answer }) => ({ question, answer })));
    }
  };
  const fieldMenu = (field: keyof typeof textSetters) =>
    aiFill ? (
      <AiFieldMenu
        config={aiFill}
        field={field}
        locale={tool.locale}
        current={aiCurrent}
        onApply={textSetters[field]}
      />
    ) : undefined;
  const assistant = ai?.assistant
    ? { ai: { ...ai.assistant, config: { ...ai.assistant.config, locale: tool.locale } } }
    : {};

  const values = {
    key: tool.key,
    isEnabled,
    sortOrder: tool.sortOrder,
    coverAssetId,
    relatedCount: Number(relatedCount),
    showRelated,
    config,
    translation: {
      locale: tool.locale,
      title,
      tagline: tagline || null,
      intro: intro || null,
      body: body || null,
      faq,
      highlights,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoFocusKeyword: seoFocusKeyword || null,
    },
    related,
  };

  const form = useFieldErrors(saveToolSchema, values);

  const save = () => {
    if (!form.validate()) return;
    run(() => saveToolAction(values), { successMessage: labels.saved });
  };

  // changes-44 #3: the record's state and language travel with the content,
  // not on a row of their own above it.
  const stateCluster = (
    <>
      <Badge variant={isEnabled ? "success" : "outline"}>
        {isEnabled ? labels.enabledBadge : labels.disabledBadge}
      </Badge>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ADR-140 §3: the actions sit on the page heading's row. A tool has no
          status machine (ADR-086 #8), so `stateCluster`'s badge is its one
          switch — live or off — and it rides in the content card's header. */}
      <HeaderActions>
        {/* Only while live: an off tool 404s, and a button that opens a 404
            reads as a broken editor. */}
        {isEnabled && (
          <Button
            variant="outline"
            render={
              <a
                href={`${siteUrl}${toolPath(tool.key)}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink data-icon="inline-start" aria-hidden />
            {labels.viewLive}
          </Button>
        )}
        {/* Never disabled for validation (ADR-077): pressing it names the
            invalid fields. */}
        <Button loading={pending} onClick={save}>
          {labels.save}
        </Button>
      </HeaderActions>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-(--grid-2-1)">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.contentSection}
            actions={
              <>
                {stateCluster}
                {aiFill ? (
                  <AiFillButton
                    withOptions
                    config={aiFill}
                    locale={tool.locale}
                    current={aiCurrent}
                    fieldLabels={{
                      title: labels.titleField,
                      tagline: labels.taglineField,
                      intro: labels.introField,
                      body: labels.bodyField,
                      faq: labels.faq.section,
                      seoTitle: labels.seoTitleField,
                      seoDescription: labels.seoDescriptionField,
                      seoFocusKeyword: labels.seoKeywordField,
                    }}
                    onApply={applyFill}
                  />
                ) : null}
              </>
            }
            description={labels.contentDescription}
            icon={BookOpen}
          >
            <Field
              label={labels.titleField}
              required
              error={form.error("translation.title")}
              adornment={fieldMenu("title")}
            >
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field
              label={labels.taglineField}
              hint={labels.taglineHint}
              adornment={fieldMenu("tagline")}
            >
              <Textarea
                rows={2}
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
              />
            </Field>
            <Field label={labels.introField} hint={labels.introHint}>
              <RichTextEditor
                value={intro}
                onChange={setIntro}
                labels={labels.editor}
                {...assistant}
              />
            </Field>
            <Field label={labels.bodyField} hint={labels.bodyHint}>
              <RichTextEditor
                value={body}
                onChange={setBody}
                labels={labels.editor}
                mediaCategory="brand"
                {...assistant}
              />
            </Field>
          </EditorSection>

          <FaqPanel
            items={faq}
            onChange={setFaq}
            makeItem={(fields) => ({ question: fields.question, answer: fields.answer })}
            labels={labels.faq}
          />

          {/* The "why use this" band (ADR-114 #3). Beside the FAQ because they
            are the same kind of thing — prose about the tool rather than
            configuration of it — and above the config panel for the same
            reason the public page puts the calculator first: what the tool
            SAYS is edited far more often than what it reads. */}
          <HighlightsPanel items={highlights} onChange={setHighlights} labels={labels.highlights} />

          {/* The owner's "maximum control" lives here: every default, limit and
            instrument list a tool reads. What it cannot change is what the
            tool COMPUTES (ADR-086 #1). */}
          <EditorSection
            title={labels.configSection}
            description={labels.configDescription}
            icon={Settings2}
            accent="info"
          >
            <ConfigPanel
              toolKey={tool.key}
              config={config}
              onChange={setConfig}
              instruments={instruments}
              labels={labels}
            />
          </EditorSection>

          <EditorSection
            title={labels.relatedSection}
            description={labels.relatedDescription}
            icon={Link2}
          >
            <RelatedPanel
              value={related}
              onChange={setRelated}
              options={relatedOptions}
              labels={labels}
            />
          </EditorSection>

          <EditorSection
            title={labels.seoSection}
            description={labels.seoDescription}
            icon={Search}
            actions={
              // The article editor's review dialog, in the same place: the section
              // header, because it fills the whole section. Absent when SEO AI is off.
              aiSeo ? (
                <AiSeoButton
                  labels={aiSeo.labels}
                  entity={{ type: "tool", id: tool.key }}
                  keywords="single"
                  current={{ seoTitle, seoDescription, focusKeywords: seoFocusKeyword }}
                  source={{
                    title,
                    content: htmlToBlockText(`${intro}\n${body}`),
                    ...(tagline ? { excerpt: tagline } : {}),
                    locale: tool.locale,
                  }}
                  onApply={(patch) => {
                    if (patch.seoTitle !== undefined) setSeoTitle(patch.seoTitle);
                    if (patch.seoDescription !== undefined) setSeoDescription(patch.seoDescription);
                    if (patch.focusKeywords !== undefined) setSeoFocusKeyword(patch.focusKeywords);
                  }}
                />
              ) : undefined
            }
          >
            <Field label={labels.seoTitleField} adornment={fieldMenu("seoTitle")}>
              <Input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </Field>
            <Field label={labels.seoDescriptionField} adornment={fieldMenu("seoDescription")}>
              <Textarea
                rows={2}
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
              />
            </Field>
            <Field label={labels.seoKeywordField} adornment={fieldMenu("seoFocusKeyword")}>
              <Input
                value={seoFocusKeyword}
                onChange={(event) => setSeoFocusKeyword(event.target.value)}
              />
            </Field>
            <SeoAnalysis
              title={seoTitle || title}
              description={seoDescription || tagline}
              body={`${intro}${body}`}
              focusKeywords={seoFocusKeyword}
            />
          </EditorSection>
        </div>

        {/* The rail: the on/off switch (there is no status machine to render,
          ADR-086 #8), then the artwork — where every other editor keeps its
          cover. */}
        <aside className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.settingsSection}
            description={labels.settingsDescription}
            icon={Wrench}
          >
            {/* Switch ROWS, so @repo/ui's horizontal Field rather than the
              section's label-above-control wrapper (ADR-089).

              These were the wrapper's vertical Field, whose `*:w-full` is what
              makes an Input fill the column — and it reached the Switch too, so
              a 44px control was drawn as a 288px bar across the rail. Both
              halves of that are fixed: `fieldVariants` no longer stretches a
              switch, and a switch belongs on a row with its label anyway. */}
            <FieldRoot orientation="horizontal">
              <Switch
                checked={isEnabled}
                disabled={!canPublish}
                onCheckedChange={(next) => {
                  setIsEnabled(next);
                  // The switch commits immediately and on its OWN key
                  // (`tools.publish`), rather than riding along with the copy
                  // save — an editor holding only `tools.update` can write every
                  // word here and still not decide what the site offers.
                  run(() => setToolEnabledAction(tool.key, next));
                }}
              />
              <FieldContent>
                <FieldLabel>{labels.enabledField}</FieldLabel>
                <FieldDescription>{labels.enabledHint}</FieldDescription>
              </FieldContent>
            </FieldRoot>
            <FieldRoot orientation="horizontal">
              <Switch checked={showRelated} onCheckedChange={setShowRelated} />
              <FieldLabel>{labels.showRelatedField}</FieldLabel>
            </FieldRoot>
            <Field
              label={labels.relatedCountField}
              hint={labels.relatedCountHint}
              error={form.error("relatedCount")}
            >
              <Input
                type="number"
                min={0}
                max={24}
                value={relatedCount}
                onChange={(event) => setRelatedCount(event.target.value)}
              />
            </Field>
          </EditorSection>

          <EditorSection
            title={labels.mediaSection}
            description={labels.mediaDescription}
            icon={ImageIcon}
          >
            <ImageUploadField
              label={labels.coverField}
              value={coverUrl}
              purpose="brand"
              // ADR-066 §4: the category is REQUIRED and decides which shelf an
              // upload lands on. A tool cover is brand artwork, not learning
              // material and not news.
              category="brand"
              error={form.error("coverAssetId")}
              onChange={(next) => {
                setCoverUrl(next?.url ?? null);
                setCoverAssetId(next?.id ?? null);
              }}
              labels={labels.upload}
            />
          </EditorSection>
        </aside>
      </div>
    </div>
  );
}
