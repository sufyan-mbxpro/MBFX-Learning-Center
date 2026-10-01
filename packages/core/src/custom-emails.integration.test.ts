// Custom and direct emails against real MariaDB (ADR-172, changes-55 §13).
//
// The properties that matter are the database's: a custom email rides the
// ADR-171 queue (so its dedupe is the same UNIQUE index), the test gate
// compares hashes of stored words, a direct email is ONE campaign with ONE
// recipient written in one statement, and the hourly brake counts rows.
// Delivery goes through the real `@repo/email` with the LOG driver.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as AnnouncementsModule from "./announcements.ts";
import type * as RunnerModule from "./announcement-runner.ts";
import type * as CustomModule from "./custom-emails.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let announcements: typeof AnnouncementsModule;
let runner: typeof RunnerModule;
let custom: typeof CustomModule;

const ALL_KEYS = [
  "announcements.view",
  "announcements.create",
  "announcements.send",
  "announcements.direct",
  "users.view",
  "employees.view",
  "newsletter.view",
  "email.log.view",
  "email.templates.view",
  "email.templates.update",
];

let admin: Subject;
const noSleep = () => Promise.resolve();

function subject(id: string, keys: string[]): Subject {
  return {
    id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 90,
    allowed: new Set(keys),
    denied: new Set(),
  };
}

async function setSetting(key: string, value: unknown, type = "STRING") {
  await db.setting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, groupName: "email", label: key, value: value as never, type: type as never },
  });
}

async function person(
  id: string,
  data: {
    email: string;
    userType?: "LEARNER" | "STAFF";
    emailVerified?: boolean;
    status?: "ACTIVE" | "SUSPENDED";
    deletedAt?: Date;
    locale?: string;
  },
) {
  await db.user.create({
    data: {
      id,
      name: `Person ${id}`,
      email: data.email,
      emailVerified: data.emailVerified ?? true,
      status: data.status ?? "ACTIVE",
      deletedAt: data.deletedAt ?? null,
      locale: data.locale ?? "en",
      userType: data.userType ?? "LEARNER",
    },
  });
  return id;
}

async function subscriber(address: string, status: "ACTIVE" | "UNSUBSCRIBED" | "PENDING") {
  const row = await db.newsletterSubscriber.create({
    data: {
      email: address,
      locale: "en",
      status,
      source: "footer",
      unsubscribeTokenHash: crypto.randomUUID().replace(/-/g, "").padEnd(64, "0"),
    },
  });
  return row.id;
}

const WORDS = {
  locale: "en",
  subject: "Hello {{recipient.name}}",
  preheader: null,
  mode: "RICH" as const,
  bodyHtml: "<p>Markets open early on Monday.</p>",
};

async function customDraft(audience: unknown): Promise<string> {
  return custom.saveCustomEmail(admin, {
    name: "Monday notice",
    content: WORDS,
    audience: audience as never,
  });
}

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_custom_emails")
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
  announcements = await import("./announcements.ts");
  runner = await import("./announcement-runner.ts");
  custom = await import("./custom-emails.ts");
  vi.spyOn(console, "log").mockImplementation(() => undefined);

  await db.user.create({
    data: {
      id: "staff-admin",
      email: "admin@staff.example",
      name: "Admin",
      status: "ACTIVE",
      userType: "STAFF",
      emailVerified: true,
    },
  });
  admin = subject("staff-admin", ALL_KEYS);

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
}, 240_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await db.emailCampaign.deleteMany();
  await db.emailDesign.deleteMany();
  await db.emailSuppression.deleteMany();
  await db.emailDelivery.deleteMany();
  await db.newsletterSubscriber.deleteMany();
  await db.auditLog.deleteMany();
  await db.user.deleteMany({ where: { id: { not: "staff-admin" } } });

  await setSetting("site.name", "MBX Learning Center");
  await setSetting("email.enabled", true, "BOOLEAN");
  await setSetting("email.fromEmail", "no-reply@example.test");
  await setSetting("email.fromName", "MBX");
  await setSetting("email.postalAddress", "1 Example Street, London");
  await setSetting("email.campaignRatePerMinute", 1000, "NUMBER");
  await setSetting("email.campaignBatchSize", 50, "NUMBER");
  await setSetting("announcements.inactiveDays", "30", "SELECT");

  await person("ann", { email: "Ann@Example.test" });
  await person("ben", { email: "ben@example.test", emailVerified: false, locale: "ar" });
  await person("sue", { email: "sue@example.test", status: "SUSPENDED" });
  await person("kim", { email: "kim@staff.example", userType: "STAFF" });
  await subscriber("ANN@example.test", "ACTIVE");
  await subscriber("solo@example.test", "ACTIVE");
});

// ─── Designs ─────────────────────────────────────────────────

