"use client";

// The four-step announcement editor (ADR-171, changes-54 §10.3) — the
// reference picture's shape: 1. Content · 2. Subject & message · 3. Audience ·
// 4. Review & send.
//
// **Every step saves the draft** ("Save & continue"), and the steps are not
// locked: an admin can jump back. Validation is the action's own schema
// (`announcementSaveSchema`) through `useFieldErrors` (code-style #24).
//
// **Nothing here sends.** Send writes the recipient rows and the queue does
// the rest (owner, D8); the numbers the Review step confirms come from the
// same resolver the send uses, so the count confirmed is the count queued.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock, CircleCheck, CircleX, Eye, Send, TestTube } from "lucide-react";
import {
  ANNOUNCEMENT_MESSAGE_MAX,
  announcementAudienceSchema,
  audiencesForKind,
  announcementSaveSchema,
  type AnnouncementAudienceKey,
  type AnnouncementRefusal,
} from "@repo/contracts";
import type {
  AnnounceableCourse,
  AnnouncementComposeContext,
  AnnouncementUserOption,
  AudienceSummary,
  TargetAvailability,
} from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DateTimePicker } from "@repo/ui/components/date-time-picker";
import { Input } from "@repo/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { formatDateTime } from "@repo/utils";
import {
  queueAnnouncementAction,
  saveAnnouncementDraftAction,
  scheduleAnnouncementAction,
  sendAnnouncementTestAction,
  summariseAudienceAction,
  type AnnouncementRefused,
} from "../../_actions/announcement-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { EmailPreviewDialog, EmailPreviewFrame } from "../../_components/email-preview.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import { AudienceCards, RecipientEstimate } from "./audience-cards.tsx";
import { InboxPreview, PreSendChecklist, type ChecklistItem } from "./send-review.tsx";
import { CourseSearch, type CourseChip } from "./course-picker.tsx";
import { TestSendForm } from "./test-send-form.tsx";
import { ANNOUNCEMENT_STEPS, type AnnouncementStep } from "../_lib/steps.ts";

const COUNT_DELAY_MS = 400;

/** Where each refusal is fixed (plan §8.1: every check has a fix-it link). */
const REFUSAL_FIX: Partial<Record<AnnouncementRefusal, string>> = {
  email_disabled: "/keystone/settings/email",
  template_inactive: "/keystone/settings/email/templates/announcement.course",
  no_postal_address: "/keystone/settings/email",
};

export interface SelectedCourse {
  id: string;
  title: string;
  track: string;
  difficulty: string;
  availability: TargetAvailability;
  scheduledFor: string | null;
}

export interface AnnouncementEditorProps {
  initial: {
    id: string | null;
    name: string;
    targetId: string;
    subject: string;
    message: string;
    keys: AnnouncementAudienceKey[];
  };
  initialStep: AnnouncementStep;
  course: SelectedCourse | null;
  previousSends: { startedAt: string | null; recipientCount: number }[];
  compose: AnnouncementComposeContext;
  locales: string[];
  audienceCourses: CourseChip[];
  audienceUsers: AnnouncementUserOption[];
  summary: AudienceSummary | null;
  blockers: AnnouncementRefusal[];
  canSend: boolean;
  canPickUsers: boolean;
  /** The acting admin's address, prefilled in the test dialog. */
  testAddress: string;
}

const noop = () => () => {};
/** The picker shows the editor's LOCAL time, which the server cannot know. */
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

