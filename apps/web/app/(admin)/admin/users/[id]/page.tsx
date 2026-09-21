import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Activity,
  BookOpen,
  CalendarClock,
  FileText,
  GraduationCap,
  KeyRound,
  Laptop,
  ListChecks,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  loadAssignableRoles,
  loadLearnerActivity,
  loadRoleMatrix,
  loadUserDetail,
} from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { Badge } from "@repo/ui/components/badge";
import { Progress } from "@repo/ui/components/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { formatDate, formatDateTime, humanizeKey } from "@repo/utils";
import { AdminPage, AdminSection } from "../../_components/admin-page.tsx";
import { permissionGroupLabel } from "../../_components/permission-groups.ts";
import {
  RecordCard,
  RecordEmpty,
  RecordFacts,
  RecordStat,
  RecordStats,
} from "../../_components/record-page.tsx";
import { StatusBadge, USER_STATUS_TONE, statusTone } from "../../_components/status-badge.tsx";
import { OverrideControls, ResetPasswordButton, RoleControls } from "./detail-controls.tsx";
import {
  ControlTile,
  EditUserButton,
  type EditUserLabels,
  type EditUserValues,
  ImpersonateButton,
  RefreshButton,
  RevokeSessionsButton,
} from "./record-actions.tsx";