describe("designs (ADR-172 #3)", () => {
  it("sanitises on save and refuses a body that sanitising empties", async () => {
    const id = await custom.saveEmailDesign(admin, {
      name: "Monthly",
      description: null,
      mode: "RICH",
      subject: null,
      preheader: null,
      bodyHtml: '<p onclick="steal()">Hi</p><script>alert(1)</script>',
    });
    const stored = await db.emailDesign.findUniqueOrThrow({ where: { id } });
    expect(stored.bodyHtml).not.toContain("script");
    expect(stored.bodyHtml).not.toContain("onclick");
    await expect(
      custom.saveEmailDesign(admin, {
        name: "Empty",
        description: null,
        mode: "RICH",
        subject: null,
        preheader: null,
        bodyHtml: "<script>alert(1)</script>",
      }),
    ).rejects.toMatchObject({ reason: "empty" });
  });

  it("is copied into an email, so editing it later changes no draft", async () => {
    const designId = await custom.saveEmailDesign(admin, {
      name: "Monthly",
      description: null,
      mode: "RICH",
      subject: "Monthly",
      preheader: null,
      bodyHtml: "<p>Version one</p>",
    });
    const id = await custom.saveCustomEmail(admin, {
      name: "From design",
      designId,
      content: { ...WORDS, bodyHtml: "<p>Version one</p>" },
    });
    await custom.saveEmailDesign(admin, {
      id: designId,
      name: "Monthly",
      description: null,
      mode: "RICH",
      subject: "Monthly",
      preheader: null,
      bodyHtml: "<p>Version two</p>",
    });
    const draft = await custom.getCustomEmailDraft(admin, id);
    expect(draft.designId).toBe(designId);
    expect(draft.contents[0]?.bodyHtml).toContain("Version one");
  });

  it("archives out of the list and restores back into it", async () => {
    const id = await custom.saveEmailDesign(admin, {
      name: "Old",
      description: null,
      mode: "RICH",
      subject: null,
      preheader: null,
      bodyHtml: "<p>Old</p>",
    });
    await custom.setEmailDesignArchived(admin, id, true);
    expect((await custom.listEmailDesigns(admin)).map((row) => row.id)).not.toContain(id);
    await custom.setEmailDesignArchived(admin, id, false);
    expect((await custom.listEmailDesigns(admin)).map((row) => row.id)).toContain(id);
  });

  it("refuses to save without the templates key, and writes nothing", async () => {
    const reader = subject("staff-admin", ["email.templates.view"]);
    await expect(
      custom.saveEmailDesign(reader, {
        name: "Nope",
        description: null,
        mode: "RICH",
        subject: null,
        preheader: null,
        bodyHtml: "<p>x</p>",
      }),
    ).rejects.toBeInstanceOf(announcements.AnnouncementPermissionError);
    expect(await db.emailDesign.count()).toBe(0);
  });
});

// ─── A custom email ──────────────────────────────────────────

