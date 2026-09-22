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
//   4. **A variable chip COPIES its token** (changes-46 #4). Inserting at a
//      caret could only ever be right for the plain controls — Tiptap owns its
//      own selection, so rich mode appended a paragraph at the end — and the
//      owner asked for the clipboard. The author pastes where the caret is, in
//      any of the three surfaces, and a toast (aria-live) says it worked.
//   5. **The body is the ONE rich-text editor**, with the Visual / HTML tabs
//      every other editor has, and its tab IS the stored body mode (Visual =
//      RICH, wrapped in the brand shell; HTML = a whole document). The
//      writing assistant rides on the same toolbar (ADR-129/138).
import * as React from "react";
import { Braces, Copy, Mail, MoreHorizontal, Send, Sparkles, Undo2, UserRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import type {
  AiAssistantConfig,
  AiAssistantLabels,
} from "../../../../_components/ai-assistant.tsx";
import { AdminPageHeading } from "../../../../_components/admin-page.tsx";
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
const PREVIEW_URL = "/keystone/api/email/preview";

export interface EmailTemplateEditorLabels {
  backToList: string;
  /** The static heading and its one line (ADR-140 §3). */
  heading: string;
  description: string;
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
  modeHtmlHint: string;
  variablesSection: string;
  variablesDescription: string;
  copyVariable: string;
  variableCopied: string;
  copyFailed: string;
  openActions: string;
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
  ai,
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
  /** The toolbar writing assistant — ABSENT when AI is off (ADR-097 #6). */
  ai?: { config: AiAssistantConfig; labels: AiAssistantLabels } | undefined;
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

  // Memoised so the `values` object below is stable between renders: the
  // fallback literal is a new object every time, and `useFieldErrors` re-runs
  // the whole schema on every change to its input.
  const draft = React.useMemo(() => drafts[locale] ?? EMPTY_DRAFT, [drafts, locale]);
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

  /** Copy a variable's token; the author pastes it wherever the caret is. */
  const copyVariable = async (name: string) => {
    const token = `{{${name}}}`;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(labels.variableCopied.replace("{token}", token));
    } catch {
      // No clipboard (an insecure origin, a denied permission): say so rather
      // than pretend, and name the token so it can be typed.
      toast.error(labels.copyFailed.replace("{token}", token));
    }
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
      {/* ADR-140 §3: the heading is static ("Edit email template"), never the
          record's subject — the subject is the first field below, and the
          actions share the title's row. */}
      {/* `sticky`: the Save stays reachable down a long body, the way
          `EditorPage` pins every content editor's row (changes-46 #4). */}
      <AdminPageHeading
        sticky
        title={labels.heading}
        description={labels.description}
        backHref="/keystone/settings/email/templates"
        backLabel={labels.backToList}
        meta={
          <>
            <span className="text-xs text-muted-foreground">{template.key}</span>
            {template.critical && <Badge variant="warning">{labels.critical}</Badge>}
            {!template.isActive && <Badge variant="secondary">{labels.inactive}</Badge>}
          </>
        }
        actions={
          <>
            {/* The content editors' order: Cancel, the informational action,
                the one primary Save, then the rarer ones behind "…". */}
            <Button variant="ghost" render={<Link href="/keystone/settings/email/templates" />}>
              {labels.cancel}
            </Button>
            {canTest && (
              <Button variant="info" onClick={() => setTestOpen(true)}>
                <Send data-icon="inline-start" aria-hidden />
                {labels.testSend}
              </Button>
            )}
            {canUpdate && (
              <>
                {/* ONE Save for the whole editor, in the header action row — the
                    shape every other multi-section editor uses. It cannot sit at
                    the end of a section (ADR-044 #8's usual placement) because the
                    three sections are one form: a Save under "Content" would look
                    like it left the sender overrides behind.
                    Enabled while fields are wrong; pressing it names them (ADR-077). */}
                <Button loading={pending} onClick={save}>
                  {labels.save}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" aria-label={labels.openActions}>
                        <MoreHorizontal aria-hidden />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    {/* Destructive: it discards this locale's edits. Confirmed
                        (ADR-044 #7). */}
                    <DropdownMenuItem variant="destructive" onClick={() => setResetOpen(true)}>
                      <Undo2 aria-hidden data-icon="inline-start" />
                      {labels.reset}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </>
        }
      />

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
          >
            <Field
              label={labels.subject}
              hint={labels.subjectHint}
              required
              error={form.error("subject")}
            >
              <Input
                value={draft.subject}
                readOnly={!canUpdate}
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
              <RichTextEditor
                value={draft.bodyHtml}
                onChange={(html) => patch({ bodyHtml: html })}
                labels={editorLabels}
                mediaCategory="brand"
                // The tab is the stored mode: Visual renders inside the brand
                // shell, HTML is the designer's whole document.
                mode={draft.mode === "HTML" ? "html" : "visual"}
                onModeChange={(next) => patch({ mode: next === "html" ? "HTML" : "RICH" })}
                {...(ai && canUpdate ? { ai } : {})}
              />
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
                  title={`${labels.copyVariable} — ${sample[name] ?? ""}`}
                  aria-label={`${labels.copyVariable}: {{${name}}}`}
                  onClick={() => void copyVariable(name)}
                >
                  <Copy data-icon="inline-start" aria-hidden />
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
