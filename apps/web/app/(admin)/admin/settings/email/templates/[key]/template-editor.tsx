"use client";

// The email template editor (Module 17, ADR-078 #5–#8).
//
// Four decisions worth keeping in view:
//
//   1. **Locale tabs hold DRAFTS, and one Save writes one locale.** The server
//      action takes a single `{key, locale, …}`, and that is deliberate: a
//      source edit flips its siblings OUTDATED, so saving several locales at
//      once would mark translations stale against a source saved in the same
//      breath. Switching tabs keeps an unsaved draft in memory and says so.
//   2. **The preview is a real navigation, not a render.** A hidden form POSTs
//      the draft at a named `sandbox=""` iframe, so the HTML lands on its own
//      opaque origin under the route's own `sandbox` CSP (ADR-078 #8). `srcDoc`
//      would put the author's markup on the admin origin.
//   3. **The HTML textarea keeps `font-mono`.** Code-style #6's exception: the
//      VALUE is code, read character by character.
//   4. **Variables insert at the caret in whichever surface has focus.** In
//      rich mode the body is Tiptap and owns its own selection, so insertion
//      there appends rather than pretending to know the caret — the subject and
//      the HTML textarea are plain controls and get real caret insertion.
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Braces, Mail, Send, Sparkles, Undo2, UserRound } from "lucide-react";
import { emailTemplateSaveSchema, type EmailBodyMode } from "@repo/contracts";
import type { EmailTemplateDetail, EmailTranslationState } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
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
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import { EditorSection, Field } from "../../../../_components/editor/editor-section.tsx";
import { RichTextEditor, type RichTextLabels } from "../../../../_components/rich-text-editor.tsx";
import { StatusBadge } from "../../../../_components/status-badge.tsx";
import { useFieldErrors } from "../../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";
import {
  resetEmailTemplateAction,
  saveEmailTemplateAction,
  sendTestEmailAction,
} from "../../../../_actions/email-actions.ts";

const PREVIEW_FRAME = "email-preview-frame";
const PREVIEW_URL = "/admin/api/email/preview";

export interface EmailTemplateEditorLabels {
  backToList: string;
  templatesTitle: string;
  critical: string;
  inactive: string;
  contentSection: string;
  contentDescription: string;
  subject: string;
  subjectHint: string;
  preheader: string;
  preheaderHint: string;
  body: string;
  mode: string;
  modeRich: string;
  modeHtml: string;
  modeHtmlHint: string;
  variablesSection: string;
  variablesDescription: string;
  insert: string;
  senderSection: string;
  senderDescription: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  inheritHint: string;
  previewSection: string;
  previewDescription: string;
  previewRefresh: string;
  previewFrame: string;
  widthDesktop: string;
  widthMobile: string;
  testSend: string;
  testSendTitle: string;
  testSendDescription: string;
  testRecipient: string;
  testLocale: string;
  send: string;
  testSent: string;
  reset: string;
  resetTitle: string;
  resetBody: string;
  save: string;
  saved: string;
  cancel: string;
  confirm: string;
  close: string;
  localeCurrent: string;
  localeOutdated: string;
  localeMissing: string;
  localeDraft: string;
}

interface Draft {
  subject: string;
  preheader: string;
  mode: EmailBodyMode;
  bodyHtml: string;
}

/** A locale with no stored row starts here — see the `drafts` comment below. */
const EMPTY_DRAFT: Draft = { subject: "", preheader: "", mode: "RICH", bodyHtml: "" };

const STATE_TONE: Record<EmailTranslationState, "success" | "warning" | "neutral" | "info"> = {
  current: "success",
  outdated: "warning",
  missing: "neutral",
  draft: "info",
};

