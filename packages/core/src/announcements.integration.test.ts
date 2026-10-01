// Announcement emails against real MariaDB (ADR-171, changes-54 §15).
//
// Every property here is one a mocked Prisma would have passed while the real
// thing was broken: the dedupe is a UNIQUE index plus INSERT IGNORE, the claim
// is one UPDATE … ORDER BY … LIMIT, completion is one conditional UPDATE, and
// the audience is a UNION in SQL. Delivery goes through the real
// `@repo/email` with the LOG driver (no transport row), so the delivery log
// rows asserted below are the ones production writes.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as AnnouncementsModule from "./announcements.ts";
import type * as RunnerModule from "./announcement-runner.ts";
import type * as EmailModule from "@repo/email";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let service: typeof AnnouncementsModule;
let runner: typeof RunnerModule;
let email: typeof EmailModule;

const ALL_KEYS = [
  "announcements.view",
  "announcements.create",
  "announcements.send",
  "users.view",
  "email.log.view",
];

let admin: Subject;
let learnerIds: Record<string, string>;
let courseId: string;
let otherCourseId: string;

const noSleep = () => Promise.resolve();

async function setSetting(key: string, value: unknown, type = "STRING") {
  await db.setting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, groupName: "email", label: key, value: value as never, type: type as never },
  });
}

async function learner(
  key: string,
  data: {
    email: string;
    emailVerified?: boolean;
    status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
    banned?: boolean;
    deletedAt?: Date;
    lastLoginAt?: Date | null;
    locale?: string;
  },
) {
  const row = await db.user.create({
    data: {
      id: `learner-${key}`,
      name: `Learner ${key.toUpperCase()}`,
      email: data.email,
      emailVerified: data.emailVerified ?? false,
      status: data.status ?? "ACTIVE",
      banned: data.banned ?? false,
      deletedAt: data.deletedAt ?? null,
      lastLoginAt: data.lastLoginAt === undefined ? new Date() : data.lastLoginAt,
      locale: data.locale ?? "en",
      userType: "LEARNER",
    },
  });
  return row.id;
}

async function subscriber(emailAddress: string, status: "ACTIVE" | "UNSUBSCRIBED" | "PENDING") {
  const row = await db.newsletterSubscriber.create({
    data: {
      email: emailAddress,
      locale: "en",
      status,
      source: "footer",
      unsubscribeTokenHash: crypto.randomUUID().replace(/-/g, "").padEnd(64, "0"),
    },
  });
  return row.id;
}

async function draft(audience: unknown, target = courseId): Promise<string> {
  const row = await db.emailCampaign.create({
    data: {
      kind: "COURSE",
      targetId: target,
      name: "Launch",
      audience: audience as never,
      createdById: admin.id,
    },
  });
  return row.id;
}

