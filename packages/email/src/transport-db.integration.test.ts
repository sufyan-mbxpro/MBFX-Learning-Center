// `loadTransportDriver` against a real MariaDB (testing.md: mocking Prisma
// hides FK and constraint bugs — don't). It is the ONE reader of
// `passwordCipher` (ADR-078 #3), and its fallbacks decide whether a
// half-configured install sends mail, logs it, or takes sign-up down.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as TransportModule from "./transport.ts";
import type * as SecretModule from "./secret.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

const KEY = "3q2+796tvu/erb7v3q2+796tvu/erb7v3q2+796tvu8=";
const OTHER_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let transport: typeof TransportModule;
let secret: typeof SecretModule;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
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
  process.env.EMAIL_SECRET_KEY = KEY;
  db = (await import("@repo/db")).db;
  transport = await import("./transport.ts");
  secret = await import("./secret.ts");
}, 180_000);

afterEach(async () => {
  vi.unstubAllGlobals();
  process.env.EMAIL_SECRET_KEY = KEY;
  await db.emailTransport.deleteMany();
});

afterAll(async () => {
  delete process.env.EMAIL_SECRET_KEY;
  await db?.$disconnect();
  await container?.stop();
});

async function writeTransport(
  data: Partial<Parameters<typeof db.emailTransport.create>[0]["data"]>,
) {
  return db.emailTransport.create({
    data: { id: transport.TRANSPORT_ID, ...data },
  });
}

describe("loadTransportDriver", () => {
  it("falls back to the log driver when nothing is configured", async () => {
    expect((await transport.loadTransportDriver()).kind).toBe("log");
  });

  it("uses the log driver when the row says so", async () => {
    await writeTransport({ driver: "LOG", host: "smtp.example.com", port: 587 });
    expect((await transport.loadTransportDriver()).kind).toBe("log");
  });

  it("falls back rather than throwing on a half-filled SMTP row", async () => {
    // A form saved without a host must not take sign-up down with it.
    await writeTransport({ driver: "SMTP", port: 587 });
    expect((await transport.loadTransportDriver()).kind).toBe("log");

    await db.emailTransport.deleteMany();
    await writeTransport({ driver: "SMTP", host: "smtp.example.com" });
    expect((await transport.loadTransportDriver()).kind).toBe("log");
  });

  it("builds an SMTP driver from a complete row", async () => {
    await writeTransport({
      driver: "SMTP",
      host: "smtp.example.com",
      port: 587,
      security: "STARTTLS",
      username: "mailer",
      passwordCipher: secret.sealSecret("hunter2"),
    });
    expect((await transport.loadTransportDriver()).kind).toBe("smtp");
  });

  it("works with no stored password at all", async () => {
    await writeTransport({ driver: "SMTP", host: "smtp.example.com", port: 25, security: "NONE" });
    expect((await transport.loadTransportDriver()).kind).toBe("smtp");
  });

  it("actually opens the seal — a changed key fails loudly", async () => {
    // The proof that the stored value is read through the key rather than
    // used as-is: swap the key and loading must fail, not send with garbage.
    await writeTransport({
      driver: "SMTP",
      host: "smtp.example.com",
      port: 587,
      passwordCipher: secret.sealSecret("hunter2"),
    });
    process.env.EMAIL_SECRET_KEY = OTHER_KEY;
    await expect(transport.loadTransportDriver()).rejects.toThrow(secret.EmailSecretInvalidError);
  });

  // ADR-152.
  it("falls back to the log driver on a SendGrid row with no key", async () => {
    await writeTransport({ driver: "SENDGRID" });
    expect((await transport.loadTransportDriver()).kind).toBe("log");
  });

  it("builds a SendGrid driver that sends with the stored key and sandbox flag", async () => {
    await writeTransport({
      driver: "SENDGRID",
      passwordCipher: secret.sealSecret("SG.stored"),
      sandboxMode: true,
    });
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const driver = await transport.loadTransportDriver();
    expect(driver.kind).toBe("sendgrid");
    const result = await driver.send({
      to: "learner@example.com",
      from: { name: "MBX", address: "no-reply@example.com" },
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(result.sandbox).toBe(true);
    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer SG.stored");
    expect(JSON.parse(init?.body as string).mail_settings.sandbox_mode.enable).toBe(true);
  });
});
