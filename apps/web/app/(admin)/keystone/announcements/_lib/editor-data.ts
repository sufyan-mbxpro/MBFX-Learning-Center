// The server half of the announcement editor (ADR-171): everything the four
// steps need, loaded once per render through `@repo/core` (never Prisma —
// architecture.md #2). Shared by `new` and `[id]`, so both open the same
// editor with the same data.
import {
  announceableCourseById,
  announcementComposeContext,
  announcementCourseTitles,
  announcementUsersById,
  ownTestAddress,
  previousAnnouncementsOf,
  summariseAudience,
  type AnnouncementDetail,
} from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { can, type Subject } from "@repo/rbac";
import type { AnnouncementEditorProps } from "../_components/announcement-editor.tsx";
import { ANNOUNCEMENT_STEPS, type AnnouncementStep } from "./steps.ts";

export function parseStep(value: string | string[] | undefined): AnnouncementStep | null {
  const one = Array.isArray(value) ? value[0] : value;
  return (ANNOUNCEMENT_STEPS as readonly string[]).includes(one ?? "")
    ? (one as AnnouncementStep)
    : null;
}

export async function loadEditorProps(
  subject: Subject,
  options: {
    detail: AnnouncementDetail | null;
    courseId: string | null;
    step: AnnouncementStep | null;
    defaultName: (title: string) => string;
  },
): Promise<AnnouncementEditorProps> {
  const { detail } = options;
  const courseId = detail?.targetId ?? options.courseId;
  const audience = detail?.audience ?? null;
  const canPickUsers = can(subject, "users.view");

  const [course, previous, compose, activeLocales, courseTitles, users, summary, testAddress] =
    await Promise.all([
      courseId ? announceableCourseById(subject, courseId) : null,
      courseId ? previousAnnouncementsOf(subject, courseId, detail?.id) : [],
      announcementComposeContext(subject),
      getActiveLocales(),
      announcementCourseTitles(subject, audience?.courseIds ?? []),
      canPickUsers ? announcementUsersById(subject, audience?.userIds ?? []) : [],
      courseId ? summariseAudience(subject, courseId, audience) : null,
      ownTestAddress(subject),
    ]);

  const defaultLocale = routing.defaultLocale;
  const locales = [
    defaultLocale,
    ...activeLocales.map((locale) => locale.code).filter((code) => code !== defaultLocale),
  ];

  return {
    initial: {
      id: detail?.id ?? null,
      name: detail?.name ?? (course ? options.defaultName(course.title) : ""),
      targetId: course?.id ?? "",
      subject: detail?.subject ?? "",
      message: detail?.message ?? "",
      keys: detail?.audienceKeys ?? [],
    },
    // A new draft opens on step 1; a saved one where the URL says, else the
    // first step it has not finished.
    initialStep:
      options.step ??
      (!detail ? "content" : detail.audienceKeys.length === 0 ? "audience" : "review"),
    course: course
      ? {
          id: course.id,
          title: course.title,
          track: course.track,
          difficulty: course.difficulty,
          availability: course.availability,
          scheduledFor: course.scheduledFor ? course.scheduledFor.toISOString() : null,
        }
      : null,
    previousSends: previous.map((row) => ({
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      recipientCount: row.recipientCount,
    })),
    compose,
    locales,
    audienceCourses: courseTitles,
    audienceUsers: users,
    summary,
    blockers: detail?.blockers ?? [],
    canSend: can(subject, "announcements.send"),
    canPickUsers,
    testAddress,
  };
}
