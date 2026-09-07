// Module 16 Phase 1 PR 1.3 (plan v2.2 §12): page CRUD, nested-path
// derivation (§5.1), the redirect + shadow-deactivate pair, the cycle/depth
// guard, duplication, the soft-delete guard, and the admin list.
import { ForbiddenError } from "@repo/rbac";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as PagesModule from "./pages.ts";
import type * as TranslationsModule from "./translations.ts";
import {
  CyclicParentError,
  MaxDepthExceededError,
  PageHasChildrenError,
  PathCollisionError,
  ReservedPathError,
} from "./errors.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let pages: typeof PagesModule;
let translations: typeof TranslationsModule;
let actor: Awaited<ReturnType<typeof makeActor>>;
let noPermsActor: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  pages = await import("./pages.ts");
  translations = await import("./translations.ts");
  actor = await makeActor(ctx.db, "cms-actor", ALL_CMS_PERMISSIONS);
  noPermsActor = await makeActor(ctx.db, "cms-no-perms", []);
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("createPage", () => {
  it("creates a page with a root path, a translation, and a mutable draft version", async () => {
    const id = await pages.createPage(actor, { title: "About", slug: "about" });
    const page = await ctx.db.page.findUniqueOrThrow({
      where: { id },
      include: { translations: true, versions: true },
    });
    expect(page.kind).toBe("STATIC");
    expect(page.status).toBe("DRAFT");
    expect(page.translations).toHaveLength(1);
    expect(page.translations[0]).toMatchObject({ slug: "about", path: "/about" });
    expect(page.versions).toHaveLength(1);
    expect(page.versions[0]).toMatchObject({ number: 0, revision: 0 });
    expect(page.draftVersionId).toBe(page.versions[0]?.id);
  });

  it("writes an audit row", async () => {
    const id = await pages.createPage(actor, { title: "Audit Test", slug: "audit-test" });
    const row = await ctx.db.auditLog.findFirst({
      where: { action: "cms.pages.create", entityId: id },
    });
    expect(row).not.toBeNull();
  });

  it("derives a nested path from the parent's path", async () => {
    const toolsId = await pages.createPage(actor, { title: "Tools", slug: "tools" });
    const childId = await pages.createPage(actor, {
      title: "Pip Calculator",
      slug: "pip-calculator",
      parentId: toolsId,
    });
    const child = await ctx.db.pageTranslation.findFirstOrThrow({ where: { pageId: childId } });
    expect(child.path).toBe("/tools/pip-calculator");
  });

  it("refuses a reserved first segment", async () => {
    await expect(pages.createPage(actor, { title: "News", slug: "news" })).rejects.toThrow(
      ReservedPathError,
    );
  });

  it("refuses a colliding path", async () => {
    await pages.createPage(actor, { title: "Contact", slug: "contact-collision" });
    await expect(
      pages.createPage(actor, { title: "Contact Again", slug: "contact-collision" }),
    ).rejects.toThrow(PathCollisionError);
  });

  it("refuses without cms.pages.create — no row is written", async () => {
    const before = await ctx.db.page.count();
    await expect(
      pages.createPage(noPermsActor, { title: "Denied", slug: "denied" }),
    ).rejects.toThrow(ForbiddenError);
    expect(await ctx.db.page.count()).toBe(before);
  });
});

describe("savePageTranslation — slug change, redirects, cascade", () => {
  it("a slug change writes a 301 redirect and updates the path", async () => {
    const id = await pages.createPage(actor, { title: "Old Name", slug: "slug-change-old" });
    await translations.savePageTranslation(actor, id, {
      locale: "en",
      title: "New Name",
      slug: "slug-change-new",
    });

    const translation = await ctx.db.pageTranslation.findFirstOrThrow({ where: { pageId: id } });
    expect(translation.path).toBe("/slug-change-new");

    const redirect = await ctx.db.redirect.findUniqueOrThrow({
      where: { fromPath: "/slug-change-old" },
    });
    expect(redirect.toPath).toBe("/slug-change-new");
    expect(redirect.statusCode).toBe(301);
  });

  it("a parent's slug change cascades to a child's path and writes the child's own redirect", async () => {
    const parentId = await pages.createPage(actor, { title: "Tools 2", slug: "tools-cascade" });
    const childId = await pages.createPage(actor, {
      title: "Pip Calc",
      slug: "pip-calc",
      parentId,
    });

    await translations.savePageTranslation(actor, parentId, {
      locale: "en",
      title: "Trading Tools",
      slug: "trading-tools-cascade",
    });

    const child = await ctx.db.pageTranslation.findFirstOrThrow({ where: { pageId: childId } });
    expect(child.path).toBe("/trading-tools-cascade/pip-calc");

    const childRedirect = await ctx.db.redirect.findUniqueOrThrow({
      where: { fromPath: "/tools-cascade/pip-calc" },
    });
    expect(childRedirect.toPath).toBe("/trading-tools-cascade/pip-calc");
  });

  it("deactivates a stale redirect that would shadow a newly-live path", async () => {
    const a = await pages.createPage(actor, { title: "A", slug: "shadow-a" });
    const b = await pages.createPage(actor, { title: "B", slug: "shadow-b" });

    // A moves away from "shadow-a" — a redirect shadow-a -> shadow-a-2 exists now.
    await translations.savePageTranslation(actor, a, {
      locale: "en",
      title: "A",
      slug: "shadow-a-2",
    });

    // B moves INTO the now-vacant "shadow-a" path.
    await translations.savePageTranslation(actor, b, {
      locale: "en",
      title: "B",
      slug: "shadow-a",
    });

    const stale = await ctx.db.redirect.findUniqueOrThrow({ where: { fromPath: "/shadow-a" } });
    expect(stale.isActive).toBe(false);

    const live = await ctx.db.pageTranslation.findFirstOrThrow({ where: { pageId: b } });
    expect(live.path).toBe("/shadow-a");
  });

  it("refuses an empty slug on a non-home page", async () => {
    const id = await pages.createPage(actor, { title: "X", slug: "empty-slug-test" });
    await expect(
      translations.savePageTranslation(actor, id, { locale: "en", title: "X", slug: "" }),
    ).rejects.toThrow();
  });
});