async function recipients(campaignId: string) {
  return db.emailCampaignRecipient.findMany({
    where: { campaignId },
    orderBy: { email: "asc" },
  });
}

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_announcements")
    .withUsername("test")
    .withUserPassword("test")
    .start();
  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
  process.env.EMAIL_LINK_SECRET = "integration-link-secret-0123456789";
  db = (await import("@repo/db")).db;
  service = await import("./announcements.ts");
  runner = await import("./announcement-runner.ts");
  email = await import("@repo/email");
  // The log driver prints every message; the suite asserts rows, not output.
  vi.spyOn(console, "log").mockImplementation(() => undefined);

  const staff = await db.user.create({
    data: {
      id: "staff-admin",
      email: "admin@staff.example",
      name: "Admin",
      status: "ACTIVE",
      userType: "STAFF",
      emailVerified: true,
    },
  });
  admin = {
    id: staff.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 90,
    allowed: new Set(ALL_KEYS),
    denied: new Set(),
  };

  await db.locale.createMany({
    data: [
      {
        code: "en",
        name: "English",
        nativeName: "English",
        direction: "LTR",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
      {
        code: "ar",
        name: "Arabic",
        nativeName: "العربية",
        direction: "RTL",
        isDefault: false,
        isActive: true,
        sortOrder: 2,
      },
    ],
  });

  const course = await db.course.create({
    data: {
      track: "forex",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      lessonCount: 12,
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      translations: {
        create: [
          {
            locale: "en",
            title: "Forex basics",
            slug: "forex-basics",
            summary: "<p>Start <strong>here</strong>.</p>",
            translationStatus: "TRANSLATED",
          },
          {
            locale: "ar",
            title: "أساسيات الفوركس",
            slug: "asasiyat",
            summary: "ابدأ هنا.",
            translationStatus: "TRANSLATED",
          },
        ],
      },
    },
  });
  courseId = course.id;
  const other = await db.course.create({
    data: {
      track: "forex",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      translations: {
        create: { locale: "en", title: "Charts", slug: "charts", translationStatus: "TRANSLATED" },
      },
    },
  });
  otherCourseId = other.id;
}, 240_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await db.emailCampaign.deleteMany();
  await db.emailSuppression.deleteMany();
  await db.emailDelivery.deleteMany();
  await db.emailTransport.deleteMany();
  await db.newsletterSubscriber.deleteMany();
  await db.courseEnrollment.deleteMany();
  await db.user.deleteMany({ where: { userType: "LEARNER" } });

  await setSetting("site.name", "MBX Learning Center");
  await setSetting("email.enabled", true, "BOOLEAN");
  await setSetting("email.fromEmail", "no-reply@example.test");
  await setSetting("email.fromName", "MBX");
  await setSetting("email.postalAddress", "1 Example Street, London");
  await setSetting("email.campaignRatePerMinute", 1000, "NUMBER");
  await setSetting("email.campaignBatchSize", 50, "NUMBER");
  await setSetting("announcements.inactiveDays", "30", "SELECT");

  const longAgo = new Date(Date.now() - 90 * 86_400_000);
  learnerIds = {
    a: await learner("a", { email: "Alice@Example.test", emailVerified: true }),
    b: await learner("b", {
      email: "bob@example.test",
      status: "PENDING_VERIFICATION",
      lastLoginAt: null,
    }),
    c: await learner("c", { email: "carol@example.test", emailVerified: true, banned: true }),
    d: await learner("d", { email: "dan@example.test", emailVerified: true, status: "SUSPENDED" }),
    e: await learner("e", {
      email: "eve@example.test",
      emailVerified: true,
      deletedAt: new Date(),
    }),
    f: await learner("f", { email: "fay@example.test", emailVerified: true }),
    g: await learner("g", { email: "gus@example.test", emailVerified: true }),
    h: await learner("h", {
      email: "hana@example.test",
      emailVerified: true,
      lastLoginAt: longAgo,
      locale: "ar",
    }),
  };
  // F already has the course; G said no.
  await db.courseEnrollment.create({ data: { userId: learnerIds.f!, courseId } });
  await db.emailSuppression.create({
    data: { email: "gus@example.test", scope: "ANNOUNCEMENTS", reason: "UNSUBSCRIBED" },
  });
  await subscriber("solo@example.test", "ACTIVE");
  await subscriber("gone@example.test", "UNSUBSCRIBED");
  await subscriber("pending@example.test", "PENDING");
  // Alice again, in capitals: the same person, one recipient.
  await subscriber("ALICE@example.test", "ACTIVE");
  // Fay's address as a subscriber: she has the course, so still excluded.
  await subscriber("fay@example.test", "ACTIVE");
});

// ─── Audience ────────────────────────────────────────────────

