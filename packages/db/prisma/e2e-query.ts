// Read-only queries the Playwright suite needs for its database-level
// assertions, exposed as a tiny CLI that prints JSON.
//
// Why a child process instead of importing `@repo/db` from the test file:
// Playwright compiles specs to CommonJS, and `packages/db/src/index.ts`'s
// `declare global { var __prisma ... }` block does not survive that
// transpilation. Shelling out also keeps `apps/web` free of a `@repo/db`
// dependency, so nothing in the app package can casually import Prisma and
// quietly break architecture.md #2.
//
// Usage: node --experimental-strip-types prisma/e2e-query.ts <name> [json-args]
import { db } from "../src/index.ts";

const ARTICLE_SLUG = "risk-management-protect-your-trading-capital";

const queries = {
  /** The seeded sample article, with its FAQ rows in order. */
  async seededArticle() {
    return db.articleTranslation.findFirstOrThrow({
      where: { slug: ARTICLE_SLUG },
      include: { article: true, faqItems: { orderBy: { sortOrder: "asc" } } },
    });
  },

  /** One tool row and its English translation (changes-25 T10). */
  async tool(args: { key: string }) {
    return db.tool.findFirstOrThrow({
      where: { key: args.key },
      include: { translations: { where: { locale: "en" } } },
    });
  },

  /**
   * The E2E fixture staff user, or null. `globalSetup` reads this to prove the
   * database was provisioned before the suite starts asserting against it.
   */
  async fixtureUser() {
    return db.user.findUnique({
      where: { email: process.env.E2E_VIEWER_EMAIL ?? "e2e-viewer@mbxpro.com" },
      select: { id: true, email: true },
    });
  },

  /** One settings row, for asserting a settings screen's save landed. */
  async setting(args: { key: string }) {
    return db.setting.findUnique({
      where: { key: args.key },
      select: { key: true, value: true, groupName: true, isPublic: true },
    });
  },

  /** One AI feature row (`AiFeature`), keyed by its registry key. */
  async aiFeature(args: { key: string }) {
    return db.aiFeature.findUnique({ where: { key: args.key } });
  },

  /**
   * The ACTIVE locales, in order. ADR-091: only an active locale is
   * prerendered, served or listed in the sitemap, so a spec that wants to
   * exercise one has to ask which ones exist rather than assume.
   */
  async activeLocales() {
    // `direction` is a `TextDirection` enum, not a boolean — the caller wants
    // "is this one RTL", so the mapping happens here rather than leaking the
    // enum into a spec.
    const rows = await db.locale.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, direction: true },
    });
    return rows.map((row) => ({ code: row.code, isRtl: row.direction === "RTL" }));
  },

  /** How many audit rows an action wrote for one entity. */
  async auditCount(args: { entityId: string; action: string }) {
    return db.auditLog.count({ where: { entityId: args.entityId, action: args.action } });
  },
} satisfies Record<string, (args: never) => Promise<unknown>>;

export type E2eQueryName = keyof typeof queries;

const name = process.argv[2] as E2eQueryName | undefined;
const rawArgs = process.argv[3];

if (!name || !(name in queries)) {
  console.error(`Unknown e2e query "${name}". Known: ${Object.keys(queries).join(", ")}`);
  process.exit(1);
}

const args = rawArgs ? (JSON.parse(rawArgs) as never) : (undefined as never);
const result = await (queries[name] as (a: never) => Promise<unknown>)(args);
// Dates serialize to ISO strings; the specs compare them as strings or ignore
// them, so no reviver is needed on the other side.
process.stdout.write(JSON.stringify(result));
await db.$disconnect();
