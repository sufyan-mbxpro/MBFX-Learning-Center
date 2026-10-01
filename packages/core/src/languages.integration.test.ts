// ADR-178 on a real MariaDB, with Google faked at the network edge (MSW):
// languages are created from the registry, edited, and deleted only when
// nothing written in them would be lost; interface text is saved, reset and
// machine-filled as overrides, and the activation gate counts them.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import type { db as DbClient } from "@repo/db";
import { generateSecretKey } from "@repo/secrets";
import { fakeGoogleTranslate } from "@repo/translate/testing";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type * as LanguagesModule from "./languages.ts";
import type * as InterfaceTextModule from "./interface-text.ts";
import type * as AdminModule from "./translation-admin.ts";
import type * as I18nModule from "@repo/i18n";
import type * as TranslateModule from "@repo/translate";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const KEY = "AIza-test";

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let languages: typeof LanguagesModule;
let text: typeof InterfaceTextModule;
let admin: typeof AdminModule;
let i18n: typeof I18nModule;
let translate: typeof TranslateModule;
let userId: string;
const server = setupServer();

const french = {
  code: "fr",
  name: "French",
  nativeName: "Français",
  flagEmoji: "",
  fallbackCode: "en",
  sortOrder: 5,
};

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_languages")
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
  process.env.TRANSLATE_SECRET_KEY = generateSecretKey();
  db = (await import("@repo/db")).db;
  languages = await import("./languages.ts");
  text = await import("./interface-text.ts");
  admin = await import("./translation-admin.ts");
  i18n = await import("@repo/i18n");
  translate = await import("@repo/translate");
  server.listen({ onUnhandledRequest: "error" });

  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "languages-crud@x.com",
      name: "Admin",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  userId = user.id;
  await db.locale.createMany({
    data: [
      {
        code: "en",
        name: "English",
        nativeName: "English",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
      { code: "es", name: "Spanish", nativeName: "Español", isActive: false, sortOrder: 2 },
    ],
  });

  server.use(fakeGoogleTranslate({ validKey: KEY }).handler);
  expect(
    await translate.saveTranslateSettings(user.id, {
      enabled: true,
      apiKey: KEY,
      pricePerMillionChars: 20,
      monthlyCharBudget: null,
    }),
  ).toEqual({ ok: true });
  server.resetHandlers();
}, 180_000);

afterAll(async () => {
  server.close();
  await db?.$disconnect();
  await container?.stop();
});

afterEach(() => server.resetHandlers());

describe("language CRUD (ADR-178 #2)", () => {
  it("adds a registry language switched off, with the registry's direction", async () => {
    expect(await languages.createLocale(userId, french)).toEqual({ ok: true });
    const row = await db.locale.findUniqueOrThrow({ where: { code: "fr" } });
    expect(row).toMatchObject({ isActive: false, isDefault: false, direction: "LTR" });
    expect(row.flagEmoji).toBeNull();

    expect(
      await languages.createLocale(userId, {
        ...french,
        code: "fa",
        name: "Persian",
        fallbackCode: null,
      }),
    ).toEqual({ ok: true });
    expect((await db.locale.findUniqueOrThrow({ where: { code: "fa" } })).direction).toBe("RTL");
  });

  it("refuses a code outside the registry, a duplicate, and a bad fallback", async () => {
    expect(await languages.createLocale(userId, { ...french, code: "xx" })).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(await languages.createLocale(userId, french)).toEqual({
      ok: false,
      reason: "exists",
    });
    expect(
      await languages.createLocale(userId, { ...french, code: "de", fallbackCode: "pt" }),
    ).toEqual({ ok: false, reason: "invalidFallback" });
    expect(await languages.updateLocale(userId, { ...french, fallbackCode: "fr" })).toEqual({
      ok: false,
      reason: "invalidFallback",
    });
  });

  it("edits names, flag, fallback and order, and audits it", async () => {
    expect(
      await languages.updateLocale(userId, {
        ...french,
        nativeName: "Le français",
        flagEmoji: "🇫🇷",
        fallbackCode: null,
        sortOrder: 9,
      }),
    ).toEqual({ ok: true });
    expect(await db.locale.findUniqueOrThrow({ where: { code: "fr" } })).toMatchObject({
      nativeName: "Le français",
      flagEmoji: "🇫🇷",
      fallbackCode: null,
      sortOrder: 9,
    });
    expect(await db.auditLog.count({ where: { action: "locales.update", entityId: "fr" } })).toBe(
      1,
    );
  });

  it("refuses to delete the default, a live language, or one with content", async () => {
    expect(await languages.deleteLocale(userId, { locale: "en" })).toEqual({
      ok: false,
      reason: "isDefault",
    });
    expect(await languages.deleteLocale(userId, { locale: "pt" })).toEqual({
      ok: false,
      reason: "notFound",
    });

    await db.locale.update({ where: { code: "fa" }, data: { isActive: true } });
    expect(await languages.deleteLocale(userId, { locale: "fa" })).toEqual({
      ok: false,
      reason: "isActive",
    });
    await db.locale.update({ where: { code: "fa" }, data: { isActive: false } });

    const setting = await db.setting.findFirst({ select: { id: true } });
    const settingId =
      setting?.id ??
      (
        await db.setting.create({
          data: { key: "test.words", groupName: "general", label: "Words", value: "Hello" },
        })
      ).id;
    await db.settingTranslation.create({ data: { settingId, locale: "fa", value: "سلام" } });
    expect(await languages.deleteLocale(userId, { locale: "fa" })).toEqual({
      ok: false,
      reason: "hasContent",
      contentRows: 1,
    });
    expect((await languages.countContentByLocale()).get("fa")).toBe(1);
    expect(await db.locale.count({ where: { code: "fa" } })).toBe(1);
  });

  it("deletes a language with its overrides and clears fallbacks that pointed at it", async () => {
    await languages.createLocale(userId, {
      ...french,
      code: "de",
      name: "German",
      nativeName: "Deutsch",
      fallbackCode: null,
    });
    await db.locale.update({ where: { code: "es" }, data: { fallbackCode: "de" } });
    await db.messageOverride.create({
      data: { locale: "de", key: "learn.difficulty.BEGINNER", value: "Anfänger" },
    });

    expect(await languages.deleteLocale(userId, { locale: "de" })).toEqual({ ok: true });
    expect(await db.locale.count({ where: { code: "de" } })).toBe(0);
    expect(await db.messageOverride.count({ where: { locale: "de" } })).toBe(0);
    expect((await db.locale.findUniqueOrThrow({ where: { code: "es" } })).fallbackCode).toBeNull();
    expect(await db.auditLog.count({ where: { action: "locales.delete", entityId: "de" } })).toBe(
      1,
    );
  });

  it("lists what can still be added, and every row as a fallback choice", async () => {
    const view = await admin.loadLanguagesView();
    expect(view.available.map((l) => l.code)).toContain("de");
    expect(view.available.map((l) => l.code)).not.toContain("fr");
    expect(view.all.map((l) => l.code)).toEqual(expect.arrayContaining(["en", "es", "fr", "fa"]));
    expect(view.rows.find((r) => r.code === "fa")?.contentRows).toBe(1);
  });
});

