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
  Image as ImageIcon,
  Link2,
  Search,
  Settings2,
  Wrench,
} from "lucide-react";
import { saveToolSchema, type ToolFaqEntry, type ToolKey } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { saveToolAction, setToolEnabledAction } from "../../_actions/tool-actions.ts";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { FaqPanel, type FaqLabels } from "../../_components/editor/faq-panel.tsx";
import { ImageUploadField } from "../../_components/image-upload-field.tsx";
import {
  RichTextEditor,
  type RichTextLabels,
} from "../../_components/rich-text-editor.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import { ConfigPanel, type ConfigPanelLabels, type InstrumentOption } from "./_panels/config-panel.tsx";
import { RelatedPanel, type RelatedOption, type RelatedPanelLabels } from "./_panels/related-panel.tsx";

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
  faq: FaqLabels;
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
  labels,
}: {
  tool: ToolEditorData;
  instruments: InstrumentOption[];
  relatedOptions: RelatedOption[];
  canPublish: boolean;
  labels: ToolEditorLabels;
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
  const [seoTitle, setSeoTitle] = useState(tool.seoTitle);
  const [seoDescription, setSeoDescription] = useState(tool.seoDescription);
  const [seoFocusKeyword, setSeoFocusKeyword] = useState(tool.seoFocusKeyword);
  const [related, setRelated] = useState(tool.related);

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-(--grid-main-aside)">
      <div className="flex min-w-0 flex-col gap-6">
        <EditorSection
          title={labels.contentSection}
          description={labels.contentDescription}
          icon={BookOpen}
        >
          <Field label={labels.titleField} required error={form.error("translation.title")}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label={labels.taglineField} hint={labels.taglineHint}>
            <Textarea
              rows={2}
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
            />
          </Field>
          <Field label={labels.introField} hint={labels.introHint}>
            <RichTextEditor value={intro} onChange={setIntro} labels={labels.editor} />
          </Field>
          <Field label={labels.bodyField} hint={labels.bodyHint}>
            <RichTextEditor
              value={body}
              onChange={setBody}
              labels={labels.editor}
              mediaCategory="brand"
            />
          </Field>
        </EditorSection>

        <FaqPanel
          items={faq}
          onChange={setFaq}
          makeItem={(fields) => ({ question: fields.question, answer: fields.answer })}
          labels={labels.faq}
        />

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

        <EditorSection title={labels.seoSection} description={labels.seoDescription} icon={Search}>
          <Field label={labels.seoTitleField}>
            <Input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
          </Field>
          <Field label={labels.seoDescriptionField}>
            <Textarea
              rows={2}
              value={seoDescription}
              onChange={(event) => setSeoDescription(event.target.value)}
            />
          </Field>
          <Field label={labels.seoKeywordField}>
            <Input
              value={seoFocusKeyword}
              onChange={(event) => setSeoFocusKeyword(event.target.value)}
            />
          </Field>
        </EditorSection>
      </div>

      {/* The rail carries the on/off switch and nothing else — there is no
          status machine to render (ADR-086 #8). */}
      <aside className="flex flex-col gap-6">
        <EditorSection
          title={labels.settingsSection}
          description={labels.settingsDescription}
          icon={Wrench}
        >
          <Field label={labels.enabledField} hint={labels.enabledHint}>
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
          </Field>
          <Field label={labels.showRelatedField}>
            <Switch checked={showRelated} onCheckedChange={setShowRelated} />
          </Field>
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

        {/* Save at the inline END of the rail (ADR-044 #8), and never disabled
            for validation (ADR-077): pressing it names the invalid fields. */}
        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {labels.save}
          </Button>
        </div>
      </aside>
    </div>
  );
}
