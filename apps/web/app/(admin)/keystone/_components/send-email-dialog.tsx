"use client";

// "Send email" — one email to one person (ADR-172 #6, #7; changes-55 §7).
//
// One component on four screens: the users list, a user's record, the
// subscribers list and a subscriber's record. It asks the server who the
// person is and whether they may be emailed BEFORE showing a form, because
// the answer changes the form: a deleted account or an unsubscribed
// subscriber is refused outright, and an account holder who unsubscribed from
// campaign emails gets a warning, not a refusal (owner, E4).
//
// Nothing is sent from here. The action writes one campaign with one
// recipient, and the queue sends it in the background like any other.
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail, TriangleAlert } from "lucide-react";
import { directEmailSchema, type EmailBodyMode } from "@repo/contracts";
import type { DirectRecipientView } from "@repo/core";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  FieldContent,
  FieldDescription,
  FieldLabel,
  Field as UiField,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { Switch } from "@repo/ui/components/switch";
import {
  directRecipientAction,
  listDesignOptionsAction,
  sendDirectEmailAction,
  type DesignOption,
} from "../_actions/custom-email-actions.ts";
import { unknownVariables } from "../announcements/_lib/variables.ts";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { AdminCombobox } from "./combobox.tsx";
import { Field } from "./editor/editor-section.tsx";
import { RichTextEditor, type RichTextLabels } from "./rich-text-editor.tsx";

const PREVIEW_URL = "/keystone/api/email/preview";
const BLANK = "__blank__";
/** The design every install is seeded with (ADR-172 #3): the dialog's default. */
const DEFAULT_DESIGN_ID = "design_plain_message";

export interface DirectRecipientRef {
  kind: "user" | "subscriber";
  id: string;
}

type Loaded =
  | { state: "loading" }
  | { state: "refused"; message: string }
  | { state: "ready"; recipient: DirectRecipientView; designs: DesignOption[] };