describe("the audience (plan §4)", () => {
  it("dedupes by normalised address, and the account row wins", async () => {
    const id = await draft({
      keys: ["verified", "subscribers", "custom"],
      userIds: [learnerIds.a, "staff-admin"],
    });
    await service.queueAnnouncement(admin, id);

    const rows = await recipients(id);
    expect(rows.map((row) => row.email)).toEqual([
      "alice@example.test",
      "hana@example.test",
      "solo@example.test",
    ]);
    const alice = rows.find((row) => row.email === "alice@example.test");
    expect(alice?.userId).toBe(learnerIds.a);
    expect(alice?.name).toBe("Learner A");
    expect(rows.find((row) => row.email === "hana@example.test")?.locale).toBe("ar");
  });

  it("excludes staff, banned, suspended, deleted, suppressed, enrolled and unsubscribed", async () => {
    const id = await draft({ keys: ["all_learners", "subscribers"] });
    await service.queueAnnouncement(admin, id);
    const emails = (await recipients(id)).map((row) => row.email);
    expect(emails).toEqual([
      "alice@example.test",
      "bob@example.test",
      "hana@example.test",
      "solo@example.test",
    ]);
    for (const absent of [
      "admin@staff.example",
      "carol@example.test",
      "dan@example.test",
      "eve@example.test",
      "fay@example.test",
      "gus@example.test",
      "gone@example.test",
      "pending@example.test",
    ]) {
      expect(emails).not.toContain(absent);
    }
  });

  it("counts each card on its own and the union exactly as the send queues it", async () => {
    const audience = {
      keys: ["verified", "subscribers", "inactive"] as const,
    };
    const summary = await service.summariseAudience(admin, courseId, {
      keys: [...audience.keys],
    });
    // verified: alice, hana (gus suppressed, fay enrolled, c/d/e ineligible)
    expect(summary.selection?.perCard.verified).toBe(2);
    // subscribers: solo, alice (fay enrolled, gone/pending not active)
    expect(summary.selection?.perCard.subscribers).toBe(2);
    // inactive: bob (never), hana (90 days)
    expect(summary.selection?.perCard.inactive).toBe(2);
    expect(summary.selection?.unique).toBe(4);
    expect(summary.selection?.duplicates).toBe(2);
    // gus is verified and suppressed.
    expect(summary.selection?.suppressed).toBe(1);

    const id = await draft({ keys: [...audience.keys] });
    const outcome = await service.queueAnnouncement(admin, id);
    expect(outcome).toEqual({ state: "sending", recipients: 4 });
    expect(await recipients(id)).toHaveLength(4);
  });

  it("selects the learners of the courses picked", async () => {
    await db.courseEnrollment.create({ data: { userId: learnerIds.b!, courseId: otherCourseId } });
    const id = await draft({ keys: ["course_learners"], courseIds: [otherCourseId] });
    await service.queueAnnouncement(admin, id);
    expect((await recipients(id)).map((row) => row.email)).toEqual(["bob@example.test"]);
  });

  it("cannot snapshot a campaign twice (a double-pressed Send)", async () => {
    const id = await draft({ keys: ["verified"] });
    await service.queueAnnouncement(admin, id);
    await expect(service.queueAnnouncement(admin, id)).rejects.toMatchObject({
      reason: "not_draft",
    });
    expect(await service.startCampaign(id, admin.id, new Date())).toBeNull();
    expect(await recipients(id)).toHaveLength(2);
  });
});

// ─── The runner ──────────────────────────────────────────────

