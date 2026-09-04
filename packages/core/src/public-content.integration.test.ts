// Module 12 public reads against real MariaDB: published-only scoping,
// fallback-chain locale resolution (incl. the ar not-translated case),
// slug lookup + redirect table, sitemap feed.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as PublicContent from "./public-content.ts";
import type * as Content from "./content.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let pub: typeof PublicContent;
let content: typeof Content;
let actor: Subject;

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
  db = (await import("@repo/db")).db;
  pub = await import("./public-content.ts");
  content = await import("./content.ts");

  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "pub-actor@x.com",
      name: "A",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  actor = {
    id: user.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 50,
    allowed: new Set(["glossary.publish"]),
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
        code: "es",
        name: "Spanish",
        nativeName: "Español",
        direction: "LTR",
        isActive: true,
        sortOrder: 2,
        fallbackCode: "en",
      },
      {
        code: "ar",
        name: "Arabic",
        nativeName: "العربية",
        direction: "RTL",
        isActive: true,
        sortOrder: 3,
      },
    ],
  });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

async function publishedTerm(name: string, opts: { es?: boolean } = {}) {
  const termId = await content.createGlossaryTerm(actor);
  await content.saveGlossaryTranslation(actor, {
    termId,
    locale: "en",
    term: name,
    simpleExplanation: `<p>${name} explained</p>`,
  });
  if (opts.es) {
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "es",
      term: `${name} ES`,
      simpleExplanation: `<p>${name} en español</p>`,
    });
  }
  await content.transitionContentStatus(actor, "glossary", termId, "IN_REVIEW");
  await content.transitionContentStatus(actor, "glossary", termId, "SEO_REVIEW");
  await content.transitionContentStatus(actor, "glossary", termId, "APPROVED");
  await content.transitionContentStatus(actor, "glossary", termId, "PUBLISHED");
  return termId;
}

describe("loadPublishedGlossary", () => {
  it("lists ONLY published terms — a draft can't leak into the public payload", async () => {
    const published = await publishedTerm("Leverage");
    const draftId = await content.createGlossaryTerm(actor);
    await content.saveGlossaryTranslation(actor, {
      termId: draftId,
      locale: "en",
      term: "DraftOnly",
      simpleExplanation: "<p>x</p>",
    });

    const list = await pub.loadPublishedGlossary("en");
    expect(list.map((e) => e.termId)).toContain(published);
    expect(list.map((e) => e.termId)).not.toContain(draftId);
  });

  it("es resolves through its chain (es row when present, en fallback otherwise); ar omits untranslated terms entirely (ADR-007)", async () => {
    const withEs = await publishedTerm("Margin", { es: true });
    const enOnly = await publishedTerm("Swap");

    const esList = await pub.loadPublishedGlossary("es");
    expect(esList.find((e) => e.termId === withEs)?.term).toBe("Margin ES");
    expect(esList.find((e) => e.termId === enOnly)?.term).toBe("Swap"); // en fallback

    const arList = await pub.loadPublishedGlossary("ar");
    expect(arList.find((e) => e.termId === enOnly)).toBeUndefined(); // no silent English
  });
});

describe("loadGlossaryTermBySlug", () => {
  it("resolves the per-locale slug; unknown slug is null; the redirect table covers a changed slug", async () => {
    const termId = await publishedTerm("Pipette");
    await content.saveGlossaryTranslation(actor, {
      termId,
      locale: "en",
      term: "Pipette",
      slug: "pipette-renamed",
      simpleExplanation: "<p>Pipette explained</p>",
    });

    const view = await pub.loadGlossaryTermBySlug("en", "pipette-renamed");
    expect(view?.term).toBe("Pipette");
    expect(view?.requestedLocaleMissing).toBe(false);

    expect(await pub.loadGlossaryTermBySlug("en", "pipette")).toBeNull();
    expect(await pub.lookupRedirect("/glossary/pipette")).toBe("/glossary/pipette-renamed");
    expect(await pub.lookupRedirect("/glossary/never-existed")).toBeNull();
  });
});

describe("loadGlossarySitemapEntries", () => {
  it("feeds every published translation's locale+slug and nothing unpublished", async () => {
    const entries = await pub.loadGlossarySitemapEntries();
    expect(entries.some((e) => e.locale === "es")).toBe(true);
    expect(entries.every((e) => e.slug.length > 0)).toBe(true);
    // DraftOnly (never published) must not appear.
    expect(entries.some((e) => e.slug === "draftonly")).toBe(false);
  });
});
