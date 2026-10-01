import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  AnnouncementNotFoundError,
  getAnnouncement,
  getCustomEmailDraft,
  listFailedRecipients,
  type AnnouncementDetail as Detail,
} from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { can, requirePermission } from "@repo/rbac";
import { formatDateTime } from "@repo/utils";
import { EditorPage } from "../../_components/admin-page.tsx";
import { richTextLabels } from "../../_components/editor-labels.ts";
import { AnnouncementDetail } from "../_components/announcement-detail.tsx";
import { AnnouncementEditor } from "../_components/announcement-editor.tsx";
import { CustomEmailEditor } from "../_components/custom-email-editor.tsx";
import { loadCustomEditorProps, parseCustomStep } from "../_lib/custom-editor-data.ts";
import { loadEditorProps, parseStep } from "../_lib/editor-data.ts";
import { displayStatus } from "../_lib/labels.ts";

// One announcement (ADR-171, changes-54 §10.3–10.4): the four-step editor
// while it is a DRAFT, and its progress once it has left draft — a campaign
// that has started is history, and editing it would change nothing that went.
export default async function AnnouncementPage({
  params,
  searchParams,
}: PageProps<"/keystone/announcements/[id]">) {
  const subject = await requirePermission("announcements.view");
  const [{ id }, query, t] = await Promise.all([params, searchParams, getTranslations("admin")]);

  let detail: Detail;
  try {
    detail = await getAnnouncement(subject, id);
  } catch (error) {
    // IDOR-shaped: an id that is not there is a 404, not a 500 (security.md #7).
    if (error instanceof AnnouncementNotFoundError) notFound();
    throw error;
  }

  // A custom email's draft opens its own three-step composer (ADR-172).
  if (
    detail.kind === "CUSTOM" &&
    detail.status === "DRAFT" &&
    can(subject, "announcements.create")
  ) {
    const props = await loadCustomEditorProps(subject, {
      detail,
      step: parseCustomStep(query.step),
      editorLabels: richTextLabels(t),
    });
    return (
      <EditorPage
        title={t("announcements.editHeading", { name: detail.name })}
        description={t("announcements.custom.editorDescription")}
        backHref="/keystone/announcements"
        backLabel={t("nav.announcements")}
      >
        <CustomEmailEditor {...props} />
      </EditorPage>
    );
  }

  if (
    detail.kind === "COURSE" &&
    detail.status === "DRAFT" &&
    can(subject, "announcements.create")
  ) {
    const props = await loadEditorProps(subject, {
      detail,
      courseId: null,
      step: parseStep(query.step),
      defaultName: (title) => t("announcements.defaultName", { title }),
    });
    return (
      <EditorPage
        title={t("announcements.editHeading", { name: detail.name })}
        description={t("announcements.editorDescription")}
        backHref="/keystone/announcements"
        backLabel={t("nav.announcements")}
      >
        <AnnouncementEditor {...props} />
      </EditorPage>
    );
  }

  const failures = can(subject, "email.log.view") ? await listFailedRecipients(subject, id) : null;
  // A custom or direct email's subject is its own words, in the default
  // language; a course announcement's is its override or the template's.
  const ownWords =
    detail.kind === "COURSE" ? null : (await getCustomEmailDraft(subject, id)).contents;
  const status = displayStatus(detail.status, detail.waitingForTarget);

  return (
    <EditorPage
      title={t("announcements.editHeading", { name: detail.name })}
      description={t("announcements.detailDescription")}
      backHref="/keystone/announcements"
      backLabel={t("nav.announcements")}
    >
      <AnnouncementDetail
        view={{
          id: detail.id,
          kind: detail.kind,
          status,
          courseTitle: detail.targetTitle,
          subject: ownWords
            ? ((ownWords.find((row) => row.locale === routing.defaultLocale) ?? ownWords[0])
                ?.subject ?? "—")
            : (detail.subject ?? t("announcements.templateSubject")),
          message: detail.message,
          audienceKeys: detail.audienceKeys,
          recipientCount: detail.recipientCount,
          sentCount: detail.sentCount,
          failedCount: detail.failedCount,
          skippedCount: detail.skippedCount,
          pendingCount: detail.pendingCount,
          startedLabel: detail.startedAt ? formatDateTime(detail.startedAt) : null,
          finishedLabel: detail.finishedAt ? formatDateTime(detail.finishedAt) : null,
          scheduledLabel: detail.scheduledFor ? formatDateTime(detail.scheduledFor) : null,
          courseLiveLabel: detail.targetScheduledFor
            ? formatDateTime(detail.targetScheduledFor)
            : null,
          cancelReason: detail.cancelReason,
          blockers: detail.blockers,
          renderedAt: new Date().toISOString(),
        }}
        failures={failures}
        canSend={can(subject, "announcements.send")}
      />
    </EditorPage>
  );
}