describe("updatePageMeta — reparenting", () => {
  it("recomputes the page's own path and cascades to its children", async () => {
    const oldParent = await pages.createPage(actor, { title: "Old Parent", slug: "reparent-old" });
    const newParent = await pages.createPage(actor, { title: "New Parent", slug: "reparent-new" });
    const child = await pages.createPage(actor, {
      title: "Moved Child",
      slug: "moved-child",
      parentId: oldParent,
    });
    const grandchild = await pages.createPage(actor, {
      title: "Grandchild",
      slug: "grandchild",
      parentId: child,
    });

    await pages.updatePageMeta(actor, child, { parentId: newParent });

    const childT = await ctx.db.pageTranslation.findFirstOrThrow({ where: { pageId: child } });
    expect(childT.path).toBe("/reparent-new/moved-child");
    const grandchildT = await ctx.db.pageTranslation.findFirstOrThrow({
      where: { pageId: grandchild },
    });
    expect(grandchildT.path).toBe("/reparent-new/moved-child/grandchild");
  });

  it("refuses making a page its own parent", async () => {
    const id = await pages.createPage(actor, { title: "Self", slug: "self-parent-test" });
    await expect(pages.updatePageMeta(actor, id, { parentId: id })).rejects.toThrow(
      CyclicParentError,
    );
  });

  it("refuses making a page a descendant's parent (a cycle)", async () => {
    const parent = await pages.createPage(actor, { title: "P", slug: "cycle-parent" });
    const child = await pages.createPage(actor, {
      title: "C",
      slug: "cycle-child",
      parentId: parent,
    });
    await expect(pages.updatePageMeta(actor, parent, { parentId: child })).rejects.toThrow(
      CyclicParentError,
    );
  });

  it("refuses a parent chain deeper than MAX_PAGE_DEPTH", async () => {
    let parentId: string | undefined;
    for (let i = 0; i < 7; i++) {
      const id = await pages.createPage(actor, {
        title: `Depth ${i}`,
        slug: `depth-${i}`,
        parentId,
      });
      parentId = id;
    }
    await expect(
      pages.createPage(actor, { title: "Too deep", slug: "too-deep", parentId }),
    ).rejects.toThrow(MaxDepthExceededError);
  });
});

describe("duplicatePage", () => {
  it("copies translations with a '-copy' slug and an independent draft, never the published pointer", async () => {
    const sourceId = await pages.createPage(actor, { title: "Source", slug: "duplicate-source" });
    const copyId = await pages.duplicatePage(actor, sourceId);

    const copy = await ctx.db.page.findUniqueOrThrow({
      where: { id: copyId },
      include: { translations: true },
    });
    expect(copy.publishedVersionId).toBeNull();
    expect(copy.translations[0]?.slug).toBe("duplicate-source-copy");
    expect(copy.translations[0]?.path).toBe("/duplicate-source-copy");

    // Editing the copy's translation must never touch the source's.
    const source = await ctx.db.pageTranslation.findFirstOrThrow({ where: { pageId: sourceId } });
    expect(source.slug).toBe("duplicate-source");
  });
});

describe("setPageDeleted", () => {
  it("refuses to delete a page with non-deleted children", async () => {
    const parent = await pages.createPage(actor, { title: "Guard Parent", slug: "guard-parent" });
    await pages.createPage(actor, { title: "Guard Child", slug: "guard-child", parentId: parent });
    await expect(pages.setPageDeleted(actor, parent, true)).rejects.toThrow(PageHasChildrenError);
  });

  it("soft-deletes and restores a childless page", async () => {
    const id = await pages.createPage(actor, { title: "Deletable", slug: "deletable" });
    await pages.setPageDeleted(actor, id, true);
    expect((await ctx.db.page.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();

    await pages.setPageDeleted(actor, id, false);
    expect((await ctx.db.page.findUniqueOrThrow({ where: { id } })).deletedAt).toBeNull();
  });
});

describe("listPagesAdmin", () => {
  it("the 'global' tab is empty until PageKind.PART exists (Phase 6)", async () => {
    const result = await pages.listPagesAdmin({ tab: "global" }, "en");
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it("flags a page with no published version as having unpublished changes", async () => {
    const id = await pages.createPage(actor, { title: "List Test", slug: "list-test" });
    const result = await pages.listPagesAdmin({ tab: "pages", q: "List Test" }, "en");
    const row = result.rows.find((r) => r.id === id);
    expect(row?.hasUnpublishedChanges).toBe(true);
  });
});
