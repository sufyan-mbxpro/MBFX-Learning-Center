// ADR-156 against a real MariaDB: the settings tab's save, and the guard on
// the credential endpoints reading what it saved. Google is faked at the
// network edge (testing.md: MSW-style, never our own packages).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { db as PrismaDb } from "@repo/db";
import type * as CaptchaModule from "./captcha.ts";
import type { authInstance as AuthInstance } from "./index.ts";

// `revalidateTag` needs a Next request store; the tag itself is asserted.
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, cacheTag: () => {}, cacheLife: () => {} }));

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof PrismaDb;
let captcha: typeof CaptchaModule;
let authInstance: typeof AuthInstance;

/** A real user: the audit row's `userId` is a foreign key. */
let ACTOR = "";
const SEAL_KEY = Buffer.alloc(32, 7).toString("base64");

/** Google's siteverify, answering `verdict` for every token. */
function google(verdict: { success: boolean; score?: number; action?: string }) {
  const fake = vi.fn(async () => Response.json(verdict));
  vi.stubGlobal("fetch", fake);
  return fake;
}

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
  process.env.CAPTCHA_SECRET_KEY = SEAL_KEY;
  delete process.env.CAPTCHA_DISABLED;
  ({ db } = await import("@repo/db"));
  captcha = await import("./captcha.ts");
  ({ authInstance } = await import("./index.ts"));
  const staff = await authInstance.api.signUpEmail({
    body: {
      email: "captcha-admin@example.com",
      password: "correct horse battery 42",
      name: "Admin",
    },
  });
  ACTOR = staff.user.id;
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.captchaConfig.deleteMany();
});

const ON = { enabled: true, siteKey: "site-key", minScore: 0.5 } as const;

describe("saveCaptchaSettings", () => {
  it("switching on needs a secret", async () => {
    await expect(captcha.saveCaptchaSettings(ACTOR, { ...ON, checkToken: "t" })).resolves.toEqual({
      ok: false,
      reason: "secretRequired",
    });
    expect(await db.captchaConfig.count()).toBe(0);
  });

  it("switching on needs a `check` token that passes with THESE keys, and writes nothing otherwise", async () => {
    google({ success: true, score: 0.9, action: "auth" });
    await expect(
      captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "google-secret", checkToken: "t" }),
    ).resolves.toEqual({ ok: false, reason: "checkFailed" });
    expect(await db.captchaConfig.count()).toBe(0);
  });

  it("a passing check saves the row, seals the secret, audits, and revalidates", async () => {
    const siteverify = google({ success: true, score: 0.9, action: "check" });
    await expect(
      captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "google-secret", checkToken: "t" }),
    ).resolves.toEqual({ ok: true });

    const init = (siteverify.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(new URLSearchParams(String(init.body)).get("secret")).toBe("google-secret");

    const row = await db.captchaConfig.findUniqueOrThrow({ where: { id: "default" } });
    expect(row.enabled).toBe(true);
    expect(row.secretKeyCipher).not.toContain("google-secret");
    expect(row.lastVerifiedAt).not.toBeNull();

    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: "settings.captcha.update" },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.stringify(audit.changes)).not.toContain("google-secret");
    expect(revalidateTag).toHaveBeenCalledWith("settings:captcha", { expire: 0 });

    const view = await captcha.loadCaptchaSettings();
    expect(view).toMatchObject({ enabled: true, siteKey: "site-key", hasSecretKey: true });
    expect(JSON.stringify(view)).not.toContain("google-secret");
  });

  it("a blank secret keeps the saved one", async () => {
    google({ success: true, score: 0.9, action: "check" });
    await captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "first", checkToken: "t" });
    const siteverify = google({ success: true, score: 0.9, action: "check" });
    await expect(
      captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "", checkToken: "t" }),
    ).resolves.toEqual({ ok: true });
    const init = (siteverify.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(new URLSearchParams(String(init.body)).get("secret")).toBe("first");
  });

  it("switching off needs no check, and the guard is off at once", async () => {
    google({ success: true, score: 0.9, action: "check" });
    await captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "s", checkToken: "t" });
    expect(await captcha.loadCaptchaRuntime()).not.toBeNull();
    await expect(captcha.saveCaptchaSettings(ACTOR, { ...ON, enabled: false })).resolves.toEqual({
      ok: true,
    });
    expect(await captcha.loadCaptchaRuntime()).toBeNull();
  });

  it("CAPTCHA_DISABLED switches it off whatever the row says", async () => {
    google({ success: true, score: 0.9, action: "check" });
    await captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "s", checkToken: "t" });
    process.env.CAPTCHA_DISABLED = "1";
    try {
      expect(await captcha.loadCaptchaRuntime()).toBeNull();
    } finally {
      delete process.env.CAPTCHA_DISABLED;
    }
  });
});

describe("the guard on /sign-in/email", () => {
  /** The refusal body: `{ code, message }` from the guard or the endpoint. */
  const codeOf = async (response: Response) => ((await response.json()) as { code?: string }).code;
  const signIn = (headers: Record<string, string> = {}) =>
    authInstance.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password-1" }),
      }),
    );

  it("does nothing while switched off: the endpoint answers as it always did", async () => {
    const response = await signIn();
    expect(await codeOf(response)).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("switched on, refuses a request with no token (400) and a failing one (403)", async () => {
    google({ success: true, score: 0.9, action: "check" });
    await captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "s", checkToken: "t" });

    const missing = await signIn();
    expect(missing.status).toBe(400);
    expect(await codeOf(missing)).toBe("MISSING_RESPONSE");

    google({ success: true, score: 0.1, action: "auth" });
    const failing = await signIn({ "x-captcha-response": "bot" });
    expect(failing.status).toBe(403);
    expect(await codeOf(failing)).toBe("VERIFICATION_FAILED");
  });

  it("switched on, lets a passing `auth` token through to the endpoint", async () => {
    google({ success: true, score: 0.9, action: "check" });
    await captcha.saveCaptchaSettings(ACTOR, { ...ON, secretKey: "s", checkToken: "t" });
    google({ success: true, score: 0.9, action: "auth" });
    const response = await signIn({ "x-captcha-response": "human" });
    expect(await codeOf(response)).toBe("INVALID_EMAIL_OR_PASSWORD");
  });
});
