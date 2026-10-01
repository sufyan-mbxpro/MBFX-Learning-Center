// The server half of the custom email composer (ADR-172): everything its three
// steps need, through `@repo/core` (never Prisma — architecture.md #2). Shared
// by `new?kind=custom` and `[id]`, like `editor-data.ts` for announcements.
import {
  announcementComposeContext,
  announcementCourseTitles,
  announcementUsersById,
  getCustomEmailDraft,
  listEmailDesigns,
  ownTestAddress,
  summariseAudience,
  type AnnouncementDetail,
} from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, type Subject } from "@repo/rbac";
import type { RichTextLabels } from "../../_components/rich-text-editor.tsx";
import type { CustomEmailEditorProps } from "../_components/custom-email-editor.tsx";
import { CUSTOM_EMAIL_STEPS, type CustomEmailStep } from "./steps.ts";

export function parseCustomStep(value: string | string[] | undefined): CustomEmailStep | null {
  const one = Array.isArray(value) ? value[0] : value;
  return (CUSTOM_EMAIL_STEPS as readonly string[]).includes(one ?? "")
    ? (one as CustomEmailStep)
    : null;
}

export async function loadCustomEditorProps(
  subject: Subject,
  options: {
    detail: AnnouncementDetail | null;
    step: CustomEmailStep | null;
    editorLabels: RichTextLabels;
  },
): Promise<CustomEmailEditorProps> {
  const { detail } = options;
  const audience = detail?.audience ?? null;
  const canPickUsers = can(subject, "users.view");

  const [draft, designs, activeLocales, courseTitles, users, summary, testAddress, compose] =
    await Promise.all([
      detail ? getCustomEmailDraft(subject, detail.id) : null,
      listEmailDesigns(subject),
      getActiveLocales(),
      announcementCourseTitles(subject, audience?.courseIds ?? []),
      canPickUsers ? announcementUsersById(subject, audience?.userIds ?? []) : [],
      summariseAudience(subject, null, audience, new Date(), "CUSTOM"),
      ownTestAddress(subject),
      // The site-wide sender a custom email goes out as (changes-59: the
      // inbox preview and the checklist's Sender row).
      announcementComposeContext(subject),
    ]);

  // The default language first: it is the one every reader falls back to.
  const defaultLocale = routing.defaultLocale;
  const locales = [
    ...activeLocales.filter((locale) => locale.code === defaultLocale),
    ...activeLocales.filter((locale) => locale.code !== defaultLocale),
  ].map((locale) => ({ code: locale.code, name: locale.name }));

  return {
    initial: {
      id: detail?.id ?? null,
      name: detail?.name ?? "",
      designId: draft?.designId ?? null,
      contents: (draft?.contents ?? []).map((row) => ({
        locale: row.locale,
        subject: row.subject,
        preheader: row.preheader ?? "",
        mode: row.mode,
        bodyHtml: row.bodyHtml,
      })),
      keys: detail?.audienceKeys ?? [],
    },
    initialStep:
      options.step ??
      (!detail || (draft?.contents.length ?? 0) === 0
        ? "content"
        : detail.audienceKeys.length === 0
          ? "audience"
          : "review"),
    locales: locales.length > 0 ? locales : [{ code: defaultLocale, name: defaultLocale }],
    designs: designs.map((design) => ({
      id: design.id,
      name: design.name,
      description: design.description,
      mode: design.mode,
      subject: design.subject,
      preheader: design.preheader,
      bodyHtml: design.bodyHtml,
    })),
    audienceCourses: courseTitles,
    audienceUsers: users,
    summary,
    blockers: detail?.blockers ?? [],
    tested: draft?.tested ?? false,
    canSend: can(subject, "announcements.send"),
    canPickUsers,
    canPickStaff: can(subject, "employees.view"),
    testAddress,
    sender: { name: compose.fromName, email: compose.fromEmail },
    editorLabels: options.editorLabels,
  };
}