describe("drainAnnouncementQueue (plan §8.2)", () => {
  it("sends every row once, logs each against the campaign, and finishes it", async () => {
    const id = await draft({ keys: ["all_learners", "subscribers"] });
    await service.queueAnnouncement(admin, id);
    const result = await runner.drainAnnouncementQueue({ sleep: noSleep });

    expect(result.sent).toBe(4);
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id } });
    expect(campaign.status).toBe("SENT");
    expect(campaign.sentCount).toBe(4);
    expect(campaign.finishedAt).not.toBeNull();
    const deliveries = await db.emailDelivery.findMany({ where: { campaignId: id } });
    expect(deliveries).toHaveLength(4);
    expect(new Set(deliveries.map((row) => row.to)).size).toBe(4);
    // The Arabic reader got the Arabic words, which the course has.
    expect(deliveries.find((row) => row.to === "hana@example.test")?.subject).toContain(
      "أساسيات الفوركس",
    );

    // A second drain finds nothing to do.
    expect((await runner.drainAnnouncementQueue({ sleep: noSleep })).sent).toBe(0);
  });

  it("never lets two concurrent drains share a row", async () => {
    const id = await draft({ keys: ["all_learners", "subscribers"] });
    await service.queueAnnouncement(admin, id);
    await Promise.all([
      runner.drainAnnouncementQueue({ sleep: noSleep }),
      runner.drainAnnouncementQueue({ sleep: noSleep }),
      runner.drainAnnouncementQueue({ sleep: noSleep }),
    ]);
    const deliveries = await db.emailDelivery.findMany({ where: { campaignId: id } });
    expect(deliveries).toHaveLength(4);
    expect((await db.emailCampaign.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");
  });

  it("honours an unsubscribe that lands between the snapshot and the send", async () => {
    const id = await draft({ keys: ["subscribers"] });
    await service.queueAnnouncement(admin, id);
    await db.emailSuppression.create({
      data: { email: "solo@example.test", scope: "ANNOUNCEMENTS", reason: "UNSUBSCRIBED" },
    });
    const result = await runner.drainAnnouncementQueue({ sleep: noSleep });
    expect(result.suppressed).toBe(1);
    const solo = (await recipients(id)).find((row) => row.email === "solo@example.test");
    expect(solo?.status).toBe("SUPPRESSED");
    expect(await db.emailDelivery.count({ where: { to: "solo@example.test" } })).toBe(0);
  });

  it("pauses without burning rows while email is switched off", async () => {
    const id = await draft({ keys: ["verified"] });
    await service.queueAnnouncement(admin, id);
    await setSetting("email.enabled", false, "BOOLEAN");

    const paused = await runner.drainAnnouncementQueue({ sleep: noSleep });
    expect(paused.paused).toBe(true);
    expect((await recipients(id)).every((row) => row.status === "PENDING")).toBe(true);

    await setSetting("email.enabled", true, "BOOLEAN");
    expect((await runner.drainAnnouncementQueue({ sleep: noSleep })).sent).toBe(2);
  });

  it("fails an expired lease, and never sends that row again (at-most-once)", async () => {
    const id = await draft({ keys: ["verified"] });
    await service.queueAnnouncement(admin, id);
    await db.emailCampaignRecipient.updateMany({
      where: { campaignId: id, email: "alice@example.test" },
      data: {
        status: "SENDING",
        claimToken: "dead",
        claimedAt: new Date(Date.now() - 11 * 60_000),
      },
    });

    await runner.drainAnnouncementQueue({ sleep: noSleep });
    const alice = (await recipients(id)).find((row) => row.email === "alice@example.test");
    expect(alice?.status).toBe("FAILED");
    expect(alice?.lastError).toBe("lease_expired");
    expect(await db.emailDelivery.count({ where: { to: "alice@example.test" } })).toBe(0);
    expect((await db.emailCampaign.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");
  });

  it("retries a transient failure twice, then fails it; Retry failed brings back only those", async () => {
    const id = await draft({ keys: ["verified"] });
    await service.queueAnnouncement(admin, id);
    // An SMTP host nobody listens on: every send is a transient failure.
    await db.emailTransport.create({
      data: { id: "default", driver: "SMTP", host: "127.0.0.1", port: 1, security: "NONE" },
    });

    for (let pass = 0; pass < 3; pass += 1) {
      await runner.drainAnnouncementQueue({ sleep: noSleep });
      // The backoff is measured in minutes; bring the rows due again.
      await db.emailCampaignRecipient.updateMany({
        where: { campaignId: id, status: "PENDING" },
        data: { runAfter: new Date(Date.now() - 1000) },
      });
    }
    const failed = await recipients(id);
    expect(failed.every((row) => row.status === "FAILED" && row.attempts === 3)).toBe(true);
    expect(failed.every((row) => row.lastError === "transient")).toBe(true);
    expect((await db.emailCampaign.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");

    await db.emailTransport.deleteMany();
    expect(await service.retryFailedRecipients(admin, id)).toBe(2);
    expect((await runner.drainAnnouncementQueue({ sleep: noSleep })).sent).toBe(2);
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id } });
    expect(campaign.sentCount).toBe(2);
    expect(campaign.failedCount).toBe(0);
  });

  it("cancel skips the pending rows only", async () => {
    const id = await draft({ keys: ["all_learners"] });
    await service.queueAnnouncement(admin, id);
    await service.cancelAnnouncement(admin, id);
    const rows = await recipients(id);
    expect(rows.every((row) => row.status === "SKIPPED")).toBe(true);
    expect((await runner.drainAnnouncementQueue({ sleep: noSleep })).sent).toBe(0);
    expect((await db.emailCampaign.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELLED");
  });
});

// ─── Scheduling (plan §8.1, owner D5) ────────────────────────

describe("scheduling", () => {
  it("waits for a SCHEDULED course to go live, then sends without publish-due", async () => {
    const goLive = new Date(Date.now() + 3 * 86_400_000);
    await db.course.update({
      where: { id: courseId },
      data: { status: "SCHEDULED", scheduledFor: goLive, publishedAt: null },
    });
    try {
      const id = await draft({ keys: ["verified"] });
      const outcome = await service.queueAnnouncement(admin, id);
      expect(outcome.state).toBe("waiting_for_target");
      const waiting = await db.emailCampaign.findUniqueOrThrow({ where: { id } });
      expect(waiting.status).toBe("SCHEDULED");
      expect(waiting.sendWhenLive).toBe(true);

      await runner.drainAnnouncementQueue({ sleep: noSleep });
      expect(await recipients(id)).toHaveLength(0);

      // The date passes. Status is still SCHEDULED — nobody ran publish-due.
      const later = new Date(goLive.getTime() + 60_000);
      const result = await runner.drainAnnouncementQueue({ sleep: noSleep, now: () => later });
      expect(result.started).toBe(1);
      expect(result.sent).toBe(2);
    } finally {
      await db.course.update({
        where: { id: courseId },
        data: { status: "PUBLISHED", scheduledFor: null, publishedAt: new Date("2026-09-01") },
      });
    }
  });

  it("cancels, rather than sends, when the course goes back to draft", async () => {
    await db.course.update({
      where: { id: courseId },
      data: { status: "SCHEDULED", scheduledFor: new Date(Date.now() + 86_400_000) },
    });
    try {
      const id = await draft({ keys: ["verified"] });
      await service.queueAnnouncement(admin, id);
      await db.course.update({ where: { id: courseId }, data: { status: "DRAFT" } });
      const result = await runner.drainAnnouncementQueue({ sleep: noSleep });
      expect(result.cancelled).toBe(1);
      const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id } });
      expect(campaign.status).toBe("CANCELLED");
      expect(campaign.cancelReason).toBe("target_unavailable");
    } finally {
      await db.course.update({
        where: { id: courseId },
        data: { status: "PUBLISHED", scheduledFor: null },
      });
    }
  });

  it("starts a scheduled send at its time, not before", async () => {
    const at = new Date(Date.now() + 3_600_000);
    const id = await draft({ keys: ["verified"] });
    await service.scheduleAnnouncement(admin, id, at);
    await runner.drainAnnouncementQueue({ sleep: noSleep });
    expect(await recipients(id)).toHaveLength(0);

    const result = await runner.drainAnnouncementQueue({
      sleep: noSleep,
      now: () => new Date(at.getTime() + 1000),
    });
    expect(result.started).toBe(1);
    expect(result.sent).toBe(2);
  });

  it("refuses a time in the past", async () => {
    const id = await draft({ keys: ["verified"] });
    await expect(
      service.scheduleAnnouncement(admin, id, new Date(Date.now() - 1000)),
    ).rejects.toMatchObject({ reason: "schedule_in_past" });
  });
});