// The user record (changes-45 — the owner's reference user page): the
// person's name as the heading with their id and address under it, a row of
// figures, the account's switches, then TABS — details, progress per module
// (courses, lessons, quizzes, reading), roles and overrides, devices, and the
// audit trail. Subscribers and employees take the same shape
// (`_components/record-page.tsx`).
//
// IDOR discipline (security.md #7): the load is scoped to non-deleted users
// and 404s when absent. Every control re-checks its own permission in its
// server action; which ones render here is UX.
export default async function UserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const subject = await requirePermission("users.view");
  const { id } = await params;

  const [t, r, user, roles, matrix] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.userRecord"),
    loadUserDetail(id),
    loadAssignableRoles(),
    loadRoleMatrix(),
  ]);
  if (!user) notFound();

  const isLearner = user.userType === "LEARNER";
  // The admin is English-only (ADR-043 #2), so titles resolve in `en`.
  const activity = isLearner ? await loadLearnerActivity(user.id, "en") : null;

  const permissionOptions = matrix.groups.flatMap((group) => {
    const groupLabel = permissionGroupLabel(t, group.groupName);
    return group.permissions.map((permission) => ({
      value: permission.key,
      label: `${groupLabel} · ${permission.label}`,
    }));
  });
  const canUpdate = can(subject, "users.update");
  const canAssign = can(subject, "permissions.assign");
  const canResetPassword = can(subject, "users.password.reset");
  // Only a live learner can be entered — the same rule the service enforces,
  // so the button is not offered where the action would refuse.
  const canImpersonate =
    can(subject, "users.impersonate") && isLearner && user.status !== "SUSPENDED";

  const statusLabels: Record<string, string> = {
    ACTIVE: t("statusActive"),
    INACTIVE: t("statusInactive"),
    SUSPENDED: t("statusSuspended"),
    PENDING_VERIFICATION: t("statusPending"),
  };
  const confirmLabels = {
    confirmTitle: t("confirmTitle"),
    confirm: t("confirm"),
    cancel: t("cancel"),
  };
  const yesNo = (value: boolean, yes: string, no: string) => (
    <Badge variant={value ? "success" : "secondary"}>{value ? yes : no}</Badge>
  );

  const editInitial: EditUserValues = {
    userId: user.id,
    email: user.email,
    firstName: user.firstName ?? user.name,
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
    status: user.status as EditUserValues["status"],
    emailVerified: user.emailVerified,
  };

  const summary = activity?.summary;

  const editLabels: EditUserLabels = {
    action: r("edit"),
    iconAction: r("editIcon"),
    title: r("editTitle"),
    description: r("editDescription", { email: user.email }),
    email: t("emailCol"),
    emailHint: r("emailHint"),
    emailInUse: r("emailInUse"),
    emailForbidden: r("emailForbidden"),
    firstName: r("firstName"),
    lastName: r("lastName"),
    phone: t("phoneCol"),
    status: t("status"),
    emailVerified: r("emailVerified"),
    emailVerifiedHint: r("emailVerifiedHint"),
    save: r("save"),
    cancel: t("cancel"),
    saved: r("saved"),
  };

  return (
    <AdminPage
      title={user.name}
      description={`${r("userId")}: ${user.id} • ${user.email}`}
      backHref="/admin/users"
      backLabel={t("backToList")}
      meta={
        <>
          <Badge variant="outline">{isLearner ? t("typeLearner") : t("typeStaff")}</Badge>
          <StatusBadge tone={statusTone(USER_STATUS_TONE, user.status)}>
            {statusLabels[user.status] ?? user.status}
          </StatusBadge>
        </>
      }
      actions={
        <>
          <RefreshButton label={r("refresh")} />
          {canImpersonate && (
            <ImpersonateButton
              userId={user.id}
              userLabel={user.email}
              labels={{
                action: r("impersonate"),
                title: r("impersonateTitle"),
                description: r("impersonateDescription"),
                confirm: r("impersonateConfirm"),
                cancel: t("cancel"),
                failed: r("impersonateFailed"),
              }}
            />
          )}
          {canUpdate && (
            <EditUserButton initial={editInitial} statusLabels={statusLabels} labels={editLabels} />
          )}
          {canResetPassword && (
            <ResetPasswordButton
              userId={user.id}
              userLabel={user.email}
              labels={{
                resetPassword: t("resetPassword"),
                resetDescription: t("resetPasswordDescription"),
                newPassword: t("newPassword"),
                generate: t("generatePassword"),
                confirm: t("confirm"),
                cancel: t("cancel"),
                done: t("resetPasswordDone"),
              }}
            />
          )}
        </>
      }
    >
      <RecordStats>
        {summary ? (
          <>
            <RecordStat
              icon={BookOpen}
              label={r("statCourses")}
              value={summary.coursesStarted}
              detail={r("statCoursesDetail", { count: summary.coursesCompleted })}
            />
            <RecordStat
              icon={ListChecks}
              label={r("statLessons")}
              value={summary.lessonsCompleted}
            />
            <RecordStat
              icon={Trophy}
              label={r("statQuizzes")}
              value={summary.quizzesPassed}
              detail={r("statQuizzesDetail", { count: summary.quizAttempts })}
            />
            <RecordStat icon={FileText} label={r("statArticles")} value={summary.articlesRead} />
          </>
        ) : (
          <>
            <RecordStat icon={UsersRound} label={t("rolesCol")} value={user.roleKeys.length} />
            <RecordStat icon={KeyRound} label={t("overrides")} value={user.overrides.length} />
            <RecordStat icon={Laptop} label={r("statSessions")} value={user.sessions.length} />
            <RecordStat
              icon={CalendarClock}
              label={t("lastLogin")}
              value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}
            />
          </>
        )}
      </RecordStats>

      <RecordCard
        icon={ShieldCheck}
        title={r("controlsTitle")}
        description={r("controlsDescription")}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ControlTile
            label={r("emailVerified")}
            hint={r("emailVerifiedHint")}
            checked={user.emailVerified}
            action={canUpdate ? { kind: "emailVerified", userId: user.id } : undefined}
          />
          <ControlTile
            label={r("accountActive")}
            hint={r("accountActiveHint")}
            checked={user.status === "ACTIVE"}
            action={canUpdate ? { kind: "active", userId: user.id } : undefined}
            confirm={{
              title: t("confirmTitle"),
              description: r("deactivateDescription"),
              confirm: t("confirm"),
              cancel: t("cancel"),
            }}
          />
          <ControlTile
            label={r("twoFactor")}
            hint={r("twoFactorHint")}
            checked={user.twoFactorEnabled}
          />
          <ControlTile
            label={r("newsletter")}
            hint={r("newsletterHint")}
            checked={user.newsletter?.status === "CONFIRMED"}
          />
        </div>
      </RecordCard>

      <Tabs defaultValue="details">
        {/* The reference's segmented tray, no underline (changes-46, image-107). */}
        <TabsList className="w-full">
          <TabsTrigger value="details">
            <UserRound aria-hidden /> {r("tabDetails")}
          </TabsTrigger>
          {activity && (
            <>
              <TabsTrigger value="courses">
                <BookOpen aria-hidden /> {r("tabCourses")}
              </TabsTrigger>
              <TabsTrigger value="lessons">
                <GraduationCap aria-hidden /> {r("tabLessons")}
              </TabsTrigger>
              <TabsTrigger value="quizzes">
                <Trophy aria-hidden /> {r("tabQuizzes")}
              </TabsTrigger>
              <TabsTrigger value="reading">
                <FileText aria-hidden /> {r("tabReading")}
              </TabsTrigger>
            </>
          )}
          {canAssign && (
            <TabsTrigger value="access">
              <KeyRound aria-hidden /> {r("tabAccess")}
            </TabsTrigger>
          )}
          <TabsTrigger value="devices">
            <Laptop aria-hidden /> {r("tabDevices")}
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity aria-hidden /> {r("tabActivity")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecordCard
              icon={UserRound}
              title={t("personalInformation")}
              description={r("personalDescription")}
              action={
                canUpdate ? (
                  <EditUserButton
                    trigger="icon"
                    initial={editInitial}
                    statusLabels={statusLabels}
                    labels={editLabels}
                  />
                ) : undefined
              }
            >
              <RecordFacts
                facts={[
                  { label: r("fullName"), value: user.name },
                  { label: r("firstName"), value: user.firstName },
                  { label: r("lastName"), value: user.lastName },
                  { label: t("emailCol"), value: user.email },
                  { label: t("phoneCol"), value: user.phone },
                  { label: r("language"), value: user.locale.toUpperCase() },
                  { label: r("timezone"), value: user.timezone },
                  { label: r("userId"), value: <span className="text-xs">{user.id}</span> },
                ]}
              />
            </RecordCard>

            <RecordCard
              icon={ShieldCheck}
              title={r("statusTitle")}
              description={r("statusDescription")}
            >
              <RecordFacts
                facts={[
                  {
                    label: t("status"),
                    value: (
                      <StatusBadge tone={statusTone(USER_STATUS_TONE, user.status)}>
                        {statusLabels[user.status] ?? user.status}
                      </StatusBadge>
                    ),
                  },
                  {
                    label: r("accountType"),
                    value: isLearner ? t("typeLearner") : t("typeStaff"),
                  },
                  {
                    label: t("rolesCol"),
                    value:
                      user.roleKeys.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {user.roleKeys.map((key) => (
                            <Badge key={key} variant="secondary">
                              {humanizeKey(key)}
                            </Badge>
                          ))}
                        </span>
                      ) : null,
                  },
                  {
                    label: r("emailVerified"),
                    value: yesNo(user.emailVerified, r("verified"), r("notVerified")),
                  },
                  {
                    label: r("twoFactor"),
                    value: yesNo(user.twoFactorEnabled, r("enabled"), r("disabled")),
                  },
                  {
                    label: r("newsletter"),
                    value: user.newsletter
                      ? humanizeKey(user.newsletter.status.toLowerCase())
                      : r("notSubscribed"),
                  },
                  { label: r("registered"), value: formatDateTime(user.createdAt) },
                  {
                    label: t("lastLogin"),
                    value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : null,
                  },
                  { label: r("lastLoginIp"), value: user.lastLoginIp },
                  {
                    label: r("lockedUntil"),
                    value:
                      user.lockedUntil && user.lockedUntil > new Date()
                        ? formatDateTime(user.lockedUntil)
                        : null,
                  },
                ]}
              />
            </RecordCard>
          </div>
        </TabsContent>

        {activity && (
          <>
            <TabsContent value="courses" className="pt-4">
              <RecordCard
                icon={BookOpen}
                title={r("tabCourses")}
                description={r("coursesDescription")}
              >
                {activity.courses.length === 0 ? (
                  <RecordEmpty>{r("coursesEmpty")}</RecordEmpty>
                ) : (
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {activity.courses.map((course) => (
                      <li
                        key={course.courseId}
                        className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-2 md:items-center"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium">{course.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {r("lessonsOf", {
                              done: course.lessonsCompleted,
                              total: course.lessonsTotal,
                            })}{" "}
                            · {r("lastActive", { date: formatDate(new Date(course.lastActiveAt)) })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={course.percent}
                            aria-label={course.title}
                            className="flex-1"
                          />
                          <span className="w-12 text-end text-sm font-semibold tabular-nums">
                            {course.percent}%
                          </span>
                          {course.isCompleted && <Badge variant="success">{r("completed")}</Badge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </RecordCard>
            </TabsContent>

            <TabsContent value="lessons" className="pt-4">
              <RecordCard
                icon={GraduationCap}
                title={r("tabLessons")}
                description={r("lessonsDescription")}
              >
                {activity.lessonReads.length === 0 ? (
                  <RecordEmpty>{r("lessonsEmpty")}</RecordEmpty>
                ) : (
                  <RecordFacts
                    facts={activity.lessonReads.map((lesson) => ({
                      id: lesson.href,
                      label: `${lesson.title} — ${lesson.courseTitle}`,
                      value: (
                        <span className="flex flex-wrap items-center gap-2">
                          {lesson.isCompleted ? (
                            <Badge variant="success">{r("completed")}</Badge>
                          ) : (
                            <Badge variant="secondary">{r("opened")}</Badge>
                          )}
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatDateTime(new Date(lesson.viewedAt))}
                          </span>
                        </span>
                      ),
                    }))}
                  />
                )}
              </RecordCard>
            </TabsContent>

            <TabsContent value="quizzes" className="pt-4">
              <RecordCard
                icon={Trophy}
                title={r("tabQuizzes")}
                description={r("quizzesDescription")}
              >
                {activity.quizAttempts.length === 0 ? (
                  <RecordEmpty>{r("quizzesEmpty")}</RecordEmpty>
                ) : (
                  <RecordFacts
                    facts={activity.quizAttempts.map((attempt) => ({
                      id: attempt.attemptId,
                      label: attempt.title,
                      value: (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="tabular-nums">{attempt.percentage}%</span>
                          <Badge variant={attempt.passed ? "success" : "warning"}>
                            {attempt.passed ? r("passed") : r("notPassed")}
                          </Badge>
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatDateTime(new Date(attempt.completedAt))}
                          </span>
                        </span>
                      ),
                    }))}
                  />
                )}
              </RecordCard>
            </TabsContent>

            <TabsContent value="reading" className="pt-4">
              <RecordCard
                icon={FileText}
                title={r("tabReading")}
                description={r("readingDescription")}
              >
                {activity.reads.length === 0 ? (
                  <RecordEmpty>{r("readingEmpty")}</RecordEmpty>
                ) : (
                  <RecordFacts
                    facts={activity.reads.map((read) => ({
                      id: `${read.kind}:${read.href}`,
                      label: read.title,
                      value: (
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{humanizeKey(read.kind.toLowerCase())}</Badge>
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatDateTime(new Date(read.readAt))}
                          </span>
                        </span>
                      ),
                    }))}
                  />
                )}
              </RecordCard>
            </TabsContent>
          </>
        )}

        {canAssign && (
          <TabsContent value="access" className="flex flex-col gap-6 pt-4">
            <AdminSection title={t("rolesCol")}>
              <RoleControls
                userId={user.id}
                currentRoles={user.roleKeys}
                availableRoles={roles}
                labels={{
                  assignRole: t("assignRole"),
                  remove: t("removeRole"),
                  confirmRemoveRole: t("confirmRemoveRole"),
                  level: t("level"),
                  ...confirmLabels,
                }}
              />
            </AdminSection>
            <AdminSection title={t("overrides")}>
              <OverrideControls
                userId={user.id}
                overrides={user.overrides}
                permissionOptions={permissionOptions}
                labels={{
                  addOverride: t("addOverride"),
                  reason: t("reason"),
                  allow: t("allow"),
                  deny: t("deny"),
                  permission: t("permission"),
                  remove: t("removeRole"),
                  confirmRemoveOverride: t("confirmRemoveOverride"),
                  ...confirmLabels,
                }}
              />
            </AdminSection>
          </TabsContent>
        )}

        <TabsContent value="devices" className="pt-4">
          <RecordCard
            icon={Laptop}
            title={r("tabDevices")}
            description={r("devicesDescription")}
            action={
              canUpdate && user.sessions.length > 0 && user.id !== subject.id ? (
                <RevokeSessionsButton
                  userId={user.id}
                  labels={{
                    action: r("revokeSessions"),
                    title: r("revokeSessionsTitle"),
                    description: r("revokeSessionsDescription"),
                    confirm: t("confirm"),
                    cancel: t("cancel"),
                    done: r("revokeSessionsDone"),
                  }}
                />
              ) : undefined
            }
          >
            {user.sessions.length === 0 ? (
              <RecordEmpty>{r("devicesEmpty")}</RecordEmpty>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {user.sessions.map((session) => (
                  <li key={session.id} className="flex flex-col gap-1 px-4 py-3">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="line-clamp-1">
                        {session.userAgent ?? r("unknownDevice")}
                      </span>
                      {session.impersonated && <Badge variant="warning">{r("impersonated")}</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session.ipAddress ?? "—"} ·{" "}
                      {r("sessionStarted", { date: formatDateTime(session.createdAt) })} ·{" "}
                      {r("sessionExpires", { date: formatDateTime(session.expiresAt) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </RecordCard>
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <RecordCard
            icon={Activity}
            title={r("tabActivity")}
            description={r("activityDescription")}
          >
            {user.activity.length === 0 ? (
              <RecordEmpty>{r("activityEmpty")}</RecordEmpty>
            ) : (
              <RecordFacts
                facts={user.activity.map((entry) => ({
                  id: entry.id,
                  label: humanizeKey(entry.action.replace(/\./g, "_")),
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>
                        {entry.aboutThisUser
                          ? r("byActor", { name: entry.actorName ?? r("system") })
                          : r("bySelf")}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </span>
                  ),
                }))}
              />
            )}
          </RecordCard>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
