"use client";

// An announcement after Send (ADR-171, changes-54 §10.4): where it is, what
// happened to whom, and the two things a person can still do — cancel what has
// not gone, and retry what failed. It refreshes itself while there is work in
// flight (`LiveRefresh`), because the runner moves the numbers, not the viewer.
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock, Pause, RotateCcw, Square, TriangleAlert } from "lucide-react";
import type { AnnouncementAudienceKey, AnnouncementRefusal, CampaignKind } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Progress } from "@repo/ui/components/progress";
import {
  cancelAnnouncementAction,
  retryFailedAnnouncementAction,
  unscheduleAnnouncementAction,
  type AnnouncementRefused,
} from "../../_actions/announcement-actions.ts";
import { EditorSection } from "../../_components/editor/editor-section.tsx";
import { LiveRefresh } from "../../_components/live-refresh.tsx";
import { StatusBadge } from "../../_components/status-badge.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import {
  ANNOUNCEMENT_STATUS_TONE,
  progressPercent,
  type AnnouncementDisplayStatus,
} from "../_lib/labels.ts";

export interface AnnouncementDetailView {
  id: string;
  kind: CampaignKind;
  status: AnnouncementDisplayStatus;
  courseTitle: string | null;
  subject: string;
  message: string | null;
  audienceKeys: AnnouncementAudienceKey[];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  pendingCount: number;
  startedLabel: string | null;
  finishedLabel: string | null;
  scheduledLabel: string | null;
  courseLiveLabel: string | null;
  cancelReason: string | null;
  blockers: AnnouncementRefusal[];
  renderedAt: string;
}