// ─── Refusals and permissions ────────────────────────────────

describe("refusals", () => {
  it("will not send without a postal address, and names why", async () => {
    await setSetting("email.postalAddress", "");
    const id = await draft({ keys: ["verified"] });
    await expect(service.queueAnnouncement(admin, id)).rejects.toMatchObject({
      reason: "no_postal_address",
    });
    expect(await recipients(id)).toHaveLength(0);
  });

  it("will not announce a draft course", async () => {
    await db.course.update({ where: { id: otherCourseId }, data: { status: "DRAFT" } });
    try {
      const id = await draft({ keys: ["verified"] }, otherCourseId);
      await expect(service.queueAnnouncement(admin, id)).rejects.toMatchObject({
        reason: "target_unavailable",
      });
    } finally {
      await db.course.update({ where: { id: otherCourseId }, data: { status: "PUBLISHED" } });
    }
  });

  it("refuses every action without its key and writes nothing", async () => {
    const viewer: Subject = { ...admin, allowed: new Set(["announcements.view"]) };
    const id = await draft({ keys: ["verified"] });
    await expect(service.queueAnnouncement(viewer, id)).rejects.toMatchObject({
      permission: "announcements.send",
    });
    await expect(
      service.saveAnnouncementDraft(viewer, {
        kind: "COURSE",
        targetId: courseId,
        name: "x",
        subject: null,
        message: null,
      }),
    ).rejects.toMatchObject({ permission: "announcements.create" });
    await expect(
      service.addAnnouncementSuppression(viewer, "x@example.test"),
    ).rejects.toMatchObject({ permission: "announcements.send" });
    const noUsers: Subject = { ...admin, allowed: new Set(["announcements.create"]) };
    await expect(service.searchAnnouncementUsers(noUsers, "alice")).rejects.toMatchObject({
      permission: "users.view",
    });
    expect(await recipients(id)).toHaveLength(0);
    expect(await db.emailSuppression.count({ where: { email: "x@example.test" } })).toBe(0);
    expect(await db.emailCampaign.count({ where: { name: "x" } })).toBe(0);
  });

  it("finds learners only in the Select users picker (owner, D3)", async () => {
    const found = await service.searchAnnouncementUsers(admin, "example");
    expect(found.map((row) => row.email)).not.toContain("admin@staff.example");
    expect(found.length).toBeGreaterThan(0);
  });
});

