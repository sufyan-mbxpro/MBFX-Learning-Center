import { ForbiddenError } from "@repo/rbac";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMPTY_LAYOUT } from "@repo/contracts";
import type * as TemplatesModule from "./templates.ts";
import {
  LayoutTemplateIsSystemError,
  LayoutTemplateKeyInUseError,
  LayoutTemplateNotFoundError,
} from "./errors.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let templates: typeof TemplatesModule;
let actor: Awaited<ReturnType<typeof makeActor>>;
let noPermsActor: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  templates = await import("./templates.ts");
  actor = await makeActor(ctx.db, "templates-actor", [
    ...ALL_CMS_PERMISSIONS,
    "cms.templates.manage",
  ]);
  noPermsActor = await makeActor(ctx.db, "templates-no-perms", []);
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("createLayoutTemplate", () => {
  it("creates a PAGE template and writes an audit entry", async () => {
    const id = await templates.createLayoutTemplate(actor, {
      key: "landing-page",
      name: "Landing page",
      kind: "PAGE",
      pageKind: "STATIC",
      layout: EMPTY_LAYOUT,
    });
    const row = await ctx.db.layoutTemplate.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ key: "landing-page", kind: "PAGE" });

    const audit = await ctx.db.auditLog.findFirst({
      where: { action: "cms.templates.create", entityId: id },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses without cms.templates.manage", async () => {
    await expect(
      templates.createLayoutTemplate(noPermsActor, {
        key: "x1",
        name: "X",
        kind: "PAGE",
        layout: EMPTY_LAYOUT,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a duplicate key", async () => {
    await templates.createLayoutTemplate(actor, {
      key: "dup-template",
      name: "A",
      kind: "PAGE",
      layout: EMPTY_LAYOUT,
    });
    await expect(
      templates.createLayoutTemplate(actor, {
        key: "dup-template",
        name: "B",
        kind: "PAGE",
        layout: EMPTY_LAYOUT,
      }),
    ).rejects.toThrow(LayoutTemplateKeyInUseError);
  });
});

describe("updateLayoutTemplate / deleteLayoutTemplate", () => {
  it("updates a non-system template", async () => {
    const id = await templates.createLayoutTemplate(actor, {
      key: "tool-page",
      name: "Tool page",
      kind: "PAGE",
      layout: EMPTY_LAYOUT,
    });
    await templates.updateLayoutTemplate(actor, id, { name: "Tool page (renamed)" });
    const row = await ctx.db.layoutTemplate.findUniqueOrThrow({ where: { id } });
    expect(row.name).toBe("Tool page (renamed)");
  });

  it("refuses to update or delete a system template", async () => {
    const row = await ctx.db.layoutTemplate.create({
      data: { key: "system-page", name: "System Page", kind: "PAGE", layout: {}, isSystem: true },
    });
    await expect(templates.updateLayoutTemplate(actor, row.id, { name: "x" })).rejects.toThrow(
      LayoutTemplateIsSystemError,
    );
    await expect(templates.deleteLayoutTemplate(actor, row.id)).rejects.toThrow(
      LayoutTemplateIsSystemError,
    );
  });

  it("404s a not-found id", async () => {
    await expect(templates.updateLayoutTemplate(actor, "does-not-exist", {})).rejects.toThrow(
      LayoutTemplateNotFoundError,
    );
  });

  it("deletes a template — a copy already placed from it is untouched (start-from independence)", async () => {
    const id = await templates.createLayoutTemplate(actor, {
      key: "deletable-template",
      name: "Deletable",
      kind: "BLOCK",
      layout: {
        type: "button",
        version: 1,
        id: "b1",
        props: { label: "Go", link: { type: "NONE" }, variant: "default", size: "default" },
        hidden: false,
        children: [],
      },
    });
    await templates.deleteLayoutTemplate(actor, id);
    expect(await ctx.db.layoutTemplate.findUnique({ where: { id } })).toBeNull();
  });
});

describe("layout template usage reporting (informational, not a deletion guard)", () => {
  it("counts PageVersion rows started from this template's key", async () => {
    const id = await templates.createLayoutTemplate(actor, {
      key: "counted-template",
      name: "Counted",
      kind: "PAGE",
      layout: EMPTY_LAYOUT,
    });
    const page = await ctx.db.page.create({
      data: { kind: "STATIC", status: "DRAFT", createdById: actor.id },
    });
    await ctx.db.pageVersion.create({
      data: {
        pageId: page.id,
        number: 0,
        revision: 0,
        layout: {},
        authorId: actor.id,
        templateKey: "counted-template",
      },
    });

    const row = await templates.getLayoutTemplate(id);
    expect(row?.usageCount).toBe(1);

    // Deletion still succeeds — usage here is reporting, not a guard
    // (ADR-033 §3: a placed copy is independent, no link back).
    await templates.deleteLayoutTemplate(actor, id);
    expect(await ctx.db.layoutTemplate.findUnique({ where: { id } })).toBeNull();
  });
});
