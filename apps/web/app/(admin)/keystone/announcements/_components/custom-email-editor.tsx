"use client";

// The custom email composer (ADR-172, changes-55 §6): 1. Content · 2. Audience
// · 3. Review & send. The course announcement editor's shape, with the words
// written here instead of taken from a template.
//
// Three rules shape it:
//
//   1. **A design is COPIED in.** Picking one fills the current language's
//      subject and message; editing the design later changes nothing here.
//      Replacing words already written asks first (code-style #7).
//   2. **One Save writes one language**, the template editor's rule: switching
//      the language tab keeps an unsaved draft in memory, and only the tab on
//      screen is sent.
//   3. **A bulk send waits for a test since the last edit** (owner, E5). The
//      server compares the stored words with the words at the last test; this
//      screen only shows the answer and the button that changes it.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Braces, CalendarClock, CircleCheck, CircleX, Send, TestTube } from "lucide-react";
import {
  announcementAudienceSchema,
  audiencesForKind,
  customEmailSaveSchema,
  type AnnouncementAudienceKey,
  type AnnouncementRefusal,
  type EmailBodyMode,
} from "@repo/contracts";
import type { AnnouncementUserOption, AudienceSummary } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DateTimePicker } from "@repo/ui/components/date-time-picker";
import { Input } from "@repo/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import {
  queueAnnouncementAction,
  scheduleAnnouncementAction,
} from "../../_actions/announcement-actions.ts";
import {
  saveCustomEmailAction,
  sendCustomEmailTestAction,
  summariseCustomAudienceAction,
  type CustomEmailRefused,
  type DesignOption,
} from "../../_actions/custom-email-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { RichTextEditor, type RichTextLabels } from "../../_components/rich-text-editor.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import { VariableChips } from "../../settings/email/designs/_components/design-editor.tsx";
import { CUSTOM_EMAIL_STEPS, type CustomEmailStep } from "../_lib/steps.ts";
import { unknownVariables } from "../_lib/variables.ts";
import { AudienceCards } from "./audience-cards.tsx";
import type { CourseChip } from "./course-picker.tsx";
import { TestSendDialog } from "./test-send-dialog.tsx";

const PREVIEW_URL = "/keystone/api/email/preview";
const PREVIEW_FRAME = "custom-email-preview";
const COUNT_DELAY_MS = 400;
const BLANK = "__blank__";

const REFUSAL_FIX: Partial<Record<AnnouncementRefusal, string>> = {
  email_disabled: "/keystone/settings/email",
  no_postal_address: "/keystone/settings/email",
};

interface Words {
  subject: string;
  preheader: string;
  mode: EmailBodyMode;
  bodyHtml: string;
}

const EMPTY: Words = { subject: "", preheader: "", mode: "RICH", bodyHtml: "" };

export interface CustomEmailEditorProps {
  initial: {
    id: string | null;
    name: string;
    designId: string | null;
    contents: ({ locale: string } & Words)[];
    keys: AnnouncementAudienceKey[];
  };
  initialStep: CustomEmailStep;
  locales: { code: string; name: string }[];
  designs: DesignOption[];
  audienceCourses: CourseChip[];
  audienceUsers: AnnouncementUserOption[];
  summary: AudienceSummary | null;
  blockers: AnnouncementRefusal[];
  tested: boolean;
  canSend: boolean;
  canPickUsers: boolean;
  canPickStaff: boolean;
  editorLabels: RichTextLabels;
  /** The acting admin's address, prefilled in the test dialog. */
  testAddress: string;
}

const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

