// The send path end to end (ADR-078 #9, #10, #11), against a real database
// and a real SMTP server. Everything asserted here is a rule that only shows
// up in production otherwise: which switch suppresses what, what the log is
// allowed to remember, and whether a dead mail server can take a sign-up down.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as SendModule from "./send.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

const RESET_TOKEN = "super-secret-reset-token-42";
const RESET_URL = `https://example.com/reset-password?token=${RESET_TOKEN}`;

let maria: StartedMariaDbContainer;
let mailpit: StartedTestContainer;
let apiPort: number;
let db: typeof DbClient;
let send: typeof SendModule;

async function inbox(): Promise<{ Subject: string; To: { Address: string }[] }[]> {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1/messages`);
  const body = (await response.json()) as {
    messages: { Subject: string; To: { Address: string }[] }[];
  };
  return body.messages;
}

async function clearInbox() {
  await fetch(`http://127.0.0.1:${apiPort}/api/v1/messages`, { method: "DELETE" });
}

async function setSetting(key: string, value: unknown) {
  await db.setting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, groupName: "email", label: key, value: value as never, type: "STRING" },
  });
}

async function useSmtp() {
  await db.emailTransport.upsert({
    where: { id: "default" },
    update: {
      driver: "SMTP",
      host: "127.0.0.1",
      port: mailpit.getMappedPort(1025),
      security: "NONE",
    },
    create: {
      id: "default",
      driver: "SMTP",
      host: "127.0.0.1",
      port: mailpit.getMappedPort(1025),
      security: "NONE",
    },
  });
}

beforeAll(async () => {
  [maria, mailpit] = await Promise.all([
    new MariaDbContainer("mariadb:11.4")
      .withDatabase("mbfx_test")
      .withUsername("test")
      .withUserPassword("test")
      .start(),
    new GenericContainer("axllent/mailpit:latest")
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),
  ]);
  apiPort = mailpit.getMappedPort(8025);

  const url = maria.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  db = (await import("@repo/db")).db;
  send = await import("./send.ts");

  await setSetting("site.name", "MBX Learning Center");
  await setSetting("email.fromName", "MBX Learning Center");
  await setSetting("email.fromEmail", "no-reply@example.com");
}, 240_000);

afterEach(async () => {
  await db.emailDelivery.deleteMany();
  await db.emailTemplate.deleteMany();
  await db.emailTransport.deleteMany();
  await clearInbox();
});

afterAll(async () => {
  await db?.$disconnect();
  await Promise.all([maria?.stop(), mailpit?.stop()]);
});

async function seedResetTemplate({ isActive = true }: { isActive?: boolean } = {}) {
  await db.emailTemplate.create({
    data: {
      key: "auth.password_reset",
      isActive,
      translations: {
        create: {
          locale: "en",
          subject: "Reset your password",
          mode: "RICH",
          bodyHtml: '<p>Hello {{recipient.name}}</p><p><a href="{{reset.url}}">Reset</a></p>',
        },
      },
    },
  });
}

const sendReset = () =>
  send.sendTemplatedEmail({
    key: "auth.password_reset",
    to: "learner@example.com",
    recipientName: "Alex",
    variables: { "reset.url": RESET_URL, "expires.minutes": "30" },
  });

