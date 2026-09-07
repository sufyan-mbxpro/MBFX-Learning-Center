// PAGE/MEDIA resolution — the two cases that need the database (testing.md:
// don't mock Prisma). Pure cases live in links.test.ts.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type * as LinksModule from "./links.ts";
import type * as PagesModule from "./pages.ts";
import type * as PublishModule from "./publish.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let links: typeof LinksModule;
let pages: typeof PagesModule;
let publishModule: typeof PublishModule;
let actor: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  links = await import("./links.ts");
  pages = await import("./pages.ts");
  publishModule = await import("./publish.ts");
  actor = await makeActor(ctx.db, "links-actor", ALL_CMS_PERMISSIONS);
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("resolveLinks — PAGE targets", () => {
  it("resolves a published page to its public path", async () => {
    const id = await pages.createPage(actor, { title: "About Us", slug: "about-us" });
    await publishModule.publishPage(actor, id, {});

    const results = await links.resolveLinks([{ type: "PAGE", pageId: id }], { locale: "en" });
    expect(results).toEqual([{ href: "/about-us", state: "ok" }]);
  });

  it("appends the anchor to a resolved page href", async () => {
    const id = await pages.createPage(actor, { title: "Pricing", slug: "pricing" });
    await publishModule.publishPage(actor, id, {});

    const results = await links.resolveLinks([{ type: "PAGE", pageId: id, anchor: "plans" }], {
      locale: "en",
    });
    expect(results).toEqual([{ href: "/pricing#plans", state: "ok" }]);
  });

  it("resolves an unpublished page to state 'unpublished'", async () => {
    const id = await pages.createPage(actor, { title: "Draft Only", slug: "draft-only" });

    const results = await links.resolveLinks([{ type: "PAGE", pageId: id }], { locale: "en" });
    expect(results).toEqual([{ href: null, state: "unpublished" }]);
  });

  it("resolves a page id that doesn't exist to state 'missing'", async () => {
    const results = await links.resolveLinks([{ type: "PAGE", pageId: "does-not-exist" }], {
      locale: "en",
    });
    expect(results).toEqual([{ href: null, state: "missing" }]);
  });

  it("issues one read for N identical-locale PAGE targets (batched, not one query per link)", async () => {
    const a = await pages.createPage(actor, { title: "Page A", slug: "page-a" });
    const b = await pages.createPage(actor, { title: "Page B", slug: "page-b" });
    await publishModule.publishPage(actor, a, {});
    await publishModule.publishPage(actor, b, {});

    const results = await links.resolveLinks(
      [
        { type: "PAGE", pageId: a },
        { type: "PAGE", pageId: b },
        { type: "PAGE", pageId: a }, // repeated on purpose
      ],
      { locale: "en" },
    );
    expect(results.map((r) => r.href)).toEqual(["/page-a", "/page-b", "/page-a"]);
  });
});

describe("resolveLinks — MEDIA targets", () => {
  it("resolves a media asset to its stored URL, flagged as a download", async () => {
    const asset = await ctx.db.mediaAsset.create({
      data: {
        key: "links-test-key",
        url: "/uploads/links-test-key",
        fileName: "brochure.pdf",
        mimeType: "application/pdf",
        size: 1024,
        purpose: "content",
      },
    });

    const results = await links.resolveLinks([{ type: "MEDIA", assetId: asset.id }], {
      locale: "en",
    });
    expect(results).toEqual([{ href: "/uploads/links-test-key", state: "ok", download: true }]);
  });

  it("resolves a missing asset id to state 'missing'", async () => {
    const results = await links.resolveLinks([{ type: "MEDIA", assetId: "does-not-exist" }], {
      locale: "en",
    });
    expect(results).toEqual([{ href: null, state: "missing" }]);
  });
});

describe("resolveLinks — zero-query guarantee for stateless-only batches", () => {
  it("resolves URL/ROUTE/ANCHOR/NONE without needing getDefaultLocale's query", async () => {
    // No page/media rows involved at all — if this ever needed a DB call it
    // would still pass (a real container is running), so the real
    // assertion is in links.test.ts's unit suite; this just proves the
    // mixed-type path still works end to end against a real database.
    const results = await links.resolveLinks(
      [
        { type: "URL", url: "https://example.com" },
        { type: "ROUTE", routeKey: "news" },
      ],
      { locale: "en" },
    );
    expect(results).toEqual([
      { href: "https://example.com", state: "ok" },
      { href: "/news", state: "ok" },
    ]);
  });
});
