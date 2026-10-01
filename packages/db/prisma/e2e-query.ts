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

  /**
   * One promotion and its words in every language (changes-52 P8), or null.
   * By id: the spec learns the id from the editor's address after the first
   * save, and a title lookup would find a leftover from an earlier run.
   */
  async promotion(args: { id: string }) {
    return db.promotion.findUnique({
      where: { id: args.id },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        frequency: true,
        untranslated: true,
        translations: { select: { locale: true, title: true }, orderBy: { locale: "asc" } },
      },
    });
  },

  /** A promotion's popup counters summed over every day (ADR-170). */
  async promotionPopupTotals(args: { id: string }) {
    const sum = await db.promotionDailyStat.aggregate({
      where: { promotionId: args.id, surface: "POPUP" },
      _sum: { impressions: true, clicks: true, dismissals: true },
    });
    return {
      impressions: sum._sum.impressions ?? 0,
      clicks: sum._sum.clicks ?? 0,
      dismissals: sum._sum.dismissals ?? 0,
    };
  },

  /** How many audit rows an action wrote for one entity. */
  async auditCount(args: { entityId: string; action: string }) {
    return db.auditLog.count({ where: { entityId: args.entityId, action: args.action } });
  },

  /**
   * The announcement journey's world (ADR-171, changes-54 N7): two verified
   * learners, a subscriber whose address is learner A's in capitals (the
   * dedupe case), a subscriber with no account, and delivery pointed at the
   * Mailpit the dev stack runs. Every address carries the run's stamp, so a
   * spec reads only its own mail. Returns a published course to announce.
   */
  async announcementFixture(args: { stamp: string; smtpHost: string; smtpPort: number }) {
    const addresses = {
      a: `e2e-ann-a-${args.stamp}@example.test`,
      b: `e2e-ann-b-${args.stamp}@example.test`,
      solo: `e2e-ann-solo-${args.stamp}@example.test`,
    };
    const users = [];
    for (const key of ["a", "b"] as const) {
      users.push(
        await db.user.create({
          data: {
            id: `e2e-ann-${key}-${args.stamp}`,
            name: `E2E Learner ${key.toUpperCase()} ${args.stamp}`,
            // Learner A's account address in mixed case: the subscription below
            // is the same mailbox in lower case, which is the dedupe under test.
            email: key === "a" ? `E2E-Ann-A-${args.stamp}@Example.test` : addresses[key],
            emailVerified: true,
            status: "ACTIVE",
            userType: "LEARNER",
          },
          select: { id: true, email: true, name: true },
        }),
      );
    }
    for (const [email, token] of [
      [addresses.a, "a"],
      [addresses.solo, "s"],
    ] as const) {
      await db.newsletterSubscriber.create({
        data: {
          email,
          locale: "en",
          status: "ACTIVE",
          source: "footer",
          unsubscribeTokenHash: `${token}${args.stamp}`.padEnd(64, "0").slice(0, 64),
        },
      });
    }
    for (const [key, value, type] of [
      ["email.enabled", true, "BOOLEAN"],
      ["email.postalAddress", "1 Example Street, London", "TEXT"],
      ["email.campaignRatePerMinute", 1000, "NUMBER"],
    ] as const) {
      await db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, groupName: "email", label: key, value, type, isPublic: false },
      });
    }
    await db.emailTransport.upsert({
      where: { id: "default" },
      update: { driver: "SMTP", host: args.smtpHost, port: args.smtpPort, security: "NONE" },
      create: {
        id: "default",
        driver: "SMTP",
        host: args.smtpHost,
        port: args.smtpPort,
        security: "NONE",
      },
    });
    const course = await db.course.findFirstOrThrow({
      where: { status: "PUBLISHED", deletedAt: null, isActive: true, visibility: "PUBLIC" },
      select: { id: true, translations: { where: { locale: "en" }, select: { title: true } } },
    });
    return { addresses, users, courseId: course.id, courseTitle: course.translations[0]?.title };
  },

  /** One announcement and its recipient rows, as the database holds them. */
  async announcement(args: { id: string }) {
    return db.emailCampaign.findUnique({
      where: { id: args.id },
      include: {
        recipients: {
          select: { email: true, status: true, userId: true, subscriberId: true },
          orderBy: { email: "asc" },
        },
      },
    });
  },

  /** How many announcements carry a name — the denied path writes none. */
  async announcementCount(args: { name: string }) {
    return db.emailCampaign.count({ where: { name: args.name } });
  },

  /** An address's announcement suppression, or null. */
  async announcementSuppression(args: { email: string }) {
    return db.emailSuppression.findUnique({
      where: { email_scope: { email: args.email, scope: "ANNOUNCEMENTS" } },
      select: { reason: true },
    });
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