function localToIso(local: string): string {
  if (!local) return "";
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isEmpty(words: Words): boolean {
  return words.subject.trim() === "" && words.bodyHtml.trim() === "";
}

export function CustomEmailEditor(props: CustomEmailEditorProps) {
  const t = useTranslations("admin.announcements");
  const tAdmin = useTranslations("admin");
  const router = useRouter();
  const hydrated = useHydrated();
  const { run, pending } = useServerAction();

  const defaultLocale = props.locales[0]?.code ?? "en";
  const [step, setStep] = useState<CustomEmailStep>(props.initialStep);
  const [name, setName] = useState(props.initial.name);
  const [designId, setDesignId] = useState<string | null>(props.initial.designId);
  const [locale, setLocale] = useState(defaultLocale);
  const [drafts, setDrafts] = useState<Record<string, Words>>(() =>
    Object.fromEntries(
      props.locales.map((entry) => {
        const stored = props.initial.contents.find((row) => row.locale === entry.code);
        return [
          entry.code,
          stored
            ? {
                subject: stored.subject,
                preheader: stored.preheader ?? "",
                mode: stored.mode,
                bodyHtml: stored.bodyHtml,
              }
            : EMPTY,
        ];
      }),
    ),
  );
  const [keys, setKeys] = useState<AnnouncementAudienceKey[]>(props.initial.keys);
  const [courses, setCourses] = useState<CourseChip[]>(props.audienceCourses);
  const [users, setUsers] = useState<AnnouncementUserOption[]>(props.audienceUsers);
  const [summary, setSummary] = useState<AudienceSummary | null>(props.summary);
  const [pendingDesign, setPendingDesign] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const previewFormRef = useRef<HTMLFormElement>(null);

  const words = useMemo(() => drafts[locale] ?? EMPTY, [drafts, locale]);
  const patch = (changes: Partial<Words>) =>
    setDrafts((current) => ({ ...current, [locale]: { ...words, ...changes } }));

  const audience = useMemo(() => {
    if (keys.length === 0) return undefined;
    return {
      keys,
      ...(keys.includes("course_learners") ? { courseIds: courses.map((item) => item.id) } : {}),
      ...(keys.includes("custom") ? { userIds: users.map((item) => item.id) } : {}),
    };
  }, [keys, courses, users]);

  // The words on screen are sent when they are the default language (which
  // must have words) or when something has been written in this language.
  const sendsWords = locale === defaultLocale || !isEmpty(words);
  const values = {
    ...(props.initial.id ? { id: props.initial.id } : {}),
    name,
    designId,
    ...(sendsWords
      ? {
          content: {
            locale,
            subject: words.subject,
            preheader: words.preheader || undefined,
            mode: words.mode,
            bodyHtml: words.bodyHtml,
          },
        }
      : {}),
    ...(audience ? { audience } : {}),
  };
  const form = useFieldErrors(customEmailSaveSchema, values);
  const unknown = unknownVariables(`${words.subject} ${words.preheader} ${words.bodyHtml}`);
  const needsUnsubscribe = words.mode === "HTML" && !words.bodyHtml.includes("{{unsubscribe.url}}");

  // Live counts from the same resolver the send uses, for a COMPLETE audience.
  const countable = audience && announcementAudienceSchema.safeParse(audience).success;
  const audienceKey = JSON.stringify(countable ? audience : null);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      summariseCustomAudienceAction({ audience: JSON.parse(audienceKey) })
        .then((next) => {
          if (!cancelled) setSummary(next);
        })
        .catch(() => undefined);
    }, COUNT_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [audienceKey]);

  // The preview shows the SAVED words (the route reads them).
  useEffect(() => {
    if (step === "content" && props.initial.id) previewFormRef.current?.requestSubmit();
  }, [step, locale, props.initial.id]);

  function refusal(result: CustomEmailRefused | { ok: false; reason: string }): string {
    const key = `refusals.${result.reason}`;
    return t.has(key) ? t(key) : t(`direct.refusals.${result.reason}`);
  }

  function saveAndGo(next: CustomEmailStep | null) {
    if (!form.validate()) return;
    if (unknown.length > 0 || needsUnsubscribe) return;
    run(
      async () => {
        const result = await saveCustomEmailAction(values);
        if (!result.ok) throw new Error(refusal(result));
        form.reset();
        if (!props.initial.id) {
          router.replace(`/keystone/announcements/${result.id}?step=${next ?? step}`);
          return;
        }
        if (next) setStep(next);
        previewFormRef.current?.requestSubmit();
      },
      { successMessage: t("saved") },
    );
  }

  function applyDesign(id: string) {
    const design = props.designs.find((row) => row.id === id);
    setDesignId(design?.id ?? null);
    patch(
      design
        ? {
            subject: design.subject ?? words.subject,
            preheader: design.preheader ?? "",
            mode: design.mode,
            bodyHtml: design.bodyHtml,
          }
        : EMPTY,
    );
  }

  function pickDesign(value: string) {
    const id = value === BLANK ? "" : value;
    if (isEmpty(words)) applyDesign(id);
    else setPendingDesign(id);
  }

  function sendTest(to: string, done: () => void) {
    if (!props.initial.id) return;
    const id = props.initial.id;
    run(async () => {
      const result = await sendCustomEmailTestAction({ id, locale, to });
      if (!result.ok) toast.error(refusal(result));
      else if (result.status === "SENT") {
        toast.success(t("testSent", { to }));
        done();
      } else toast.error(t("testNotSent", { status: result.status }));
    });
  }

  function sendNow() {
    if (!props.initial.id) return;
    const id = props.initial.id;
    run(async () => {
      const result = await queueAnnouncementAction(id);
      if (!result.ok) {
        toast.error(refusal(result));
        return;
      }
      if (result.state === "sending") toast.success(t("queued", { count: result.recipients }));
    });
  }

  function schedule() {
    if (!props.initial.id) return;
    const id = props.initial.id;
    const iso = localToIso(scheduleAt);
    if (!iso) {
      toast.error(t("refusals.schedule_in_past"));
      return;
    }
    run(async () => {
      const result = await scheduleAnnouncementAction({ id, scheduledFor: iso });
      if (!result.ok) toast.error(refusal(result));
      else toast.success(t("scheduled"));
    });
  }

  async function copyVariable(variable: string) {
    const token = `{{${variable}}}`;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(tAdmin("email.variableCopied", { token }));
    } catch {
      toast.error(tAdmin("email.copyFailed", { token }));
    }
  }

  const saved = props.initial.id !== null;
  const stepIndex = CUSTOM_EMAIL_STEPS.indexOf(step);
  const nextStep = CUSTOM_EMAIL_STEPS[stepIndex + 1] ?? null;
  const unique = summary?.selection?.unique ?? 0;
  const cards = audiencesForKind("CUSTOM").filter(
    (key) => (key !== "custom" || props.canPickUsers) && (key !== "staff" || props.canPickStaff),
  );
  const writtenLocales = props.initial.contents.map((row) => row.locale);
  const defaultName = props.locales[0]?.name ?? defaultLocale;
  const bodyError = unknown[0]
    ? t("custom.unknownVariable", { variable: unknown[0] })
    : needsUnsubscribe
      ? t("custom.needsUnsubscribe", { token: "{{unsubscribe.url}}" })
      : form.error("content.bodyHtml");

  function toggleKey(key: AnnouncementAudienceKey) {
    setKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  return (
    <Tabs value={step} onValueChange={(value) => setStep(value as CustomEmailStep)}>
      <TabsList aria-label={t("stepsLabel")} className="mb-4">
        {CUSTOM_EMAIL_STEPS.map((key, index) => (
          <TabsTrigger key={key} value={key} disabled={!saved && index > 0}>
            {t("stepNumber", { number: index + 1 })} {t(`steps.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ─── 1. Content ─────────────────────────────────────── */}
      <TabsContent value="content" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <EditorSection
              title={t("custom.contentTitle")}
              description={t("custom.contentDescription")}
            >
              <Field
                label={t("fieldName")}
                hint={t("fieldNameHint")}
                required
                error={form.error("name")}
              >
                <Input
                  value={name}
                  maxLength={160}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label={t("custom.startFrom")} hint={t("custom.startFromHint")}>
                <AdminCombobox
                  aria-label={t("custom.startFrom")}
                  value={designId ?? BLANK}
                  onValueChange={pickDesign}
                  options={[
                    { value: BLANK, label: t("custom.blank") },
                    ...props.designs.map((design) => ({ value: design.id, label: design.name })),
                  ]}
                />
              </Field>
              {props.locales.length > 1 && (
                <Field label={t("custom.language")}>
                  <div className="flex flex-wrap gap-2">
                    {props.locales.map((entry) => (
                      <Button
                        key={entry.code}
                        type="button"
                        size="sm"
                        variant={entry.code === locale ? "default" : "outline"}
                        onClick={() => setLocale(entry.code)}
                      >
                        {entry.name}
                      </Button>
                    ))}
                  </div>
                  {locale !== defaultLocale && !writtenLocales.includes(locale) && (
                    <p className="text-xs text-muted-foreground">
                      {t("custom.languageMissing", { fallback: defaultName })}
                    </p>
                  )}
                </Field>
              )}
              <Field
                label={t("custom.fieldSubject")}
                required
                error={form.error("content.subject")}
              >
                <Input
                  value={words.subject}
                  maxLength={200}
                  onChange={(event) => patch({ subject: event.target.value })}
                />
              </Field>
              <Field
                label={t("custom.fieldPreheader")}
                hint={t("custom.fieldPreheaderHint")}
                error={form.error("content.preheader")}
              >
                <Input
                  value={words.preheader}
                  maxLength={200}
                  onChange={(event) => patch({ preheader: event.target.value })}
                />
              </Field>
              <Field
                label={t("custom.fieldBody")}
                required
                hint={words.mode === "HTML" ? t("custom.htmlHint") : undefined}
                error={bodyError}
              >
                <RichTextEditor
                  value={words.bodyHtml}
                  onChange={(html) => patch({ bodyHtml: html })}
                  labels={props.editorLabels}
                  mediaCategory="email"
                  mode={words.mode === "HTML" ? "html" : "visual"}
                  onModeChange={(next) => patch({ mode: next === "html" ? "HTML" : "RICH" })}
                />
              </Field>
            </EditorSection>
            <EditorSection
              title={t("custom.variablesTitle")}
              description={t("custom.variablesDescription")}
              icon={Braces}
              accent="info"
            >
              <VariableChips onCopy={(variable) => void copyVariable(variable)} />
            </EditorSection>
          </div>

          <EditorSection title={t("previewTitle")} description={t("previewDescription")}>
            {saved ? (
              <>
                {/* A real form POST at a named sandboxed frame (ADR-078 #8). */}
                <form
                  ref={previewFormRef}
                  action={PREVIEW_URL}
                  method="post"
                  target={PREVIEW_FRAME}
                  className="hidden"
                >
                  <input type="hidden" name="campaignId" value={props.initial.id ?? ""} />
                  <input type="hidden" name="locale" value={locale} />
                </form>
                <iframe
                  name={PREVIEW_FRAME}
                  title={t("previewTitle")}
                  sandbox=""
                  className="h-160 w-full rounded-sm border bg-background"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("previewNeedsSave")}</p>
            )}
          </EditorSection>
        </div>
        <div className="flex justify-end">
          <Button type="button" loading={pending} onClick={() => saveAndGo(nextStep)}>
            {t("saveAndContinue")}
          </Button>
        </div>
      </TabsContent>

      {/* ─── 2. Audience ────────────────────────────────────── */}
      <TabsContent value="audience" className="flex flex-col gap-4">
        <EditorSection title={t("audienceTitle")} description={t("audienceDescription")}>
          <AudienceCards
            cards={cards}
            keys={keys}
            onToggle={toggleKey}
            summary={summary}
            courses={courses}
            onCoursesChange={setCourses}
            users={users}
            onUsersChange={setUsers}
            errors={{
              keys: form.error("audience.keys"),
              courseIds: form.error("audience.courseIds"),
              userIds: form.error("audience.userIds"),
            }}
          />
          <p className="text-xs text-muted-foreground">{t("audienceFootnote")}</p>
        </EditorSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-sm font-medium">
            {summary?.selection
              ? t("uniqueRecipients", {
                  count: summary.selection.unique,
                  duplicates: summary.selection.duplicates,
                  suppressed: summary.selection.suppressed,
                })
              : t("pickAudience")}
          </p>
          <Button type="button" loading={pending} onClick={() => saveAndGo(nextStep)}>
            {t("saveAndContinue")}
          </Button>
        </div>
      </TabsContent>

      {/* ─── 3. Review & send ───────────────────────────────── */}
      <TabsContent value="review" className="flex flex-col gap-4">
        <EditorSection title={t("reviewTitle")} description={t("reviewDescription")}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <dt className="text-muted-foreground">{t("fieldName")}</dt>
            <dd>{name || "—"}</dd>
            <dt className="text-muted-foreground">{t("custom.fieldSubject")}</dt>
            <dd>{drafts[defaultLocale]?.subject || "—"}</dd>
            {props.locales.length > 1 && (
              <>
                <dt className="text-muted-foreground">{t("custom.language")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {props.locales
                    .filter((entry) => writtenLocales.includes(entry.code))
                    .map((entry) => (
                      <Badge key={entry.code} variant="outline">
                        {entry.name}
                      </Badge>
                    ))}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("audienceTitle")}</dt>
            <dd className="flex flex-wrap gap-1">
              {keys.map((key) => (
                <Badge key={key} variant="outline">
                  {t(`audiences.${key}.label`)}
                </Badge>
              ))}
            </dd>
            <dt className="text-muted-foreground">{t("columnRecipients")}</dt>
            <dd className="tabular-nums">{t("recipientCount", { count: unique })}</dd>
          </dl>
        </EditorSection>

        <EditorSection
          title={t("custom.testTitle")}
          description={t("custom.testDescription")}
          icon={TestTube}
          accent={props.tested ? "success" : "warning"}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm">
              {props.tested ? (
                <CircleCheck aria-hidden className="size-4 text-success-interactive" />
              ) : (
                <CircleX aria-hidden className="size-4 text-destructive" />
              )}
              {props.tested ? t("custom.tested") : t("custom.untested")}
            </span>
            <TestSendDialog defaultTo={props.testAddress} pending={pending} onSend={sendTest} />
          </div>
        </EditorSection>

        <EditorSection title={t("checklistTitle")} description={t("checklistDescription")}>
          <ul className="flex flex-col gap-2 text-sm">
            {props.blockers.length === 0 && (
              <li className="flex items-center gap-2">
                <CircleCheck aria-hidden className="size-4 text-success-interactive" />
                {t("checklistReady")}
              </li>
            )}
            {props.blockers.map((reason) => (
              <li key={reason} className="flex flex-wrap items-center gap-2">
                <CircleX aria-hidden className="size-4 text-destructive" />
                <span>{t(`refusals.${reason}`)}</span>
                {REFUSAL_FIX[reason] && (
                  <Link
                    href={REFUSAL_FIX[reason] ?? "/keystone/settings/email"}
                    className="font-medium text-primary-interactive underline-offset-4 hover:underline"
                  >
                    {t("fixIt")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </EditorSection>

        {props.canSend && (
          <EditorSection title={t("sendTitle")} description={t("sendDescription")}>
            <Field label={t("scheduleLabel")} hint={t("scheduleHint")}>
              <DateTimePicker
                value={hydrated ? scheduleAt : ""}
                onChange={setScheduleAt}
                labels={{
                  placeholder: tAdmin("schedulePickerPlaceholder"),
                  previousMonth: tAdmin("schedulePickerPreviousMonth"),
                  nextMonth: tAdmin("schedulePickerNextMonth"),
                  hour: tAdmin("schedulePickerHour"),
                  minute: tAdmin("schedulePickerMinute"),
                }}
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                loading={pending}
                disabled={!scheduleAt || props.blockers.length > 0}
                onClick={schedule}
              >
                <CalendarClock aria-hidden data-icon="inline-start" />
                {t("schedule")}
              </Button>
              <Button
                type="button"
                loading={pending}
                disabled={props.blockers.length > 0 || unique === 0}
                onClick={() => setConfirmSend(true)}
              >
                <Send aria-hidden data-icon="inline-start" />
                {t("sendNow")}
              </Button>
            </div>
          </EditorSection>
        )}

        <ConfirmDialog
          open={confirmSend}
          onOpenChange={setConfirmSend}
          title={t("confirmSendTitle")}
          description={t("confirmSendBody", { count: unique })}
          confirmLabel={t("confirmSend")}
          cancelLabel={tAdmin("cancel")}
          onConfirm={sendNow}
        />
      </TabsContent>

      <ConfirmDialog
        open={pendingDesign !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDesign(null);
        }}
        title={t("custom.replaceTitle")}
        description={t("custom.replaceBody")}
        confirmLabel={t("custom.replace")}
        cancelLabel={tAdmin("cancel")}
        destructive
        onConfirm={() => {
          if (pendingDesign !== null) applyDesign(pendingDesign);
          setPendingDesign(null);
        }}
      />
    </Tabs>
  );
}