// ─── Unsubscribe (ADR-171 #9) ────────────────────────────────

describe("the public unsubscribe", () => {
  it("suppresses the token's address, idempotently, and reports the newsletter", async () => {
    const token = email.signUnsubscribeToken({ kind: "u", id: learnerIds.a! });
    expect(await service.unsubscribeFromAnnouncements(token)).toEqual({ newsletterActive: true });
    expect(await service.unsubscribeFromAnnouncements(token)).toEqual({ newsletterActive: true });
    const row = await db.emailSuppression.findUniqueOrThrow({
      where: { email_scope: { email: "alice@example.test", scope: "ANNOUNCEMENTS" } },
    });
    expect(row.reason).toBe("UNSUBSCRIBED");
    expect(await service.unsubscribeFromAnnouncements("v1.bad.token")).toBeNull();
  });

  it("works for a subscriber with no account", async () => {
    const solo = await db.newsletterSubscriber.findUniqueOrThrow({
      where: { email: "solo@example.test" },
    });
    const token = email.signUnsubscribeToken({ kind: "s", id: solo.id });
    await service.unsubscribeFromAnnouncements(token);
    expect(await service.unsubscribeNewsletterByAnnouncementToken(token)).toBe(true);
    const after = await db.newsletterSubscriber.findUniqueOrThrow({ where: { id: solo.id } });
    expect(after.status).toBe("UNSUBSCRIBED");
    expect(after.unsubscribedVia).toBe("subscriber");
  });

  it("undo removes a person's own unsubscribe, never a staff suppression", async () => {
    const token = email.signUnsubscribeToken({ kind: "u", id: learnerIds.a! });
    await service.unsubscribeFromAnnouncements(token);
    expect(await service.resubscribeToAnnouncements(token)).toBe(true);

    await service.addAnnouncementSuppression(admin, "Alice@Example.test");
    expect(await service.resubscribeToAnnouncements(token)).toBe(false);
    // …and staff cannot undo a person's own "no".
    const bob = email.signUnsubscribeToken({ kind: "u", id: learnerIds.b! });
    await service.unsubscribeFromAnnouncements(bob);
    expect(await service.removeAnnouncementSuppression(admin, "bob@example.test")).toBe(false);
    expect(await service.removeAnnouncementSuppression(admin, "alice@example.test")).toBe(true);
  });
});