describe("a custom email (ADR-172 #1, #2)", () => {
  it("cannot be sent until a test has gone out since the last edit", async () => {
    const id = await customDraft({ keys: ["all_learners"] });
    await expect(announcements.queueAnnouncement(admin, id)).rejects.toMatchObject({
      reason: "test_required",
    });

    const test = await custom.sendCustomEmailTest(admin, id);
    expect(test.status).toBe("SENT");
    expect((await custom.getCustomEmailDraft(admin, id)).tested).toBe(true);

    // An edit after the test asks for another one.
    await custom.saveCustomEmail(admin, {
      id,
      name: "Monday notice",
      content: { ...WORDS, bodyHtml: "<p>Markets open LATE on Monday.</p>" },
    });
    expect((await custom.getCustomEmailDraft(admin, id)).tested).toBe(false);
    await expect(announcements.queueAnnouncement(admin, id)).rejects.toMatchObject({
      reason: "test_required",
    });

    await custom.sendCustomEmailTest(admin, id);
    const outcome = await announcements.queueAnnouncement(admin, id);
    expect(outcome).toEqual({ state: "sending", recipients: 2 });
  });

  it("dedupes an account and its subscription, and sends the stored words once each", async () => {
    const id = await customDraft({ keys: ["all_learners", "subscribers"] });
    await custom.sendCustomEmailTest(admin, id);
    await announcements.queueAnnouncement(admin, id);

    const rows = await db.emailCampaignRecipient.findMany({
      where: { campaignId: id },
      orderBy: { email: "asc" },
    });
    // Ann is an account AND a subscription in other letter case: one row, the
    // account's. Sue is suspended; Kim is staff and no card was picked for her.
    expect(rows.map((row) => row.email)).toEqual([
      "ann@example.test",
      "ben@example.test",
      "solo@example.test",
    ]);
    expect(rows.find((row) => row.email === "ann@example.test")?.userId).toBe("ann");

    await runner.drainAnnouncementQueue({ sleep: noSleep });
    const deliveries = await db.emailDelivery.findMany({
      where: { campaignId: id, isTest: false },
    });
    expect(deliveries).toHaveLength(3);
    expect(new Set(deliveries.map((row) => row.templateKey))).toEqual(new Set(["campaign.custom"]));
    // The subject's variable was filled from the recipient's own row.
    expect(deliveries.find((row) => row.to === "ann@example.test")?.subject).toBe(
      "Hello Person ann",
    );
    // Ben reads Arabic, which has no words here: the default locale's.
    expect(deliveries.find((row) => row.to === "ben@example.test")?.locale).toBe("en");
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id } });
    expect(campaign.status).toBe("SENT");
    expect(campaign.sentCount).toBe(3);
  });

  it("uses a recipient's own language when it has words in it", async () => {
    const id = await customDraft({ keys: ["all_learners"] });
    await custom.saveCustomEmail(admin, {
      id,
      name: "Monday notice",
      content: { ...WORDS, locale: "ar", subject: "مرحبا" },
    });
    await custom.sendCustomEmailTest(admin, id);
    await announcements.queueAnnouncement(admin, id);
    await runner.drainAnnouncementQueue({ sleep: noSleep });
    const ben = await db.emailDelivery.findFirstOrThrow({
      where: { campaignId: id, to: "ben@example.test" },
    });
    expect(ben.locale).toBe("ar");
    expect(ben.subject).toBe("مرحبا");
  });

  it("reaches staff only through the Staff card, which needs employees.view", async () => {
    const id = await customDraft({ keys: ["staff"] });
    await custom.sendCustomEmailTest(admin, id);
    await announcements.queueAnnouncement(admin, id);
    const rows = await db.emailCampaignRecipient.findMany({ where: { campaignId: id } });
    expect(rows.map((row) => row.email).sort()).toEqual([
      "admin@staff.example",
      "kim@staff.example",
    ]);

    const noEmployees = subject(
      "staff-admin",
      ALL_KEYS.filter((key) => key !== "employees.view"),
    );
    await expect(
      custom.saveCustomEmail(noEmployees, {
        name: "Staff only",
        audience: { keys: ["staff"] },
      }),
    ).rejects.toBeInstanceOf(announcements.AnnouncementPermissionError);
  });

  it("never lets a course announcement carry the Staff card", async () => {
    const id = await customDraft({ keys: ["staff"] });
    await db.emailCampaign.update({
      where: { id },
      data: { kind: "COURSE", targetId: "no-such-course" },
    });
    const detail = await announcements.getAnnouncement(admin, id);
    expect(detail.blockers).toContain("no_audience");
  });

  it("freezes its words once it has left draft", async () => {
    const id = await customDraft({ keys: ["all_learners"] });
    await custom.sendCustomEmailTest(admin, id);
    await announcements.queueAnnouncement(admin, id);
    await expect(
      custom.saveCustomEmail(admin, { id, name: "Changed", content: WORDS }),
    ).rejects.toMatchObject({ reason: "not_draft" });
  });

  it("duplicates its words but not its test", async () => {
    const id = await customDraft({ keys: ["all_learners"] });
    await custom.sendCustomEmailTest(admin, id);
    const copy = await announcements.duplicateAnnouncement(admin, id);
    const draft = await custom.getCustomEmailDraft(admin, copy);
    expect(draft.contents.map((row) => row.bodyHtml)).toEqual([
      "<p>Markets open early on Monday.</p>",
    ]);
    expect(draft.tested).toBe(false);
  });

  it("is refused a test without words in the default language", async () => {
    const id = await custom.saveCustomEmail(admin, {
      name: "Arabic only",
      content: { ...WORDS, locale: "ar" },
    });
    await expect(custom.sendCustomEmailTest(admin, id)).rejects.toMatchObject({
      reason: "no_content",
    });
  });
});

// ─── A direct email ──────────────────────────────────────────

