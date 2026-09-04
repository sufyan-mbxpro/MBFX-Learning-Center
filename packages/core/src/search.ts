// Global admin search (changes-01: ⌘K palette). Every section is gated by
// the SUBJECT's permissions server-side — the palette's static page index
// is UX, this is the boundary for data. Small fixed take per section: the
// palette shows "top hits", not paginated results.
import { db } from "@repo/db";
import { can, type Subject } from "@repo/rbac";

export interface AdminSearchHit {
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
}

export interface AdminSearchResults {
  users: AdminSearchHit[];
  roles: AdminSearchHit[];
  employees: AdminSearchHit[];
  settings: AdminSearchHit[];
  glossary: AdminSearchHit[];
}

const SECTION_TAKE = 5;

export async function searchAdmin(subject: Subject, query: string): Promise<AdminSearchResults> {
  const q = query.trim();
  const empty: AdminSearchResults = {
    users: [],
    roles: [],
    employees: [],
    settings: [],
    glossary: [],
  };
  if (!q) return empty;

  const [users, roles, employees, settings, glossary] = await Promise.all([
    can(subject, "users.view")
      ? db.user.findMany({
          where: {
            deletedAt: null,
            OR: [{ email: { contains: q } }, { name: { contains: q } }],
          },
          take: SECTION_TAKE,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    can(subject, "roles.view")
      ? db.role.findMany({
          where: { OR: [{ name: { contains: q } }, { key: { contains: q } }] },
          take: SECTION_TAKE,
          orderBy: { level: "desc" },
          select: { id: true, key: true, name: true },
        })
      : Promise.resolve([]),
    can(subject, "employees.view")
      ? db.employee.findMany({
          where: {
            deletedAt: null,
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { workEmail: { contains: q } },
              { employeeCode: { contains: q } },
            ],
          },
          take: SECTION_TAKE,
          orderBy: { lastName: "asc" },
          select: { id: true, firstName: true, lastName: true, workEmail: true },
        })
      : Promise.resolve([]),
    can(subject, "settings.view")
      ? db.setting.findMany({
          where: { OR: [{ key: { contains: q } }, { label: { contains: q } }] },
          take: SECTION_TAKE,
          orderBy: { key: "asc" },
          select: { key: true, label: true, groupName: true },
        })
      : Promise.resolve([]),
    can(subject, "glossary.view")
      ? db.glossaryTermTranslation.findMany({
          where: { locale: "en", term: { contains: q }, glossaryTerm: { deletedAt: null } },
          take: SECTION_TAKE,
          orderBy: { term: "asc" },
          select: { termId: true, term: true, glossaryTerm: { select: { category: true } } },
        })
      : Promise.resolve([]),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      label: u.name,
      sublabel: u.email,
      href: `/admin/users/${u.id}`,
    })),
    roles: roles.map((r) => ({
      id: r.id,
      label: r.name,
      sublabel: r.key,
      href: `/admin/roles/${r.key}`,
    })),
    employees: employees.map((e) => ({
      id: e.id,
      label: `${e.firstName} ${e.lastName}`,
      sublabel: e.workEmail,
      href: `/admin/employees/${e.id}`,
    })),
    settings: settings.map((s) => ({
      id: s.key,
      label: s.label,
      sublabel: s.key,
      href: `/admin/settings/${s.groupName}`,
    })),
    glossary: glossary.map((g) => ({
      id: g.termId,
      label: g.term,
      sublabel: g.glossaryTerm.category,
      href: "/admin/glossary",
    })),
  };
}