// ─── Test send and housekeeping ──────────────────────────────

describe("send me a test", () => {
  it("mails the actor and writes no recipient row", async () => {
    const id = await draft({ keys: ["verified"] });
    const result = await service.sendAnnouncementTest(admin, id);
    expect(result.status).toBe("SENT");
    expect(await recipients(id)).toHaveLength(0);
    const delivery = await db.emailDelivery.findUniqueOrThrow({ where: { id: result.deliveryId } });
    expect(delivery.to).toBe("admin@staff.example");
    expect(delivery.isTest).toBe(true);
  });
});

describe("the editor's reads", () => {
  it("previews the saved draft with the real course, and mints no working token", async () => {
    const id = await draft({ keys: ["verified"] });
    await db.emailCampaign.update({ where: { id }, data: { message: "Enrol this week." } });
    const rendered = await service.renderAnnouncementPreview(admin, {
      campaignId: id,
      locale: "ar",
    });
    expect(rendered?.subject).toContain("أساسيات الفوركس");
    expect(rendered?.html).toContain("Enrol this week.");
    // A coverless course gets the raster panel, never the web's SVG.
    expect(rendered?.html).toContain("/email/track-forex.png");
    expect(rendered?.html).not.toMatch(/track-forex\.svg/);
    // The unsubscribe link is a placeholder: a preview must not hand out a token.
    expect(rendered?.html).toContain("unsubscribe?t=preview");
    expect(rendered?.html).not.toMatch(/t=v1\./);
  });

  it("reports what the Review step needs, and earlier sends of the same course", async () => {
    const first = await draft({ keys: ["verified"] });
    await service.queueAnnouncement(admin, first);
    const second = await draft({ keys: ["subscribers"] });

    const detail = await service.getAnnouncement(admin, second);
    expect(detail.blockers).toEqual([]);
    expect(detail.targetAvailability).toBe("live");
    expect(detail.previousSends.map((row) => row.id)).toEqual([first]);
    expect(detail.previousSends[0]?.recipientCount).toBe(2);

    await setSetting("email.postalAddress", "");
    expect((await service.getAnnouncement(admin, second)).blockers).toEqual(["no_postal_address"]);
  });

  it("offers live and scheduled courses to the picker, never a draft", async () => {
    await db.course.update({ where: { id: otherCourseId }, data: { status: "DRAFT" } });
    try {
      const found = await service.searchAnnounceableCourses(admin, "");
      expect(found.map((course) => course.id)).toContain(courseId);
      expect(found.map((course) => course.id)).not.toContain(otherCourseId);
    } finally {
      await db.course.update({ where: { id: otherCourseId }, data: { status: "PUBLISHED" } });
    }
  });
});

describe("housekeeping", () => {
  it("purges recipient rows 90 days after the campaign finished; keeps the campaign and suppressions", async () => {
    const id = await draft({ keys: ["verified"] });
    await service.queueAnnouncement(admin, id);
    await runner.drainAnnouncementQueue({ sleep: noSleep });
    await db.emailCampaign.update({
      where: { id },
      data: { finishedAt: new Date(Date.now() - 91 * 86_400_000) },
    });

    expect(await runner.purgeAnnouncementRecipients()).toBe(2);
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id } });
    expect(campaign.sentCount).toBe(2);
    expect(await db.emailSuppression.count()).toBe(1);
  });
});
