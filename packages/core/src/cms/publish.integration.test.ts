// Publishing workflow (plan v2.2 §10): snapshot semantics, unpublish,
// rollback, the ADR-025 isolation property ("publishing A does not flush
// B's cache"), and the permission gate at the service level.
import { ForbiddenError } from "@repo/rbac";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type * as PagesModule from "./pages.ts";
import type * as PublishModule from "./publish.ts";
import type * as PublicPagesModule from "./public-pages.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";
import { resetRevalidateTagCalls, revalidateTagCalls } from "../test-utils/next-cache-stub.ts";

let ctx: CmsTestContext;
let pages: typeof PagesModule;
let publish: typeof PublishModule;
let publicPages: typeof PublicPagesModule;
let actor: Awaited<ReturnType<typeof makeActor>>;
let noPublishActor: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  pages = await import("./pages.ts");
  publish = await import("./publish.ts");
  publicPages = await import("./public-pages.ts");
  actor = await makeActor(ctx.db, "publish-actor", ALL_CMS_PERMISSIONS);
  noPublishActor = await makeActor(ctx.db, "no-publish-actor", [
    "cms.pages.create",
    "cms.pages.update",
  ]);
}, 120_000);

afterEach(() => {
  resetRevalidateTagCalls();
});

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("publishPage", () => {
  it("snapshots the draft into version 1, leaves the draft editable, and points publishedVersionId", async () => {
    const id = await pages.createPage(actor, { title: "Publish Me", slug: "publish-me" });
    const versionNumber = await publish.publishPage(actor, id, {});
    expect(versionNumber).toBe(1);

    const page = await ctx.db.page.findUniqueOrThrow({ where: { id } });
    expect(page.status).toBe("PUBLISHED");
    expect(page.publishedVersionId).not.toBeNull();

    const snapshot = await ctx.db.pageVersion.findUniqueOrThrow({
      where: { id: page.publishedVersionId! },
    });
    expect(snapshot.number).toBe(1);

    const draft = await ctx.db.pageVersion.findUniqueOrThrow({
      where: { id: page.draftVersionId! },
    });
    expect(draft.number).toBe(0); // the draft is never renumbered
  });

  it("refuses without cms.pages.publish — no snapshot row is written", async () => {
    const id = await pages.createPage(actor, { title: "Denied Publish", slug: "denied-publish" });
    const before = await ctx.db.pageVersion.count({ where: { pageId: id } });

    await expect(publish.publishPage(noPublishActor, id, {})).rejects.toThrow(ForbiddenError);

    expect(await ctx.db.pageVersion.count({ where: { pageId: id } })).toBe(before);
    const page = await ctx.db.page.findUniqueOrThrow({ where: { id } });
    expect(page.publishedVersionId).toBeNull();
  });

  it("writes an audit row", async () => {
    const id = await pages.createPage(actor, { title: "Audit Publish", slug: "audit-publish" });
    await publish.publishPage(actor, id, { note: "first release" });
    const row = await ctx.db.auditLog.findFirst({
      where: { action: "cms.pages.publish", entityId: id },
    });
    expect(row).not.toBeNull();
  });
});

describe("cache tag isolation (ADR-025)", () => {
  it("publishing page A records only A's tags, never page B's", async () => {
    const a = await pages.createPage(actor, { title: "Page A", slug: "isolation-a" });
    const b = await pages.createPage(actor, { title: "Page B", slug: "isolation-b" });

    resetRevalidateTagCalls();
    await publish.publishPage(actor, a, {});

    const tags = revalidateTagCalls.map((c) => c.tag);
    expect(tags).toContain(`page:${a}`);
    expect(tags).toContain("page-path:en:/isolation-a");
    expect(tags).not.toContain(`page:${b}`);
    expect(tags).not.toContain("page-path:en:/isolation-b");
  });
});

describe("unpublishPage", () => {
  it("makes resolvePublicPage return not-found", async () => {
    const id = await pages.createPage(actor, { title: "Unpublish Me", slug: "unpublish-me" });
    await publish.publishPage(actor, id, {});
    expect((await publicPages.resolvePublicPage("en", "/unpublish-me")).kind).toBe("page");

    await publish.unpublishPage(actor, id);
    expect((await publicPages.resolvePublicPage("en", "/unpublish-me")).kind).toBe("not-found");

    const page = await ctx.db.page.findUniqueOrThrow({ where: { id } });
    expect(page.publishedVersionId).toBeNull();
  });
});

describe("rollbackPage", () => {
  it("moves the published pointer to an earlier version", async () => {
    const id = await pages.createPage(actor, { title: "Rollback Me", slug: "rollback-me" });
    await publish.publishPage(actor, id, { note: "v1" });
    const v1 = (await ctx.db.page.findUniqueOrThrow({ where: { id } })).publishedVersionId;

    await publish.publishPage(actor, id, { note: "v2" });

    await publish.rollbackPage(actor, id, 1);
    const page = await ctx.db.page.findUniqueOrThrow({ where: { id } });
    expect(page.publishedVersionId).toBe(v1);
    expect(page.status).toBe("PUBLISHED");
  });
});

describe("resolvePublicPage", () => {
  it("resolves the home page at '/'", async () => {
    const home = await ctx.db.page.upsert({
      where: { key: "home" },
      update: {},
      create: { key: "home", kind: "STATIC", createdById: "test" },
    });
    await ctx.db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: home.id, locale: "en" } },
      update: {},
      create: { pageId: home.id, locale: "en", title: "Home", slug: "", path: "/" },
    });
    if (!home.draftVersionId) {
      const draft = await ctx.db.pageVersion.create({
        data: { pageId: home.id, number: 0, layout: { version: 1, nodes: [] }, authorId: "test" },
      });
      await ctx.db.page.update({ where: { id: home.id }, data: { draftVersionId: draft.id } });
    }
    await publish.publishPage(actor, home.id, {});

    const resolved = await publicPages.resolvePublicPage("en", "/");
    expect(resolved.kind).toBe("page");
  });

  it("never resolves a reserved path as a CMS page", async () => {
    const resolved = await publicPages.resolvePublicPage("en", "/news");
    expect(resolved.kind).toBe("not-found");
  });

  it("returns a redirect result when one exists ahead of a published page", async () => {
    await ctx.db.redirect.create({
      data: { fromPath: "/redirect-source", toPath: "/redirect-target", statusCode: 301 },
    });
    const resolved = await publicPages.resolvePublicPage("en", "/redirect-source");
    expect(resolved).toEqual({ kind: "redirect", to: "/redirect-target" });
  });
});
