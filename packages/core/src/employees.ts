// Employee services (Module 10). Users are identity/access; employees are
// HR context (separate tables, nullable userId link — architecture doc
// §6.2). Offboarding is the one that matters: employee → TERMINATED, the
// linked login deactivated, and its sessions revoked — ONE transaction,
// because a terminated employee with a still-live admin session is
// precisely the incident this feature exists to prevent.
import { revalidateTag } from "next/cache";
import { db, EmploymentStatus, UserStatus, type EmploymentType } from "@repo/db";
import { recordAudit } from "./index.ts";
import { recordNotification } from "./notifications.ts";

export interface EmployeeRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  status: EmploymentStatus;
  departmentName: string | null;
  designationTitle: string | null;
  reportingToId: string | null;
  userId: string | null;
}

export async function listEmployees(): Promise<EmployeeRow[]> {
  const rows = await db.employee.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
    include: { department: { select: { name: true } }, designation: { select: { title: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    workEmail: e.workEmail,
    status: e.status,
    departmentName: e.department?.name ?? null,
    designationTitle: e.designation?.title ?? null,
    reportingToId: e.reportingToId,
    userId: e.userId,
  }));
}

/**
 * Offboarding, atomically. `_afterStatusWrite` is a test-only fault
 * injection point (the SKILL.md-required atomicity test): it runs INSIDE
 * the transaction after the employee/user writes — a throw there must
 * roll everything back, or the feature is a liability rather than a
 * safeguard.
 */
export async function offboardEmployee(
  actorId: string,
  employeeId: string,
  _afterStatusWrite?: () => Promise<void> | void,
): Promise<void> {
  const employee = await db.employee.findUniqueOrThrow({ where: { id: employeeId } });

  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { status: EmploymentStatus.TERMINATED, exitedAt: new Date() },
    });
    if (employee.userId) {
      await tx.user.update({
        where: { id: employee.userId },
        data: { status: UserStatus.INACTIVE },
      });
      await tx.session.deleteMany({ where: { userId: employee.userId } });
    }
    await _afterStatusWrite?.();
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "employees.offboard",
        entityType: "employee",
        entityId: employeeId,
        changes: {
          before: { status: employee.status },
          after: { status: EmploymentStatus.TERMINATED, userDeactivated: Boolean(employee.userId) },
        } as never,
      },
    });
  });

  if (employee.userId) revalidateTag(`rbac:${employee.userId}`, { expire: 0 });
}

export interface OrgChartNode extends EmployeeRow {
  reports: OrgChartNode[];
}

/** Org chart from reportingToId — roots are employees who report to nobody (or to someone soft-deleted). */
export function buildOrgChart(rows: EmployeeRow[]): OrgChartNode[] {
  const byId = new Map(rows.map((r) => [r.id, { ...r, reports: [] as OrgChartNode[] }]));
  const roots: OrgChartNode[] = [];
  for (const node of byId.values()) {
    const parent = node.reportingToId ? byId.get(node.reportingToId) : undefined;
    if (parent && parent.id !== node.id) parent.reports.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function recordEmployeeUpdate(
  actorId: string,
  employeeId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    location?: string | null;
    departmentId?: string | null;
    designationId?: string | null;
    reportingToId?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const before = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      location: true,
      departmentId: true,
      designationId: true,
      reportingToId: true,
      notes: true,
    },
  });
  await db.employee.update({ where: { id: employeeId }, data });
  await recordAudit({
    userId: actorId,
    action: "employees.update",
    entityType: "employee",
    entityId: employeeId,
    changes: { before, after: data },
  });
}

// ─── Detail page (changes-01) ────────────────────────────────

export interface EmployeeDetail extends EmployeeRow {
  personalEmail: string | null;
  phone: string | null;
  photoUrl: string | null;
  location: string | null;
  employmentType: EmploymentType;
  joinedAt: Date;
  confirmedAt: Date | null;
  exitedAt: Date | null;
  notes: string | null;
  departmentId: string | null;
  designationId: string | null;
  reportingToName: string | null;
  linkedUser: { id: string; email: string; status: UserStatus; roleKeys: string[] } | null;
}

export async function loadEmployeeDetail(employeeId: string): Promise<EmployeeDetail | null> {
  const e = await db.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: {
      department: { select: { name: true } },
      designation: { select: { title: true } },
      reportingTo: { select: { firstName: true, lastName: true } },
      user: {
        select: {
          id: true,
          email: true,
          status: true,
          roles: { select: { role: { select: { key: true } } } },
        },
      },
    },
  });
  if (!e) return null;
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    workEmail: e.workEmail,
    status: e.status,
    departmentName: e.department?.name ?? null,
    designationTitle: e.designation?.title ?? null,
    reportingToId: e.reportingToId,
    userId: e.userId,
    personalEmail: e.personalEmail,
    phone: e.phone,
    photoUrl: e.photoUrl,
    location: e.location,
    employmentType: e.employmentType,
    joinedAt: e.joinedAt,
    confirmedAt: e.confirmedAt,
    exitedAt: e.exitedAt,
    notes: e.notes,
    departmentId: e.departmentId,
    designationId: e.designationId,
    reportingToName: e.reportingTo ? `${e.reportingTo.firstName} ${e.reportingTo.lastName}` : null,
    linkedUser: e.user
      ? {
          id: e.user.id,
          email: e.user.email,
          status: e.user.status,
          roleKeys: e.user.roles.map((r) => r.role.key),
        }
      : null,
  };
}

/**
 * Status dropdown transitions only — TERMINATED is deliberately impossible
 * here; that path is offboardEmployee's transaction (deactivate + revoke),
 * and a dropdown write that skipped it would leave live sessions behind.
 */
export async function setEmployeeStatus(
  actorId: string,
  employeeId: string,
  status: Exclude<EmploymentStatus, "TERMINATED">,
): Promise<void> {
  const before = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: { status: true, userId: true },
  });
  if (before.status === EmploymentStatus.TERMINATED) {
    throw new Error("A terminated employee's status cannot be changed here");
  }
  await db.employee.update({ where: { id: employeeId }, data: { status } });
  await recordAudit({
    userId: actorId,
    action: "employees.setStatus",
    entityType: "employee",
    entityId: employeeId,
    changes: { before: { status: before.status }, after: { status } },
  });
  if (before.userId) {
    const linked = await db.user.findUnique({
      where: { id: before.userId },
      select: { userType: true },
    });
    if (linked?.userType === "STAFF") {
      await recordNotification({
        userId: before.userId,
        type: "employeeStatus",
        detail: status,
        href: "/admin/profile",
      });
    }
  }
}

export async function listDepartments(): Promise<{ id: string; name: string }[]> {
  return db.department.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

export async function listDesignations(): Promise<{ id: string; title: string }[]> {
  return db.designation.findMany({
    where: { isActive: true },
    orderBy: { level: "asc" },
    select: { id: true, title: true },
  });
}
