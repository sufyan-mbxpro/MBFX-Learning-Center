// changes-49 (ADR-147): permanent delete against a real MariaDB. What earns
// the container is that the rule is cross-table: the row goes, its cascade
// goes with it, and the polymorphic references that have no FK go in the same
// transaction — none of which a mocked client could show.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as ContentModule from "./content.ts";
import type * as PurgeModule from "./purge.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let content: typeof ContentModule;
let purge: typeof PurgeModule;
let editor: Subject;

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
  content = await import("./content.ts");
  purge = await import("./purge.ts");

  const staff = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "purger@x.com",
      name: "Purger",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  editor = {
    id: staff.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 60,
    allowed: new Set(["glossary.view", "glossary.update", "glossary.delete"]),
    denied: new Set(),
  };
}, 240_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

describe("purgeContent", () => {
  it("refuses a row that is not in the trash", async () => {
    const termId = await content.createGlossaryTerm(editor);
    await expect(purge.purgeContent(editor, "glossary", termId)).rejects.toBeInstanceOf(
      purge.NotInTrashError,
    );
    expect(await db.glossaryTerm.findUnique({ where: { id: termId } })).not.toBeNull();
  });

  it("refuses an actor without the entity's delete key, even for a trashed row", async () => {
    const termId = await content.createGlossaryTerm(editor);
    await content.setGlossaryTermDeleted(editor, termId, true);
    const noDelete: Subject = { ...editor, allowed: new Set(["glossary.view"]) };
    await expect(purge.purgeContent(noDelete, "glossary", termId)).rejects.toBeInstanceOf(
      purge.PurgePermissionError,
    );
  });

  it("deletes a trashed row with its translations and the references that pointed at it, and audits it", async () => {
    const termId = await content.createGlossaryTerm(editor);
    await db.glossaryTermTranslation.create({
      data: {
        termId,
        locale: "en",
        term: "Pip",
        slug: `pip-${Date.now()}`,
        simpleExplanation: "<p>The smallest price step.</p>",
      },
    });
    await db.contentReference.create({
      data: {
        sourceType: "ARTICLE",
        sourceId: "some-article",
        refType: "GLOSSARY_TERM",
        refId: termId,
      },
    });
    await content.setGlossaryTermDeleted(editor, termId, true);

    await purge.purgeContent(editor, "glossary", termId);

    expect(await db.glossaryTerm.findUnique({ where: { id: termId } })).toBeNull();
    expect(await db.glossaryTermTranslation.count({ where: { termId } })).toBe(0);
    expect(await db.contentReference.count({ where: { refId: termId } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "glossary.purge", entityId: termId } })).toBe(
      1,
    );
  });
});
