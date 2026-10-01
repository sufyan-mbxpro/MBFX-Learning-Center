"use client";

// The email design editor (ADR-172 #3, changes-55 §5.2).
//
// Built from the template editor's parts on purpose — the same rich-text
// editor with its Visual / HTML tabs (the tab IS the stored mode), the same
// copy-a-placeholder chips, and the same isolated preview route reached by a
// real form POST at a sandboxed frame (ADR-078 #8). A second editor or a
// second preview path would be a second set of rules to keep right.
//
// A design is a STARTING POINT: saving it changes no email already made from
// it, and the header says so.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Braces, Copy, FileText, Mail, Sparkles } from "lucide-react";
import { CUSTOM_EMAIL_VARIABLES, emailDesignSaveSchema, type EmailBodyMode } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { saveEmailDesignAction } from "../../../../_actions/custom-email-actions.ts";
import { AdminPageHeading } from "../../../../_components/admin-page.tsx";
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import { EditorSection, Field } from "../../../../_components/editor/editor-section.tsx";
import { RichTextEditor, type RichTextLabels } from "../../../../_components/rich-text-editor.tsx";
import { useFieldErrors } from "../../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";
import { unknownVariables } from "../../../../announcements/_lib/variables.ts";

const PREVIEW_FRAME = "design-preview-frame";
const PREVIEW_URL = "/keystone/api/email/preview";
const BACK = "/keystone/settings/email/templates";

export interface DesignEditorProps {
  initial: {
    id: string | null;
    name: string;
    description: string;
    mode: EmailBodyMode;
    subject: string;
    preheader: string;
    bodyHtml: string;
  };
  canUpdate: boolean;
  editorLabels: RichTextLabels;
}

