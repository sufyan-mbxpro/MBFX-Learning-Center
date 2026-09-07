// The ADR-032 §6 optimistic lock: the draft PageVersion is mutable in
// place, `revision` is the compare-and-swap key.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMPTY_LAYOUT } from "@repo/contracts";
import type * as PagesModule from "./pages.ts";
import type * as PublishModule from "./publish.ts";
import type * as VersionsModule from "./versions.ts";
import { DraftConflictError, NothingPublishedError } from "./errors.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let pages: typeof PagesModule;
let publish: typeof PublishModule;
let versions: typeof VersionsModule;
let actor: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  pages = await import("./pages.ts");
  publish = await import("./publish.ts");
  versions = await import("./versions.ts");
  actor = await makeActor(ctx.db, "versions-actor", ALL_CMS_PERMISSIONS);
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("saveDraft", () => {
  it("accepts a save at the current revision and increments it", async () => {
    const id = await pages.createPage(actor, { title: "Draft Test", slug: "draft-test" });
    const result = await versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 0 });
    expect(result.revision).toBe(1);
  });

  it("refuses a second save against the same stale baseRevision", async () => {
    const id = await pages.createPage(actor, { title: "Conflict Test", slug: "conflict-test" });
    await versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 0 });

    await expect(
      versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 0 }),
    ).rejects.toThrow(DraftConflictError);
  });

  it("a fresh read of the current revision lets the next save through", async () => {
    const id = await pages.createPage(actor, { title: "Sequential Test", slug: "sequential-test" });
    const first = await versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 0 });
    const second = await versions.saveDraft(actor, id, {
      layout: EMPTY_LAYOUT,
      baseRevision: first.revision,
    });
    expect(second.revision).toBe(2);
  });
});

describe("listVersions", () => {
  it("excludes the mutable draft row (number 0)", async () => {
    const id = await pages.createPage(actor, { title: "List Versions", slug: "list-versions" });
    const list = await versions.listVersions(id);
    expect(list).toEqual([]);
  });

  it("resolves the author's display name alongside the raw id", async () => {
    const id = await pages.createPage(actor, { title: "Author Name", slug: "author-name" });
    await publish.publishPage(actor, id, {});
    const [row] = await versions.listVersions(id);
    expect(row?.authorId).toBe(actor.id);
    expect(row?.authorName).toBe("versions-actor");
  });
});

describe("restoreVersionAsDraft (PR 3.5)", () => {
  it("copies an earlier published version's layout into the mutable draft, without touching what's published", async () => {
    const id = await pages.createPage(actor, { title: "Restore Test", slug: "restore-test" });
    const v1Layout = {
      version: 1 as const,
      nodes: [
        { type: "spacer", version: 1, id: "a", props: { size: "sm" }, hidden: false, children: [] },
      ],
    };
    await versions.saveDraft(actor, id, { layout: v1Layout, baseRevision: 0 });
    await publish.publishPage(actor, id, {}); // version 1

    // Draft drifts away from what was published.
    await versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 1 });
    const beforeRestore = await versions.loadDraftForEditing(id);
    expect(beforeRestore?.layout.nodes).toHaveLength(0);
    const publishedBefore = await ctx.db.page.findUniqueOrThrow({ where: { id } });

    await versions.restoreVersionAsDraft(actor, id, 1);

    const afterRestore = await versions.loadDraftForEditing(id);
    expect(afterRestore?.layout.nodes).toHaveLength(1);
    expect(afterRestore?.layout.nodes[0]?.id).toBe("a");
    const publishedAfter = await ctx.db.page.findUniqueOrThrow({ where: { id } });
    expect(publishedAfter.publishedVersionId).toBe(publishedBefore.publishedVersionId); // unchanged
  });

  it("skips the optimistic lock entirely — succeeds regardless of the draft's current revision", async () => {
    const id = await pages.createPage(actor, { title: "No Lock Test", slug: "no-lock-test" });
    await versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 0 });
    await publish.publishPage(actor, id, {}); // version 1
    // Draft is now several revisions ahead — restore must not care.
    await versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 1 });
    await versions.saveDraft(actor, id, { layout: EMPTY_LAYOUT, baseRevision: 2 });
    await expect(versions.restoreVersionAsDraft(actor, id, 1)).resolves.toBeUndefined();
  });
});

describe("discardDraft (PR 3.5)", () => {
  it("resets the draft to exactly what is currently published", async () => {
    const id = await pages.createPage(actor, { title: "Discard Test", slug: "discard-test" });
    await publish.publishPage(actor, id, {}); // version 1: EMPTY_LAYOUT (publish snapshots the draft as-is, revision untouched)
    await versions.saveDraft(actor, id, {
      layout: {
        version: 1,
        nodes: [
          {
            type: "spacer",
            version: 1,
            id: "b",
            props: { size: "lg" },
            hidden: false,
            children: [],
          },
        ],
      },
      baseRevision: 0,
    });

    await versions.discardDraft(actor, id);

    const draft = await versions.loadDraftForEditing(id);
    expect(draft?.layout.nodes).toHaveLength(0);
  });

  it("refuses on a page that has never been published", async () => {
    const id = await pages.createPage(actor, { title: "Never Published", slug: "never-published" });
    await expect(versions.discardDraft(actor, id)).rejects.toThrow(NothingPublishedError);
  });
});