describe("a direct email (ADR-172 #6, #7)", () => {
  const body = {
    designId: null,
    subject: "About your account",
    mode: "RICH" as const,
    bodyHtml: "<p>Hi {{recipient.name}}, a quick note.</p>",
    replyToSelf: false,
  };

  it("is one campaign with one recipient, sent by the runner", async () => {
    const { campaignId } = await custom.sendDirectEmail(admin, {
      ...body,
      recipient: { kind: "user", id: "ann" },
    });
    const rows = await db.emailCampaignRecipient.findMany({ where: { campaignId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "ann@example.test", userId: "ann" });

    await runner.drainAnnouncementQueue({ campaignId, sleep: noSleep });
    const delivery = await db.emailDelivery.findFirstOrThrow({ where: { campaignId } });
    expect(delivery).toMatchObject({ templateKey: "campaign.direct", status: "SENT" });
    // Not in the broadcast list, which leaves direct emails out by default.
    expect((await announcements.listAnnouncements(admin)).map((row) => row.id)).not.toContain(
      campaignId,
    );
    // On the person's record.
    const history = await custom.listEmailsSentToUser(admin, "ann");
    expect(history.map((row) => row.campaignId)).toEqual([campaignId]);
  });

  it("reaches an unsubscribed account holder, and says so in the audit row", async () => {
    await db.emailSuppression.create({
      data: { email: "ann@example.test", scope: "ANNOUNCEMENTS", reason: "UNSUBSCRIBED" },
    });
    const view = await custom.directRecipient(admin, { kind: "user", id: "ann" });
    expect(view).toMatchObject({ suppressed: true, refusal: null });
    const { campaignId } = await custom.sendDirectEmail(admin, {
      ...body,
      recipient: { kind: "user", id: "ann" },
    });
    await runner.drainAnnouncementQueue({ campaignId, sleep: noSleep });
    const row = await db.emailCampaignRecipient.findFirstOrThrow({ where: { campaignId } });
    expect(row.status).toBe("SENT");
    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: "announcements.direct.send" },
    });
    expect(JSON.stringify(audit.changes)).not.toContain("ann@example.test");
  });

  it("reaches a suspended account (it may be telling them why) but not a deleted one", async () => {
    await expect(
      custom.sendDirectEmail(admin, { ...body, recipient: { kind: "user", id: "sue" } }),
    ).resolves.toHaveProperty("campaignId");
    await person("gone", { email: "gone@example.test", deletedAt: new Date() });
    await expect(
      custom.sendDirectEmail(admin, { ...body, recipient: { kind: "user", id: "gone" } }),
    ).rejects.toMatchObject({ reason: "recipient_unavailable" });
  });

  it("refuses a subscriber who is pending, unsubscribed or suppressed", async () => {
    const pending = await subscriber("wait@example.test", "PENDING");
    const left = await subscriber("left@example.test", "UNSUBSCRIBED");
    const quiet = await subscriber("quiet@example.test", "ACTIVE");
    await db.emailSuppression.create({
      data: { email: "quiet@example.test", scope: "ANNOUNCEMENTS", reason: "UNSUBSCRIBED" },
    });
    const send = (id: string) =>
      custom.sendDirectEmail(admin, { ...body, recipient: { kind: "subscriber", id } });
    await expect(send(pending)).rejects.toMatchObject({ reason: "recipient_unavailable" });
    await expect(send(left)).rejects.toMatchObject({ reason: "recipient_unsubscribed" });
    await expect(send(quiet)).rejects.toMatchObject({ reason: "recipient_unsubscribed" });
    expect(await db.emailCampaign.count({ where: { kind: "DIRECT" } })).toBe(0);
  });

  it("holds each author to 30 an hour", async () => {
    await db.emailCampaign.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        kind: "DIRECT" as const,
        name: `Earlier ${index}`,
        audience: { keys: [] },
        status: "SENT" as const,
        createdById: "staff-admin",
      })),
    });
    await expect(
      custom.sendDirectEmail(admin, { ...body, recipient: { kind: "user", id: "ann" } }),
    ).rejects.toMatchObject({ reason: "rate_limited" });
    // Someone else is not held to this author's count.
    const other = subject("kim", ALL_KEYS);
    await expect(
      custom.sendDirectEmail(other, { ...body, recipient: { kind: "user", id: "ann" } }),
    ).resolves.toHaveProperty("campaignId");
  });

  it("needs the right to see the person as well as the direct key, and writes nothing", async () => {
    const noUsers = subject(
      "staff-admin",
      ALL_KEYS.filter((key) => key !== "users.view"),
    );
    await expect(
      custom.sendDirectEmail(noUsers, { ...body, recipient: { kind: "user", id: "ann" } }),
    ).rejects.toBeInstanceOf(announcements.AnnouncementPermissionError);
    const noDirect = subject(
      "staff-admin",
      ALL_KEYS.filter((key) => key !== "announcements.direct"),
    );
    await expect(
      custom.sendDirectEmail(noDirect, { ...body, recipient: { kind: "user", id: "ann" } }),
    ).rejects.toBeInstanceOf(announcements.AnnouncementPermissionError);
    expect(await db.emailCampaign.count()).toBe(0);
  });

  it("sets Reply-To to its author only when asked", async () => {
    const { campaignId } = await custom.sendDirectEmail(admin, {
      ...body,
      replyToSelf: true,
      recipient: { kind: "user", id: "ann" },
    });
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.replyToSelf).toBe(true);
  });
});
