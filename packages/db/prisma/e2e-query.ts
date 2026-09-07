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