export function DesignEditor({ initial, canUpdate, editorLabels }: DesignEditorProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { run, pending } = useServerAction();

  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description);
  const [mode, setMode] = React.useState<EmailBodyMode>(initial.mode);
  const [subject, setSubject] = React.useState(initial.subject);
  const [preheader, setPreheader] = React.useState(initial.preheader);
  const [bodyHtml, setBodyHtml] = React.useState(initial.bodyHtml);
  const [previewWidth, setPreviewWidth] = React.useState<"desktop" | "mobile">("desktop");
  const previewFormRef = React.useRef<HTMLFormElement>(null);

  const values = React.useMemo(
    () => ({
      ...(initial.id ? { id: initial.id } : {}),
      name,
      description: description || undefined,
      mode,
      subject: subject || undefined,
      preheader: preheader || undefined,
      bodyHtml,
    }),
    [initial.id, name, description, mode, subject, preheader, bodyHtml],
  );
  const form = useFieldErrors(emailDesignSaveSchema, values);
  const unknown = unknownVariables(`${subject} ${preheader} ${bodyHtml}`);
  const needsUnsubscribe = mode === "HTML" && !bodyHtml.includes("{{unsubscribe.url}}");

  const refreshPreview = React.useCallback(() => previewFormRef.current?.requestSubmit(), []);
  React.useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  function save() {
    if (!form.validate()) return;
    run(
      async () => {
        const result = await saveEmailDesignAction(values);
        if (!result.ok) throw new Error(t(`announcements.direct.refusals.${result.reason}`));
        form.reset();
        if (!initial.id) router.replace(`/keystone/settings/email/designs/${result.id}`);
        refreshPreview();
      },
      { successMessage: t("email.designs.saved") },
    );
  }

  async function copyVariable(variable: string) {
    const token = `{{${variable}}}`;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(t("email.variableCopied", { token }));
    } catch {
      toast.error(t("email.copyFailed", { token }));
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AdminPageHeading
        sticky
        title={initial.id ? t("email.designs.editHeading") : t("email.designs.newHeading")}
        description={t("email.designs.editorDescription")}
        backHref={BACK}
        backLabel={t("email.backToTemplates")}
        actions={
          <>
            <Button variant="ghost" render={<Link href={BACK} />}>
              {t("cancel")}
            </Button>
            {canUpdate && (
              <Button loading={pending} onClick={save}>
                {t("save")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={t("email.designs.detailsSection")}
            description={t("email.designs.detailsDescription")}
            icon={FileText}
            accent="neutral"
          >
            <Field label={t("email.designs.fieldName")} required error={form.error("name")}>
              <Input
                value={name}
                maxLength={120}
                readOnly={!canUpdate}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field
              label={t("email.designs.fieldDescription")}
              hint={t("email.designs.fieldDescriptionHint")}
              error={form.error("description")}
            >
              <Input
                value={description}
                maxLength={300}
                readOnly={!canUpdate}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </EditorSection>

          <EditorSection
            title={t("email.contentSection")}
            description={t("email.contentDescription")}
            icon={Mail}
            accent="primary"
          >
            <Field
              label={t("email.designs.fieldSubject")}
              hint={t("email.designs.fieldSubjectHint")}
              error={form.error("subject")}
            >
              <Input
                value={subject}
                maxLength={200}
                readOnly={!canUpdate}
                onChange={(event) => setSubject(event.target.value)}
              />
            </Field>
            <Field
              label={t("email.preheader")}
              hint={t("email.preheaderHint")}
              error={form.error("preheader")}
            >
              <Input
                value={preheader}
                maxLength={200}
                readOnly={!canUpdate}
                onChange={(event) => setPreheader(event.target.value)}
              />
            </Field>
            <Field
              label={t("email.body")}
              required
              hint={mode === "HTML" ? t("announcements.custom.htmlHint") : undefined}
              error={
                unknown[0]
                  ? t("announcements.custom.unknownVariable", { variable: unknown[0] })
                  : needsUnsubscribe
                    ? t("announcements.custom.needsUnsubscribe", {
                        token: "{{unsubscribe.url}}",
                      })
                    : form.error("bodyHtml")
              }
            >
              <RichTextEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                labels={editorLabels}
                mediaCategory="email"
                mode={mode === "HTML" ? "html" : "visual"}
                onModeChange={(next) => setMode(next === "html" ? "HTML" : "RICH")}
              />
            </Field>
          </EditorSection>

          <EditorSection
            title={t("announcements.custom.variablesTitle")}
            description={t("announcements.custom.variablesDescription")}
            icon={Braces}
            accent="info"
          >
            <VariableChips onCopy={(variable) => void copyVariable(variable)} />
          </EditorSection>
        </div>

        <EditorSection
          title={t("email.previewSection")}
          description={t("email.previewDescription")}
          icon={Sparkles}
          accent="success"
          bodyClassName="gap-2"
          actions={
            <div className="flex items-center gap-2">
              <AdminCombobox
                aria-label={t("email.previewSection")}
                className="w-32"
                value={previewWidth}
                onValueChange={(value) => setPreviewWidth(value as "desktop" | "mobile")}
                options={[
                  { value: "desktop", label: t("email.widthDesktop") },
                  { value: "mobile", label: t("email.widthMobile") },
                ]}
              />
              <Button type="button" size="sm" variant="outline" onClick={refreshPreview}>
                {t("email.previewRefresh")}
              </Button>
            </div>
          }
        >
          {/* A real form POST at a named sandboxed frame: the rendered message
              lands on its own opaque origin (ADR-078 #8). */}
          <form
            ref={previewFormRef}
            action={PREVIEW_URL}
            method="post"
            target={PREVIEW_FRAME}
            className="hidden"
          >
            <input type="hidden" name="preview" value="design" />
            <input type="hidden" name="name" value={name || "—"} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="preheader" value={preheader} />
            <input type="hidden" name="bodyHtml" value={bodyHtml} />
          </form>
          <div className="flex justify-center overflow-x-auto rounded-md border bg-muted/40 p-3">
            <iframe
              name={PREVIEW_FRAME}
              title={t("email.previewFrame")}
              sandbox=""
              className={
                previewWidth === "mobile"
                  ? "h-160 w-94 shrink-0 rounded-sm border bg-background"
                  : "h-160 w-full rounded-sm border bg-background"
              }
            />
          </div>
        </EditorSection>
      </div>
    </div>
  );
}

/** The placeholders a custom email can use, each a copy button (changes-46 #4). */
export function VariableChips({ onCopy }: { onCopy: (variable: string) => void }) {
  const t = useTranslations("admin");
  return (
    <div className="flex flex-wrap gap-1.5">
      {CUSTOM_EMAIL_VARIABLES.map((variable) => (
        <Button
          key={variable}
          type="button"
          size="xs"
          variant="outline"
          aria-label={`${t("email.copyVariable")}: {{${variable}}}`}
          onClick={() => onCopy(variable)}
        >
          <Copy data-icon="inline-start" aria-hidden />
          {/* A placeholder IS its literal text, typed into the body verbatim —
              the same `font-mono` exception the template editor takes. */}
          <span className="font-mono text-3xs">{`{{${variable}}}`}</span>
        </Button>
      ))}
    </div>
  );
}