describe("interface text (ADR-178 #3–#5)", () => {
  const KEY_BEGINNER = "learn.difficulty.BEGINNER";

  it("refuses an admin key, an unknown key, an unknown language and a broken message", async () => {
    const save = (locale: string, key: string, value: string) =>
      text.saveInterfaceText(userId, { locale, key, value });
    expect(await save("fr", "admin.save", "Enregistrer")).toEqual({
      ok: false,
      reason: "adminKey",
    });
    expect(await save("fr", "learn.nope.never", "x")).toEqual({
      ok: false,
      reason: "unknownKey",
    });
    expect(await save("pt", KEY_BEGINNER, "Iniciante")).toEqual({
      ok: false,
      reason: "unknownLocale",
    });
    expect(await save("fr", KEY_BEGINNER, "Débutant {")).toEqual({
      ok: false,
      reason: "invalidSyntax",
    });
    expect(await db.messageOverride.count({ where: { locale: "fr" } })).toBe(0);
  });

  it("saves, shows and resets one string, and the gate counts it", async () => {
    const before = await i18n.publicCatalogGaps("fr");
    expect(
      await text.saveInterfaceText(userId, { locale: "fr", key: KEY_BEGINNER, value: "Débutant" }),
    ).toEqual({ ok: true });
    expect((await i18n.publicCatalogGaps("fr"))!.length).toBe(before!.length - 1);
    expect(await i18n.catalogMessage("fr", KEY_BEGINNER)).toBe("Débutant");

    const view = await text.loadInterfaceText("fr", "learn");
    expect(view.namespace).toBe("learn");
    expect(view.rows.find((r) => r.key === KEY_BEGINNER)).toEqual({
      key: KEY_BEGINNER,
      english: "Beginner",
      value: "Débutant",
      state: "edited",
    });
    expect(view.rows.every((r) => r.key.startsWith("learn."))).toBe(true);
    expect(view.namespaces.some((n) => n.name === "admin" || n.name === "cms")).toBe(false);

    await text.resetInterfaceText(userId, { locale: "fr", key: KEY_BEGINNER });
    expect(await i18n.catalogMessage("fr", KEY_BEGINNER)).toBe("Beginner");
  });

  it("an English edit equal to the shipped text stores nothing", async () => {
    await text.saveInterfaceText(userId, { locale: "en", key: KEY_BEGINNER, value: "Starter" });
    expect(await i18n.catalogMessage("en", KEY_BEGINNER)).toBe("Starter");
    await text.saveInterfaceText(userId, { locale: "en", key: KEY_BEGINNER, value: "Beginner" });
    expect(await db.messageOverride.count({ where: { locale: "en" } })).toBe(0);
  });

  it("machine-fills missing keys in batches without overwriting a person's text", async () => {
    await text.saveInterfaceText(userId, {
      locale: "fr",
      key: KEY_BEGINNER,
      value: "Débutant",
    });
    const google = fakeGoogleTranslate({ validKey: KEY });
    server.use(google.handler);

    const first = await text.fillInterfaceText(userId, { locale: "fr" });
    if (!first.ok) throw new Error(first.reason);
    expect(first.translated).toBeGreaterThan(0);
    expect(first.translated + first.failed).toBeLessThanOrEqual(text.INTERFACE_TEXT_FILL_LIMIT);
    expect(google.calls.length).toBeGreaterThan(0);

    const machine = await db.messageOverride.count({ where: { locale: "fr", isMachine: true } });
    expect(machine).toBe(first.translated);
    expect(await i18n.catalogMessage("fr", KEY_BEGINNER)).toBe("Débutant");

    const second = await text.fillInterfaceText(userId, { locale: "fr" });
    if (!second.ok) throw new Error(second.reason);
    expect(second.remaining).toBeLessThan(first.remaining);

    expect(await text.fillInterfaceText(userId, { locale: "en" })).toEqual({
      ok: false,
      reason: "isDefault",
    });
  });
});