export function SendEmailDialog({
  recipient,
  open,
  onOpenChange,
  editorLabels,
}: {
  recipient: DirectRecipientRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorLabels: RichTextLabels;
}) {
  const t = useTranslations("admin.announcements.direct");
  const tAdmin = useTranslations("admin");
  const { run, pending } = useServerAction();
  const previewFrame = React.useId().replace(/:/g, "");

  const [loaded, setLoaded] = React.useState<Loaded>({ state: "loading" });
  const [designId, setDesignId] = React.useState<string>(BLANK);
  const [subject, setSubject] = React.useState("");
  const [mode, setMode] = React.useState<EmailBodyMode>("RICH");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [replyToSelf, setReplyToSelf] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const previewFormRef = React.useRef<HTMLFormElement>(null);

  const refuse = React.useCallback(
    (reason: string) =>
      t.has(`refusals.${reason}`) ? t(`refusals.${reason}`) : t("refusals.forbidden"),
    [t],
  );

  const applyDesign = React.useCallback((design: DesignOption | undefined) => {
    setDesignId(design?.id ?? BLANK);
    setSubject(design?.subject ?? "");
    setMode(design?.mode ?? "RICH");
    setBodyHtml(design?.bodyHtml ?? "");
  }, []);

  // Ask the server each time the dialog opens: whether a person may be
  // emailed can change between two opens (they unsubscribe, an account is
  // deleted), and a stale "yes" would be a refusal after the author typed.
  // Every caller MOUNTS the dialog per open, so it starts in "loading" and
  // this effect needs no reset of its own.
  // Keyed on the two strings, not the object: a caller that builds
  // `{ kind, id }` inline would otherwise reload the dialog on every render.
  const { kind, id } = recipient;
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([directRecipientAction({ kind, id }), listDesignOptionsAction()])
      .then(([who, designs]) => {
        if (cancelled) return;
        if (!who.ok) {
          setLoaded({ state: "refused", message: refuse(who.reason) });
          return;
        }
        if (who.recipient.refusal) {
          setLoaded({ state: "refused", message: refuse(who.recipient.refusal) });
          return;
        }
        setLoaded({ state: "ready", recipient: who.recipient, designs });
        applyDesign(designs.find((design) => design.id === DEFAULT_DESIGN_ID));
      })
      .catch(() => {
        if (!cancelled) setLoaded({ state: "refused", message: refuse("forbidden") });
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, id, refuse, applyDesign]);

  const values = {
    recipient: { kind, id },
    designId: designId === BLANK ? null : designId,
    subject,
    mode,
    bodyHtml,
    replyToSelf,
  };
  const form = useFieldErrors(directEmailSchema, values);
  const unknown = unknownVariables(`${subject} ${bodyHtml}`);
  const needsUnsubscribe = mode === "HTML" && !bodyHtml.includes("{{unsubscribe.url}}");
  const tCustom = useTranslations("admin.announcements.custom");

  function send() {
    if (!form.validate() || unknown.length > 0 || needsUnsubscribe) return;
    const email = loaded.state === "ready" ? loaded.recipient.email : "";
    run(
      async () => {
        const result = await sendDirectEmailAction(values);
        if (!result.ok) throw new Error(refuse(result.reason));
        toast.success(t("sent", { email }));
        onOpenChange(false);
      },
      { skipRefresh: true },
    );
  }

  const person = loaded.state === "ready" ? loaded.recipient.name || loaded.recipient.email : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name: person || "…" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {loaded.state === "loading" && (
          <div className="flex justify-center py-8">
            <Spinner size="sm" aria-label={t("loading")} />
          </div>
        )}

        {loaded.state === "refused" && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive-interactive">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            {loaded.message}
          </p>
        )}

        {loaded.state === "ready" && (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm">
              <Mail aria-hidden className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("to")}</span>
              <span className="font-medium">
                {loaded.recipient.name
                  ? `${loaded.recipient.name} <${loaded.recipient.email}>`
                  : loaded.recipient.email}
              </span>
            </p>
            {loaded.recipient.suppressed && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
              >
                <TriangleAlert
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-warning-interactive"
                />
                {t("suppressedNotice")}
              </p>
            )}

            <Field label={t("startFrom")}>
              <AdminCombobox
                aria-label={t("startFrom")}
                value={designId}
                onValueChange={(value) =>
                  applyDesign(loaded.designs.find((design) => design.id === value))
                }
                options={[
                  { value: BLANK, label: t("blank") },
                  ...loaded.designs.map((design) => ({ value: design.id, label: design.name })),
                ]}
              />
            </Field>
            <Field label={t("subject")} required error={form.error("subject")}>
              <Input
                value={subject}
                maxLength={200}
                onChange={(event) => setSubject(event.target.value)}
              />
            </Field>
            <Field
              label={t("body")}
              required
              hint={mode === "HTML" ? tCustom("htmlHint") : undefined}
              error={
                unknown[0]
                  ? tCustom("unknownVariable", { variable: unknown[0] })
                  : needsUnsubscribe
                    ? tCustom("needsUnsubscribe", { token: "{{unsubscribe.url}}" })
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
            {/* A switch leads its row (code-style #25). */}
            <UiField orientation="horizontal">
              <Switch
                checked={replyToSelf}
                onCheckedChange={(value) => setReplyToSelf(value === true)}
              />
              <FieldContent>
                <FieldLabel className="font-normal">{t("replyToSelf")}</FieldLabel>
                <FieldDescription className="text-xs">{t("replyToSelfHint")}</FieldDescription>
              </FieldContent>
            </UiField>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  setShowPreview((value) => !value);
                  window.setTimeout(() => previewFormRef.current?.requestSubmit(), 0);
                }}
              >
                {showPreview ? t("hidePreview") : t("showPreview")}
              </Button>
              {/* The design mode of the isolated preview route renders the
                  words on screen, on its own sandboxed origin (ADR-078 #8). */}
              <form
                ref={previewFormRef}
                action={PREVIEW_URL}
                method="post"
                target={previewFrame}
                className="hidden"
              >
                <input type="hidden" name="preview" value="design" />
                <input type="hidden" name="name" value="direct" />
                <input type="hidden" name="mode" value={mode} />
                <input type="hidden" name="subject" value={subject} />
                <input type="hidden" name="bodyHtml" value={bodyHtml} />
              </form>
              {showPreview && (
                <iframe
                  name={previewFrame}
                  title={t("previewFrame")}
                  sandbox=""
                  className="h-120 w-full rounded-sm border bg-background"
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tAdmin("cancel")}
          </Button>
          {loaded.state === "ready" && (
            <Button loading={pending} onClick={send}>
              {t("send")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The dialog behind its own button, for a server-rendered record page. */
export function SendEmailButton(props: {
  recipient: DirectRecipientRef;
  editorLabels: RichTextLabels;
}) {
  const t = useTranslations("admin.announcements.direct");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Mail aria-hidden data-icon="inline-start" />
        {t("open")}
      </Button>
      {/* Mounted per open, so each open asks the server afresh. */}
      {open && <SendEmailDialog {...props} open onOpenChange={setOpen} />}
    </>
  );
}
