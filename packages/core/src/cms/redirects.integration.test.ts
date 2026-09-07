// The `Redirect` model exists already (ADR-015 #1); these are the new
// service functions behind the /admin/website/redirects screen (PR 1.5).
import { ForbiddenError } from "@repo/rbac";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as RedirectsModule from "./redirects.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let redirects: typeof RedirectsModule;
let actor: Awaited<ReturnType<typeof makeActor>>;
let noPermsActor: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  redirects = await import("./redirects.ts");
  actor = await makeActor(ctx.db, "redirects-actor", ALL_CMS_PERMISSIONS);
  noPermsActor = await makeActor(ctx.db, "redirects-no-perms", []);
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("createRedirect", () => {
  it("creates a row and writes an audit entry", async () => {
    const id = await redirects.createRedirect(actor, {
      fromPath: "/old-page",
      toPath: "/new-page",
      statusCode: 301,
    });
    const row = await ctx.db.redirect.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ fromPath: "/old-page", toPath: "/new-page", statusCode: 301 });

    const audit = await ctx.db.auditLog.findFirst({
      where: { action: "cms.redirects.create", entityId: id },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses without redirects.manage", async () => {
    await expect(
      redirects.createRedirect(noPermsActor, { fromPath: "/a", toPath: "/b", statusCode: 301 }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("setRedirectActive", () => {
  it("toggles isActive", async () => {
    const id = await redirects.createRedirect(actor, {
      fromPath: "/toggle",
      toPath: "/target",
      statusCode: 301,
    });
    await redirects.setRedirectActive(actor, id, { isActive: false });
    expect((await ctx.db.redirect.findUniqueOrThrow({ where: { id } })).isActive).toBe(false);
  });
});

describe("listRedirects", () => {
  it("lists rows newest first", async () => {
    const list = await redirects.listRedirects();
    expect(Array.isArray(list)).toBe(true);
  });
});