export function AnnouncementDetail({
  view,
  failures,
  canSend,
}: {
  view: AnnouncementDetailView;
  /** Null when the viewer cannot read addresses (`email.log.view`). */
  failures: { email: string; lastError: string | null; attempts: number }[] | null;
  canSend: boolean;
}) {
  const t = useTranslations("admin.announcements");
  const tAdmin = useTranslations("admin");
  const { run, pending } = useServerAction();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const inFlight =
    view.status === "SENDING" || view.status === "SCHEDULED" || view.status === "WAITING";
  const percent = progressPercent(view);
  const paused = view.status === "SENDING" && view.blockers.includes("email_disabled");

  function report(result: { ok: true } | AnnouncementRefused, success: string) {
    if (result.ok) toast.success(success);
    else toast.error(t(`refusals.${result.reason}`));
  }

  return (
    <div className="flex flex-col gap-4">
      <EditorSection
        title={t("progressTitle")}
        description={t("progressDescription")}
        actions={
          inFlight ? (
            <LiveRefresh
              renderedAt={view.renderedAt}
              intervalMs={10_000}
              labels={{ updated: t("updatedAt", { time: "{time}" }), refresh: t("refresh") }}
            />
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={ANNOUNCEMENT_STATUS_TONE[view.status]}>
            {view.status === "SENDING"
              ? t("statusSending", { percent })
              : t(`statuses.${view.status}`)}
          </StatusBadge>
          {view.cancelReason && (
            <span className="text-sm text-muted-foreground">
              {t(`cancelReasons.${view.cancelReason}`)}
            </span>
          )}
        </div>

        {paused && (
          <p role="status" className="flex items-center gap-2 text-sm text-warning-interactive">
            <Pause aria-hidden className="size-4" />
            {t("paused")}
          </p>
        )}
        {view.status === "WAITING" && view.courseLiveLabel && (
          <p className="flex items-center gap-2 text-sm text-info-interactive">
            <CalendarClock aria-hidden className="size-4" />
            {t("sendsWhenLive", { date: view.courseLiveLabel })}
          </p>
        )}
        {view.status === "SCHEDULED" && view.scheduledLabel && (
          <p className="flex items-center gap-2 text-sm text-info-interactive">
            <CalendarClock aria-hidden className="size-4" />
            {t("scheduledFor", { date: view.scheduledLabel })}
          </p>
        )}

        {view.recipientCount > 0 && <Progress value={percent} aria-label={t("progressTitle")} />}
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {(
            [
              ["recipients", view.recipientCount],
              ["sent", view.sentCount],
              ["failed", view.failedCount],
              ["skipped", view.skippedCount],
              ["pending", view.pendingCount],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-0.5 rounded-md border p-3">
              <dt className="text-xs text-muted-foreground">{t(`counts.${key}`)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          {view.startedLabel && t("startedAt", { date: view.startedLabel })}
          {view.finishedLabel && ` · ${t("finishedAt", { date: view.finishedLabel })}`}{" "}
          <Link
            href={`/keystone/settings/email/log?campaign=${encodeURIComponent(view.id)}`}
            className="font-medium text-primary-interactive underline-offset-4 hover:underline"
          >
            {t("viewDeliveryLog")}
          </Link>
        </p>

        {canSend && (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            {(view.status === "SCHEDULED" || view.status === "WAITING") && (
              <Button
                type="button"
                variant="outline"
                loading={pending}
                onClick={() =>
                  run(async () =>
                    report(await unscheduleAnnouncementAction(view.id), t("unscheduled")),
                  )
                }
              >
                {t("unschedule")}
              </Button>
            )}
            {view.failedCount > 0 && (view.status === "SENT" || view.status === "SENDING") && (
              <Button
                type="button"
                variant="outline"
                loading={pending}
                onClick={() =>
                  run(async () => {
                    const result = await retryFailedAnnouncementAction(view.id);
                    report(result, result.ok ? t("retried", { count: result.retried }) : "");
                  })
                }
              >
                <RotateCcw aria-hidden data-icon="inline-start" />
                {t("retryFailed")}
              </Button>
            )}
            {inFlight && (
              <Button
                type="button"
                variant="destructive"
                loading={pending}
                onClick={() => setConfirmCancel(true)}
              >
                <Square aria-hidden data-icon="inline-start" />
                {t("cancelSend")}
              </Button>
            )}
          </div>
        )}
      </EditorSection>

      <EditorSection title={t("summaryTitle")} description={t("summaryDescription")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {view.kind === "COURSE" ? (
            <>
              <dt className="text-muted-foreground">{t("fieldCourse")}</dt>
              <dd>{view.courseTitle ?? t("courseMissing")}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted-foreground">{t("columnKind")}</dt>
              <dd>{t(`kinds.${view.kind}`)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("fieldSubject")}</dt>
          <dd>{view.subject}</dd>
          {view.message && (
            <>
              <dt className="text-muted-foreground">{t("fieldMessage")}</dt>
              <dd className="whitespace-pre-line">{view.message}</dd>
            </>
          )}
          {/* A direct email has one recipient and no groups. */}
          {view.audienceKeys.length > 0 && (
            <>
              <dt className="text-muted-foreground">{t("audienceTitle")}</dt>
              <dd className="flex flex-wrap gap-1">
                {view.audienceKeys.map((key) => (
                  <Badge key={key} variant="outline">
                    {t(`audiences.${key}.label`)}
                  </Badge>
                ))}
              </dd>
            </>
          )}
        </dl>
      </EditorSection>

      {failures !== null && view.failedCount > 0 && (
        <EditorSection
          title={t("failuresTitle")}
          description={t("failuresDescription")}
          accent="danger"
          icon={TriangleAlert}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {tAdmin("emailCol")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t("failureReason")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("failureAttempts")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {failures.map((row) => (
                  <tr key={row.email} className="border-b last:border-0">
                    <td className="py-2 pe-3">{row.email}</td>
                    <td className="py-2 pe-3 text-muted-foreground">
                      {t(`sendErrors.${row.lastError ?? "transient"}`)}
                    </td>
                    <td className="py-2 text-end tabular-nums">{row.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EditorSection>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("confirmCancelTitle")}
        description={t("confirmCancelBody", { count: view.pendingCount })}
        confirmLabel={t("cancelSend")}
        cancelLabel={tAdmin("cancel")}
        onConfirm={() =>
          run(async () => report(await cancelAnnouncementAction(view.id), t("cancelled")))
        }
      />
    </div>
  );
}