export function AnnouncementEditor(props: AnnouncementEditorProps) {
  const t = useTranslations("admin.announcements");
  const tAdmin = useTranslations("admin");
  const router = useRouter();
  const hydrated = useHydrated();
  const { run, pending } = useServerAction();

  const [step, setStep] = useState<AnnouncementStep>(props.initialStep);
  const [course, setCourse] = useState<SelectedCourse | null>(props.course);
  const [name, setName] = useState(props.initial.name);
  const [subject, setSubject] = useState(props.initial.subject);
  const [message, setMessage] = useState(props.initial.message);
  const [keys, setKeys] = useState<AnnouncementAudienceKey[]>(props.initial.keys);
  const [audienceCourses, setAudienceCourses] = useState<CourseChip[]>(props.audienceCourses);
  const [audienceUsers, setAudienceUsers] = useState<AnnouncementUserOption[]>(props.audienceUsers);
  const [summary, setSummary] = useState<AudienceSummary | null>(props.summary);
  const [previewLocale, setPreviewLocale] = useState(props.locales[0] ?? "en");
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Bumped after a save: the preview renders the SAVED draft (the route reads it).
  const [previewNonce, setPreviewNonce] = useState(0);

  const audience = useMemo(() => {
    if (keys.length === 0) return undefined;
    return {
      keys,
      ...(keys.includes("course_learners")
        ? { courseIds: audienceCourses.map((item) => item.id) }
        : {}),
      ...(keys.includes("custom") ? { userIds: audienceUsers.map((item) => item.id) } : {}),
    };
  }, [keys, audienceCourses, audienceUsers]);

  const values = {
    ...(props.initial.id ? { id: props.initial.id } : {}),
    kind: "COURSE" as const,
    targetId: course?.id ?? "",
    name,
    subject,
    message,
    ...(audience ? { audience } : {}),
  };
  const form = useFieldErrors(announcementSaveSchema, values);

  // Live counts: the same resolver the send uses, debounced.
  const targetId = course?.id ?? "";
  // Only a COMPLETE audience is counted: "Select users" ticked with nobody
  // picked yet is a half-made choice, and the action's schema refuses it.
  // Null still returns every card's own count.
  const countable = audience && announcementAudienceSchema.safeParse(audience).success;
  const audienceKey = JSON.stringify(countable ? audience : null);
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      summariseAudienceAction({ targetId, audience: JSON.parse(audienceKey) })
        .then((next) => {
          if (!cancelled) setSummary(next);
        })
        .catch(() => undefined);
    }, COUNT_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [targetId, audienceKey]);

  function refusalMessage(result: AnnouncementRefused): string {
    return t(`refusals.${result.reason}`);
  }

  function saveAndGo(next: AnnouncementStep | null) {
    if (!form.validate()) return;
    run(
      async () => {
        const result = await saveAnnouncementDraftAction(values);
        // Thrown, so `run` shows the refusal INSTEAD of its success toast.
        if (!result.ok) throw new Error(refusalMessage(result));
        form.reset();
        if (!props.initial.id) {
          router.replace(`/keystone/announcements/${result.id}?step=${next ?? step}`);
          return;
        }
        if (next) setStep(next);
        setPreviewNonce((n) => n + 1);
      },
      { successMessage: t("saved") },
    );
  }

  function sendNow() {
    if (!props.initial.id) return;
    const id = props.initial.id;
    run(async () => {
      const result = await queueAnnouncementAction(id);
      if (!result.ok) {
        toast.error(refusalMessage(result));
        return;
      }
      toast.success(
        result.state === "sending"
          ? t("queued", { count: result.recipients })
          : t("waitingForCourse"),
      );
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
      if (!result.ok) toast.error(refusalMessage(result));
      else toast.success(t("scheduled"));
    });
  }

  function sendTest(to: string, done: () => void) {
    if (!props.initial.id) return;
    const id = props.initial.id;
    run(
      async () => {
        const result = await sendAnnouncementTestAction({ id, locale: previewLocale, to });
        if (!result.ok) toast.error(refusalMessage(result));
        else if (result.status === "SENT") {
          toast.success(t("testSent", { to }));
          done();
        } else toast.error(t("testNotSent", { status: result.status }));
      },
      { skipRefresh: true },
    );
  }

  const unique = summary?.selection?.unique ?? 0;
  const saved = props.initial.id !== null;
  const stepIndex = ANNOUNCEMENT_STEPS.indexOf(step);
  const nextStep = ANNOUNCEMENT_STEPS[stepIndex + 1] ?? null;

  const continueButton = (
    <div className="flex justify-end">
      <Button type="button" loading={pending} onClick={() => saveAndGo(nextStep)}>
        {nextStep ? t("saveAndContinue") : tAdmin("save")}
      </Button>
    </div>
  );

  function toggleKey(key: AnnouncementAudienceKey) {
    setKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  const cards = audiencesForKind("COURSE").filter((key) => key !== "custom" || props.canPickUsers);

  const sender = props.compose.fromEmail
    ? `${props.compose.fromName} <${props.compose.fromEmail}>`
    : "";
  const checklist: ChecklistItem[] = [
    {
      key: "course",
      state: course && course.availability !== "unavailable" ? "ok" : "failed",
      title: t("checks.course"),
      detail: course
        ? course.availability === "unavailable"
          ? t("refusals.target_unavailable")
          : course.title
        : t("checks.courseMissing"),
    },
    {
      key: "subject",
      state: subject || props.compose.templateSubject ? "ok" : "failed",
      title: t("checks.subject"),
      detail: subject || props.compose.templateSubject || t("checks.subjectMissing"),
    },
    {
      key: "sender",
      state: sender ? "ok" : "failed",
      title: t("checks.sender"),
      detail: sender || t("checks.senderMissing"),
      fixHref: "/keystone/settings/email",
    },
    {
      key: "audience",
      state: unique > 0 || course?.availability === "scheduled" ? "ok" : "failed",
      title: t("checks.audience"),
      detail:
        keys.length === 0
          ? t("pickAudience")
          : `${t("recipientCount", { count: unique })} · ${keys
              .map((key) => t(`audiences.${key}.label`))
              .join(", ")}`,
    },
  ];

  return (
    <Tabs value={step} onValueChange={(value) => setStep(value as AnnouncementStep)}>
      <TabsList aria-label={t("stepsLabel")} className="mb-4">
        {ANNOUNCEMENT_STEPS.map((key, index) => (
          <TabsTrigger key={key} value={key} disabled={!saved && index > 0}>
            {t("stepNumber", { number: index + 1 })} {t(`steps.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ─── 1. Content ─────────────────────────────────────── */}
      <TabsContent value="content" className="flex flex-col gap-4">
        <EditorSection title={t("contentTitle")} description={t("contentDescription")}>
          <Field label={t("fieldCourse")} required error={form.error("targetId")}>
            {course ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{course.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`tracks.${course.track}`)} · {t(`levels.${course.difficulty}`)}
                  </span>
                  {course.availability === "scheduled" && course.scheduledFor && (
                    <Badge variant="info" className="self-start">
                      {t("goesLiveOn", { date: formatDateTime(new Date(course.scheduledFor)) })}
                    </Badge>
                  )}
                  {course.availability === "unavailable" && (
                    <Badge variant="warning" className="self-start">
                      {t("refusals.target_unavailable")}
                    </Badge>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setCourse(null)}>
                  {t("changeCourse")}
                </Button>
              </div>
            ) : (
              <CourseSearch
                onPick={(picked: AnnounceableCourse) => {
                  setCourse({
                    id: picked.id,
                    title: picked.title,
                    track: picked.track,
                    difficulty: picked.difficulty,
                    availability: picked.availability,
                    scheduledFor: picked.scheduledFor ? String(picked.scheduledFor) : null,
                  });
                  if (!name) setName(t("defaultName", { title: picked.title }));
                }}
              />
            )}
          </Field>
          {props.previousSends.length > 0 && course && (
            <p role="status" className="text-sm text-warning-interactive">
              {t("announcedBefore", {
                date: props.previousSends[0]?.startedAt
                  ? formatDateTime(new Date(props.previousSends[0].startedAt))
                  : "—",
                count: props.previousSends[0]?.recipientCount ?? 0,
              })}
            </p>
          )}
          <Field
            label={t("fieldName")}
            hint={t("fieldNameHint")}
            required
            error={form.error("name")}
          >
            <Input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} />
          </Field>
        </EditorSection>
        {continueButton}
      </TabsContent>

      {/* ─── 2. Subject & message ───────────────────────────── */}
      <TabsContent value="message" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-(--grid-main-aside-wide)">
          <EditorSection title={t("messageTitle")} description={t("messageDescription")}>
            <Field
              label={t("fieldSubject")}
              hint={t("fieldSubjectHint")}
              error={form.error("subject")}
              adornment={
                <span className="text-xs text-muted-foreground tabular-nums">
                  {subject.length}/200
                </span>
              }
            >
              <Input
                value={subject}
                maxLength={200}
                placeholder={props.compose.templateSubject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </Field>
            <Field
              label={t("fieldMessage")}
              hint={t("fieldMessageHint")}
              error={form.error("message")}
              adornment={
                <span className="text-xs text-muted-foreground tabular-nums">
                  {message.length}/{ANNOUNCEMENT_MESSAGE_MAX}
                </span>
              }
            >
              <Textarea
                value={message}
                rows={4}
                maxLength={ANNOUNCEMENT_MESSAGE_MAX}
                onChange={(event) => setMessage(event.target.value)}
              />
            </Field>
            <p className="text-sm text-muted-foreground">
              {t("senderLine", {
                name: props.compose.fromName,
                email: props.compose.fromEmail,
              })}{" "}
              <Link
                href="/keystone/settings/email"
                className="font-medium text-primary-interactive underline-offset-4 hover:underline"
              >
                {t("senderChange")}
              </Link>
            </p>
          </EditorSection>
          <InboxPreview
            fromName={props.compose.fromName}
            subject={subject || props.compose.templateSubject}
            preheader={message}
          />
        </div>

        <EditorSection title={t("previewTitle")} description={t("previewDescription")}>
          {saved ? (
            // A real form POST at a named sandboxed frame: the rendered message
            // lands on its own opaque origin (ADR-078 #8).
            <EmailPreviewFrame
              fields={{ campaignId: props.initial.id ?? "", locale: previewLocale }}
              refreshKey={previewNonce}
              toolbarStart={
                props.locales.length > 1 ? (
                  <AdminCombobox
                    aria-label={t("previewLanguage")}
                    className="w-36"
                    value={previewLocale}
                    onValueChange={setPreviewLocale}
                    options={props.locales.map((code) => ({
                      value: code,
                      label: code.toUpperCase(),
                    }))}
                  />
                ) : undefined
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("previewNeedsSave")}</p>
          )}
        </EditorSection>
        {continueButton}
      </TabsContent>

      {/* ─── 3. Audience ────────────────────────────────────── */}
      <TabsContent value="audience" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-(--grid-main-aside-wide)">
          <EditorSection title={t("audienceTitle")} description={t("audienceDescription")}>
            <AudienceCards
              cards={cards}
              keys={keys}
              onToggle={toggleKey}
              summary={summary}
              courses={audienceCourses}
              onCoursesChange={setAudienceCourses}
              users={audienceUsers}
              onUsersChange={setAudienceUsers}
              errors={{
                keys: form.error("audience.keys"),
                courseIds: form.error("audience.courseIds"),
                userIds: form.error("audience.userIds"),
              }}
            />
            <p className="text-xs text-muted-foreground">{t("audienceFootnote")}</p>
          </EditorSection>
          <RecipientEstimate summary={summary} />
        </div>
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

      {/* ─── 4. Review & send ───────────────────────────────── */}
      <TabsContent value="review" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-(--grid-main-aside-wide)">
          <div className="flex min-w-0 flex-col gap-4">
            <PreSendChecklist items={checklist}>
              <ul className="flex flex-col gap-2 text-sm">
                {props.blockers.length === 0 && (
                  <li className="flex items-center gap-2 font-medium text-success-interactive">
                    <CircleCheck aria-hidden className="size-4" />
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
                {course?.availability === "scheduled" && course.scheduledFor && (
                  <li className="flex items-center gap-2 text-info-interactive">
                    <CalendarClock aria-hidden className="size-4" />
                    {t("sendsWhenLive", { date: formatDateTime(new Date(course.scheduledFor)) })}
                  </li>
                )}
              </ul>
            </PreSendChecklist>

            <EditorSection title={t("reviewTitle")} description={t("reviewDescription")}>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <dt className="text-muted-foreground">{t("fieldCourse")}</dt>
                <dd>{course?.title ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("fieldSubject")}</dt>
                <dd>{subject || props.compose.templateSubject}</dd>
                <dt className="text-muted-foreground">{t("audienceTitle")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {keys.map((key) => (
                    <Badge key={key} variant="info">
                      {t(`audiences.${key}.label`)}
                    </Badge>
                  ))}
                </dd>
                <dt className="text-muted-foreground">{t("columnRecipients")}</dt>
                <dd className="tabular-nums">{t("recipientCount", { count: unique })}</dd>
              </dl>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
                  <Eye aria-hidden data-icon="inline-start" />
                  {t("previewEmail")}
                </Button>
              </div>
            </EditorSection>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <EditorSection
              title={t("testCard.title")}
              description={t("testCard.description")}
              icon={TestTube}
              accent="info"
            >
              <TestSendForm defaultTo={props.testAddress} pending={pending} onSend={sendTest} />
            </EditorSection>

            {props.canSend && (
              <EditorSection title={t("sendTitle")} description={t("sendDescription")} icon={Send}>
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
                    disabled={
                      props.blockers.length > 0 ||
                      (unique === 0 && course?.availability !== "scheduled")
                    }
                    onClick={() => setConfirmSend(true)}
                  >
                    <Send aria-hidden data-icon="inline-start" />
                    {course?.availability === "scheduled" ? t("sendWhenLive") : t("sendNow")}
                  </Button>
                </div>
              </EditorSection>
            )}
          </div>
        </div>

        <EmailPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={t("previewEmail")}
          description={t("previewEmailDescription")}
          fields={{ campaignId: props.initial.id ?? "", locale: previewLocale }}
        />
        <ConfirmDialog
          open={confirmSend}
          onOpenChange={setConfirmSend}
          title={t("confirmSendTitle")}
          description={
            course?.availability === "scheduled"
              ? t("confirmSendWhenLiveBody", { count: unique })
              : t("confirmSendBody", { count: unique })
          }
          confirmLabel={t("confirmSend")}
          cancelLabel={tAdmin("cancel")}
          onConfirm={sendNow}
        />
      </TabsContent>
    </Tabs>
  );
}
