// @repo/db — Prisma client singleton.
//
// The only package that imports the generated client directly. Everything
// else in the monorepo imports from here (architecture.md #8: route handlers
// and server actions never touch Prisma directly either — they go through
// @repo/core, which imports this singleton).
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/client/client.ts";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({ adapter });
}

// Lazy: DATABASE_URL isn't necessarily set yet at *import* time — ESM hoists
// import evaluation above any same-file dotenv-loading code that textually
// precedes it (seed.ts learned this the hard way), and Next.js itself only
// guarantees .env is loaded before request handling, not before module
// graph construction. Building the client on first property access instead
// of at module load sidesteps needing every consumer to get import order
// exactly right.
//
// Reused across Next.js dev-server hot reloads so each edit doesn't open a
// fresh MariaDB connection pool.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = (globalThis.__prisma ??= createClient());
    return Reflect.get(client as object, prop, receiver);
  },
});

export * from "./generated/client/enums.ts";
export type * from "./generated/client/models.ts";
// `Prisma.TransactionClient` — the type of the `tx` callback parameter of
// `db.$transaction(async (tx) => ...)`. Needed by any @repo/core service
// (Module 16's cms/* is the first) that factors transaction steps into a
// separate exported function instead of one inline callback.
export type { Prisma } from "./generated/client/client.ts";

// The starting CONTENT of every email template (Module 17, ADR-078 #5) — read
// by `prisma/seed.ts` on a fresh database and by @repo/core's
// `resetEmailTemplate()` when an admin reverts one.
export {
  EMAIL_TEMPLATE_DEFAULTS,
  emailTemplateDefault,
  type EmailTemplateDefault,
} from "./email-template-defaults.ts";

// Which permissions nothing below `super_admin` may hold (security.md #4,
// ADR-078 #4). Read by `prisma/seed.ts` when it builds the `admin` role.
export {
  SUPER_ADMIN_ONLY_PERMISSIONS,
  isSuperAdminOnlyPermission,
  type SuperAdminOnlyPermission,
} from "./role-exclusions.ts";

// The role editor's permission cards, in order (ADR-083). Read by
// `prisma/seed.ts` when it assigns each permission a group, and by
// @repo/core's `loadRoleMatrix()` when it orders them for the screen.
export {
  PERMISSION_GROUPS,
  CONTENT_LIFECYCLE_GROUPS,
  permissionGroupOrder,
  type PermissionGroupName,
} from "./permission-groups.ts";