export function EmailTemplateEditor({
  template,
  locales,
  variables,
  sample,
  canUpdate,
  canTest,
  labels,
  editorLabels,
}: {
  template: EmailTemplateDetail;
  locales: { code: string; name: string }[];
  variables: readonly string[];
  sample: Readonly<Record<string, string>>;
  canUpdate: boolean;
  canTest: boolean;
  labels: EmailTemplateEditorLabels;
  /** Built on the server, the way every other RichTextEditor host does it. */
  editorLabels: RichTextLabels;
}) {
  const { run, pending } = useServerAction();

  const firstLocale = locales[0]?.code ?? "en";
  const [locale, setLocale] = React.useState(firstLocale);

  // One draft per locale, seeded from what is stored. A locale with no row
  // starts empty rather than pre-filled with English: a copy of the source
  // saved under `ar` is an untranslated template that REPORTS as translated,
  // which is the one outcome the status badges exist to prevent.
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      locales.map((entry) => {
        const stored = template.translations.find((row) => row.locale === entry.code);
        return [
          entry.code,
          {
            subject: stored?.subject ?? "",
            preheader: stored?.preheader ?? "",
            mode: stored?.mode ?? "RICH",
            bodyHtml: stored?.bodyHtml ?? "",
          } satisfies Draft,
        ];
      }),
    ),
  );

  const [fromName, setFromName] = React.useState(template.fromName ?? "");
  const [fromEmail, setFromEmail] = React.useState(template.fromEmail ?? "");
  const [replyTo, setReplyTo] = React.useState(template.replyTo ?? "");

  const [testOpen, setTestOpen] = React.useState(false);
  const [testTo, setTestTo] = React.useState("");
  const [resetOpen, setResetOpen] = React.useState(false);
  const [previewWidth, setPreviewWidth] = React.useState<"desktop" | "mobile">("desktop");

  const previewFormRef = React.useRef<HTMLFormElement>(null);
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const lastFocused = React.useRef<"subject" | "body">("body");

  // Memoised so the `values` object below is stable between renders: the
  // fallback literal is a new object every time, and `useFieldErrors` re-runs
  // the whole schema on every change to its input.
  const draft = React.useMemo(
    () => drafts[locale] ?? EMPTY_DRAFT,
    [drafts, locale],
  );
  const patch = (changes: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [locale]: { ...draft, ...changes } }));

  const values = React.useMemo(
    () => ({
      key: template.key,
      locale,
      subject: draft.subject,
      preheader: draft.preheader || undefined,
      mode: draft.mode,
      bodyHtml: draft.bodyHtml,
      fromName: fromName.trim() || undefined,
      fromEmail: fromEmail.trim() || undefined,
      replyTo: replyTo.trim() || undefined,
    }),
    [template.key, locale, draft, fromName, fromEmail, replyTo],
  );
  const form = useFieldErrors(emailTemplateSaveSchema, values);

  const save = () => {
    if (!form.validate()) return;
    run(() => saveEmailTemplateAction(values), { successMessage: labels.saved });
  };

  // The preview submits the CURRENT draft, so it shows what is on screen
  // rather than what was last saved — the whole reason an author opens it.
  const refreshPreview = React.useCallback(() => previewFormRef.current?.requestSubmit(), []);
  React.useEffect(() => {
    refreshPreview();
    // Intentionally not on every keystroke: a preview is a navigation, and one
    // per character would be a request per character.
  }, [locale, refreshPreview]);

  /** Insert at the caret of whichever plain control was last focused. */
  const insertVariable = (name: string) => {
    const token = `{{${name}}}`;
    if (lastFocused.current === "subject") {
      const element = subjectRef.current;
      const at = element?.selectionStart ?? draft.subject.length;
      patch({ subject: draft.subject.slice(0, at) + token + draft.subject.slice(at) });
      return;
    }
    if (draft.mode === "HTML") {
      const element = bodyRef.current;
      const at = element?.selectionStart ?? draft.bodyHtml.length;
      patch({ bodyHtml: draft.bodyHtml.slice(0, at) + token + draft.bodyHtml.slice(at) });
      return;
    }
    // Rich mode: Tiptap owns the selection, so this appends a paragraph rather
    // than guessing a caret position it cannot see.
    patch({ bodyHtml: `${draft.bodyHtml}<p>${token}</p>` });
  };

  const localeState = (code: string): EmailTranslationState =>
    template.translations.find((row) => row.locale === code)?.state ?? "missing";
  const stateLabel: Record<EmailTranslationState, string> = {
    current: labels.localeCurrent,
    outdated: labels.localeOutdated,
    missing: labels.localeMissing,
    draft: labels.localeDraft,
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2 self-start"
            render={
              <Link href="/admin/settings/email/templates">
                <ArrowLeft aria-hidden className="rtl:rotate-180" />
                {labels.backToList}
              </Link>
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{draft.subject || template.key}</h1>
            {template.critical && <Badge variant="warning">{labels.critical}</Badge>}
            {!template.isActive && <Badge variant="secondary">{labels.inactive}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{template.key}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canTest && (
            <Button variant="outline" onClick={() => setTestOpen(true)}>
              <Send aria-hidden />
              {labels.testSend}
            </Button>
          )}
          {canUpdate && (
            <>
              <Button
                variant="outline"
                className="text-destructive-interactive"
                onClick={() => setResetOpen(true)}
              >
                <Undo2 aria-hidden />
                {labels.reset}
              </Button>
              {/* ONE Save for the whole editor, in the header action row — the
                  shape every other multi-section editor uses. It cannot sit at
                  the end of a section (ADR-044 #8's usual placement) because the
                  three sections are one form: a Save under "Content" would look
                  like it left the sender overrides behind.
                  Enabled while fields are wrong; pressing it names them (ADR-077). */}
              <Button loading={pending} onClick={save}>
                {labels.save}
              </Button>
            </>
          )}
        </div>
      </div>

      {locales.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {locales.map((entry) => (
            <Button
              key={entry.code}
              size="sm"
              variant={entry.code === locale ? "default" : "outline"}
              onClick={() => setLocale(entry.code)}
            >
              {entry.name}
              <StatusBadge tone={STATE_TONE[localeState(entry.code)]}>
                {stateLabel[localeState(entry.code)]}
              </StatusBadge>
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={labels.contentSection}
            description={labels.contentDescription}
            icon={Mail}
            accent="primary"
            actions={
              <AdminCombobox
                aria-label={labels.mode}
                className="w-40"
                value={draft.mode}
                onValueChange={(value) => patch({ mode: value as EmailBodyMode })}
                options={[
                  { value: "RICH", label: labels.modeRich },
                  { value: "HTML", label: labels.modeHtml },
                ]}
              />
            }
          >
            <Field
              label={labels.subject}
              hint={labels.subjectHint}
              required
              error={form.error("subject")}
            >
              <Input
                ref={subjectRef}
                value={draft.subject}
                readOnly={!canUpdate}
                onFocus={() => (lastFocused.current = "subject")}
                onChange={(event) => patch({ subject: event.target.value })}
              />
            </Field>

            <Field
              label={labels.preheader}
              hint={labels.preheaderHint}
              error={form.error("preheader")}
            >
              <Input
                value={draft.preheader}
                readOnly={!canUpdate}
                onChange={(event) => patch({ preheader: event.target.value })}
              />
            </Field>

            <Field
              label={labels.body}
              required
              hint={draft.mode === "HTML" ? labels.modeHtmlHint : undefined}
              error={form.error("bodyHtml")}
            >
              {draft.mode === "HTML" ? (
                <Textarea
                  ref={bodyRef}
                  // code-style #6's exception: the VALUE is code.
                  className="min-h-96 font-mono text-xs"
                  spellCheck={false}
                  value={draft.bodyHtml}
                  readOnly={!canUpdate}
                  onFocus={() => (lastFocused.current = "body")}
                  onChange={(event) => patch({ bodyHtml: event.target.value })}
                />
              ) : (
                <RichTextEditor
                  value={draft.bodyHtml}
                  onChange={(html) => patch({ bodyHtml: html })}
                  labels={editorLabels}
                  mediaCategory="brand"
                />
              )}
            </Field>
          </EditorSection>

          <EditorSection
            title={labels.variablesSection}
            description={labels.variablesDescription}
            icon={Braces}
            accent="info"
          >
            <div className="flex flex-wrap gap-1.5">
              {variables.map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!canUpdate}
                  title={`${labels.insert} — ${sample[name] ?? ""}`}
                  onClick={() => insertVariable(name)}
                >
                  {/* A variable name IS its literal text — it is typed into the
                      body verbatim — so `font-mono` is the same exception the
                      HTML textarea takes, not a raw identifier rendering. */}
                  <span className="font-mono text-3xs">{`{{${name}}}`}</span>
                </Button>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            title={labels.senderSection}
            description={labels.senderDescription}
            icon={UserRound}
            accent="neutral"
          >
            <Field label={labels.fromName} hint={labels.inheritHint} error={form.error("fromName")}>
              <Input
                value={fromName}
                readOnly={!canUpdate}
                onChange={(event) => setFromName(event.target.value)}
              />
            </Field>
            <Field label={labels.fromEmail} error={form.error("fromEmail")}>
              <Input
                type="email"
                value={fromEmail}
                readOnly={!canUpdate}
                onChange={(event) => setFromEmail(event.target.value)}
              />
            </Field>
            <Field label={labels.replyTo} error={form.error("replyTo")}>
              <Input
                type="email"
                value={replyTo}
                readOnly={!canUpdate}
                onChange={(event) => setReplyTo(event.target.value)}
              />
            </Field>
          </EditorSection>
        </div>

        <EditorSection
          title={labels.previewSection}
          description={labels.previewDescription}
          icon={Sparkles}
          accent="success"
          bodyClassName="gap-2"
          actions={
            <div className="flex items-center gap-2">
              <AdminCombobox
                aria-label={labels.previewSection}
                className="w-32"
                value={previewWidth}
                onValueChange={(value) => setPreviewWidth(value as "desktop" | "mobile")}
                options={[
                  { value: "desktop", label: labels.widthDesktop },
                  { value: "mobile", label: labels.widthMobile },
                ]}
              />
              <Button type="button" size="sm" variant="outline" onClick={refreshPreview}>
                {labels.previewRefresh}
              </Button>
            </div>
          }
        >
          {/* The form is the mechanism: it POSTs at the named frame, so the
              response becomes the frame's document on its own origin. Not
              `fetch` + blob URL, which would put the author's markup back on
              the admin origin (ADR-078 #8). */}
          <form
            ref={previewFormRef}
            action={PREVIEW_URL}
            method="post"
            target={PREVIEW_FRAME}
            className="hidden"
          >
            <input type="hidden" name="key" value={template.key} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="subject" value={draft.subject} />
            <input type="hidden" name="preheader" value={draft.preheader} />
            <input type="hidden" name="mode" value={draft.mode} />
            <input type="hidden" name="bodyHtml" value={draft.bodyHtml} />
          </form>
          <div className="flex justify-center overflow-x-auto rounded-md border bg-muted/40 p-3">
            <iframe
              name={PREVIEW_FRAME}
              title={labels.previewFrame}
              // Empty `sandbox` is the strictest value there is: no script, no
              // forms, no same-origin access. The route asserts the same thing
              // in its own CSP, so neither end is load-bearing alone.
              sandbox=""
              className={
                previewWidth === "mobile"
                  ? "h-160 w-94 shrink-0 rounded-sm border bg-background"
                  : "h-160 w-150 shrink-0 rounded-sm border bg-background"
              }
            />
          </div>
        </EditorSection>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.testSendTitle}</DialogTitle>
            <DialogDescription>{labels.testSendDescription}</DialogDescription>
          </DialogHeader>
          <Field label={labels.testRecipient} required>
            <Input
              type="email"
              value={testTo}
              onChange={(event) => setTestTo(event.target.value)}
              autoComplete="email"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              {labels.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(() => sendTestEmailAction({ key: template.key, locale, to: testTo }), {
                  successMessage: labels.testSent,
                  onDone: () => setTestOpen(false),
                })
              }
            >
              {labels.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={labels.resetTitle}
        description={labels.resetBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => resetEmailTemplateAction({ key: template.key, locale }))}
      />
    </div>
  );
}