describe("sendTemplatedEmail", () => {
  it("delivers, and records what it sent", async () => {
    await setSetting("email.enabled", true);
    await seedResetTemplate();
    await useSmtp();

    const result = await sendReset();
    expect(result.status).toBe("SENT");

    const messages = await inbox();
    expect(messages).toHaveLength(1);
    expect(messages[0]?.Subject).toBe("Reset your password");
    expect(messages[0]?.To[0]?.Address).toBe("learner@example.com");

    const row = await db.emailDelivery.findUniqueOrThrow({ where: { id: result.deliveryId } });
    expect(row.status).toBe("SENT");
    expect(row.templateKey).toBe("auth.password_reset");
    expect(row.providerMessageId).toBeTruthy();
  });

  it("keeps the reset link OUT of the delivery log", async () => {
    // ADR-078 #10: a reset link an admin can read is a second interception
    // path. The row must remember the attempt, not the message.
    await setSetting("email.enabled", true);
    await seedResetTemplate();
    await useSmtp();

    const result = await sendReset();
    const row = await db.emailDelivery.findUniqueOrThrow({ where: { id: result.deliveryId } });
    expect(JSON.stringify(row)).not.toContain(RESET_TOKEN);
    expect(JSON.stringify(row)).not.toContain("<p>");
  });

  it("suppresses everything when the global switch is off", async () => {
    await setSetting("email.enabled", false);
    await seedResetTemplate();
    await useSmtp();

    const result = await sendReset();
    expect(result.status).toBe("SUPPRESSED");
    expect(await inbox()).toHaveLength(0);
    await expect(db.emailDelivery.count()).resolves.toBe(1);
  });

  it("suppresses an inactive template — unless it is a test send", async () => {
    await setSetting("email.enabled", true);
    await seedResetTemplate({ isActive: false });
    await useSmtp();

    expect((await sendReset()).status).toBe("SUPPRESSED");
    expect(await inbox()).toHaveLength(0);

    // You have to be able to check a template before switching it on.
    const test = await send.sendTemplatedEmail({
      key: "auth.password_reset",
      to: "staff@example.com",
      recipientName: "Sam",
      variables: { "reset.url": RESET_URL, "expires.minutes": "30" },
      isTest: true,
    });
    expect(test.status).toBe("SENT");
    expect(await inbox()).toHaveLength(1);
  });

  it("refuses a test send while the global switch is off", async () => {
    await setSetting("email.enabled", false);
    await seedResetTemplate({ isActive: false });
    await useSmtp();

    const result = await send.sendTemplatedEmail({
      key: "auth.password_reset",
      to: "staff@example.com",
      variables: { "reset.url": RESET_URL, "expires.minutes": "30" },
      isTest: true,
    });
    expect(result.status).toBe("SUPPRESSED");
    expect(await inbox()).toHaveLength(0);
  });

  it("falls back to the default locale", async () => {
    await setSetting("email.enabled", true);
    await seedResetTemplate();
    await useSmtp();

    const result = await send.sendTemplatedEmail({
      key: "auth.password_reset",
      to: "learner@example.com",
      locale: "ar",
      variables: { "reset.url": RESET_URL, "expires.minutes": "30" },
    });
    expect(result.status).toBe("SENT");
    expect(await inbox()).toHaveLength(1);
  });

  // ADR-131: a key the registry added after this database was seeded is
  // restored from its code default rather than failing with "run the seed".
  it("restores a missing template from its default, and sends", async () => {
    await setSetting("email.enabled", true);
    await useSmtp();

    const result = await sendReset();
    expect(result.status).toBe("SENT");
    const row = await db.emailTemplate.findUniqueOrThrow({
      where: { key: "auth.password_reset" },
      include: { translations: true },
    });
    expect(row.translations.map((translation) => translation.locale)).toEqual(["en"]);
  });

  // Create-only, like the seed: restoring must never undo an admin's choice.
  it("does not switch a template back on when it restores its content", async () => {
    await setSetting("email.enabled", true);
    await useSmtp();
    await db.emailTemplate.create({ data: { key: "auth.password_reset", isActive: false } });

    const result = await sendReset();
    expect(result.status).toBe("SUPPRESSED");
    const row = await db.emailTemplate.findUniqueOrThrow({ where: { key: "auth.password_reset" } });
    expect(row.isActive).toBe(false);
  });

  it("fails, without throwing, when the mail server is unreachable", async () => {
    // The whole point of returning rather than throwing: a dead mail server
    // must not take down the sign-up that triggered this.
    await setSetting("email.enabled", true);
    await seedResetTemplate();
    await db.emailTransport.create({
      data: { id: "default", driver: "SMTP", host: "127.0.0.1", port: 1, security: "NONE" },
    });

    const result = await sendReset();
    expect(result.status).toBe("FAILED");
    const row = await db.emailDelivery.findUniqueOrThrow({ where: { id: result.deliveryId } });
    expect(row.status).toBe("FAILED");
    expect(row.reason).toBeTruthy();
  });

  it("fails when a required variable never arrives", async () => {
    await setSetting("email.enabled", true);
    await seedResetTemplate();
    await useSmtp();

    const result = await send.sendTemplatedEmail({
      key: "auth.password_reset",
      to: "learner@example.com",
      variables: { "expires.minutes": "30" },
    });
    expect(result.status).toBe("FAILED");
    expect(await inbox()).toHaveLength(0);
  });
});

describe("verifyTransport", () => {
  it("records a success", async () => {
    await useSmtp();
    await expect(send.verifyTransport()).resolves.toEqual({ ok: true });
    const row = await db.emailTransport.findUniqueOrThrow({ where: { id: "default" } });
    expect(row.lastVerifiedAt).toBeTruthy();
    expect(row.lastError).toBeNull();
  });

  it("records a failure instead of throwing", async () => {
    await db.emailTransport.create({
      data: { id: "default", driver: "SMTP", host: "127.0.0.1", port: 1, security: "NONE" },
    });
    const result = await send.verifyTransport();
    expect(result.ok).toBe(false);
    const row = await db.emailTransport.findUniqueOrThrow({ where: { id: "default" } });
    expect(row.lastError).toBeTruthy();
  });
});
