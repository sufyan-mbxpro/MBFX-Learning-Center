// changes-16 PR 3 required tests (ADR-068) against a real MariaDB.
//
// What earns the container here is that almost every property is a cross-table
// fact: that one transaction wrote meta AND translation AND both lists, that a
// `SetNull` FK spares the topics when their category is deleted, that a
// `ContentReference` appeared and then disappeared with the placement it
// tracked. A mocked Prisma would be asserting about itself in every one.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContentStatus } from "@repo/db";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as ContentModule from "./content.ts";
import type * as VideosModule from "./videos.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let videos: typeof VideosModule;
let content: typeof ContentModule;

let editor: Subject;
/** Every lessons.* key EXCEPT publish — ADR-068 §3's gate, tested. */
let assistant: Subject;

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
  videos = await import("./videos.ts");
  content = await import("./content.ts");

  const staff = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "video-editor@x.com",
      name: "Editor",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  editor = {
    id: staff.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 60,
    allowed: new Set(["lessons.view", "lessons.create", "lessons.update", "lessons.publish"]),
    denied: new Set(),
  };
  assistant = {
    ...editor,
    allowed: new Set(["lessons.view", "lessons.create", "lessons.update"]),
  };

  await db.locale.create({
    data: {
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "LTR",
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  });
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
  await container.stop();
});

// ─── Fixtures ────────────────────────────────────────────────

let seq = 0;

const EXTERNAL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

async function makeAsset(kind: "IMAGE" | "VIDEO" = "IMAGE"): Promise<string> {
  seq += 1;
  const row = await db.mediaAsset.create({
    data: {
      kind,
      key: `asset-${seq}`,
      fileName: `asset-${seq}.${kind === "IMAGE" ? "png" : "mp4"}`,
      mimeType: kind === "IMAGE" ? "image/png" : "video/mp4",
      url: `/uploads/asset-${seq}.${kind === "IMAGE" ? "png" : "mp4"}`,
      size: 1024,
      purpose: "content",
      uploadedBy: editor.id,
    },
    select: { id: true },
  });
  return row.id;
}

interface TopicSpec {
  track?: "forex" | "crypto";
  categoryId?: string | null;
  publish?: boolean;
  coverAssetId?: string | null;
}

async function makeCategory(name?: string): Promise<string> {
  seq += 1;
  return videos.saveVideoCategory(editor, {
    translation: { locale: "en", name: name ?? `Category ${seq}` },
  });
}

async function publish(topicId: string): Promise<void> {
  for (const to of [
    ContentStatus.IN_REVIEW,
    ContentStatus.SEO_REVIEW,
    ContentStatus.APPROVED,
    ContentStatus.PUBLISHED,
  ]) {
    await content.transitionContentStatus(editor, "videos", topicId, to);
  }
}

async function makeTopic(
  spec: TopicSpec & {
    videoRows?: {
      assetId?: string | null;
      externalUrl?: string | null;
      posterAssetId?: string | null;
      sortOrder: number;
    }[];
    links?: { label: string; path?: string; url?: string }[];
  } = {},
): Promise<string> {
  seq += 1;
  const topicId = await videos.createVideoTopic(editor, {
    title: `Topic ${seq}`,
    track: spec.track ?? "forex",
    categoryId: spec.categoryId ?? undefined,
  });

  await videos.saveVideoTopic(editor, {
    topicId,
    meta: {
      track: spec.track ?? "forex",
      ...(spec.categoryId === undefined ? {} : { categoryId: spec.categoryId }),
      ...(spec.coverAssetId === undefined ? {} : { coverAssetId: spec.coverAssetId }),
    },
    translation: { locale: "en", title: `Topic ${seq}`, content: "<p>Body</p>" },
    videos: spec.videoRows ?? [{ externalUrl: EXTERNAL, sortOrder: 0 }],
    links: spec.links ?? [],
  });

  // The SEVEN-state machine, walked in full (CONTENT_TRANSITIONS): DRAFT →
  // PUBLISHED is deliberately absent, so a fixture that publishes has to pass
  // review exactly as an editor does. Same walk `makeQuiz` performs.
  if (spec.publish !== false) {
    await publish(topicId);
  }
  return topicId;
}

// ─── Save is one transaction ─────────────────────────────────

describe("saveVideoTopic", () => {
  it("writes meta, translation, videos and links atomically", async () => {
    const categoryId = await makeCategory();
    const topicId = await makeTopic({
      categoryId,
      videoRows: [
        { externalUrl: EXTERNAL, sortOrder: 0 },
        { externalUrl: EXTERNAL, sortOrder: 1 },
      ],
      links: [
        { label: "Glossary", path: "/glossary/pip" },
        { label: "Docs", url: "https://example.com/docs" },
      ],
    });

    const detail = await videos.getVideoTopicAdmin(topicId);
    expect(detail).not.toBeNull();
    expect(detail!.categoryId).toBe(categoryId);
    expect(detail!.videos).toHaveLength(2);
    expect(detail!.links).toHaveLength(2);
    // The prefill regression ADR-069 paid for: the loader returns the STORED
    // body, not an empty string a form would then save over the real one.
    expect(detail!.translations[0]!.content).toContain("Body");
  });

  it("leaves nothing behind when the save fails mid-way", async () => {
    const topicId = await makeTopic({ links: [{ label: "Before", path: "/before" }] });

    await expect(
      videos.saveVideoTopic(editor, {
        topicId,
        meta: { categoryId: "does-not-exist" },
        translation: { locale: "en", title: "Rewritten", content: "<p>New</p>" },
        videos: [{ externalUrl: EXTERNAL, sortOrder: 0 }],
        links: [{ label: "After", path: "/after" }],
      }),
    ).rejects.toThrow();

    const detail = await videos.getVideoTopicAdmin(topicId);
    // The failing connect is inside the transaction, so the title, the link
    // replacement and the video replacement all roll back with it.
    expect(detail!.translations[0]!.title).not.toBe("Rewritten");
    expect(detail!.links.map((l) => l.label)).toEqual(["Before"]);
  });

  it("replaces both lists wholesale rather than merging", async () => {
    const topicId = await makeTopic({
      videoRows: [
        { externalUrl: EXTERNAL, sortOrder: 0 },
        { externalUrl: EXTERNAL, sortOrder: 1 },
      ],
      links: [
        { label: "One", path: "/one" },
        { label: "Two", path: "/two" },
      ],
    });

    await videos.saveVideoTopic(editor, {
      topicId,
      meta: {},
      translation: { locale: "en", title: "Trimmed", content: "<p>Body</p>" },
      videos: [{ externalUrl: EXTERNAL, sortOrder: 0 }],
      links: [{ label: "Only", path: "/only" }],
    });

    const detail = await videos.getVideoTopicAdmin(topicId);
    expect(detail!.videos).toHaveLength(1);
    expect(detail!.links.map((l) => l.label)).toEqual(["Only"]);
  });

  it("sanitizes the body server-side regardless of what the editor sent", async () => {
    const topicId = await makeTopic();
    await videos.saveVideoTopic(editor, {
      topicId,
      meta: {},
      translation: {
        locale: "en",
        title: "Scripted",
        content: '<p>ok</p><script>alert("x")</script><img src=x onerror="alert(1)">',
      },
      videos: [{ externalUrl: EXTERNAL, sortOrder: 0 }],
      links: [],
    });

    const detail = await videos.getVideoTopicAdmin(topicId);
    expect(detail!.translations[0]!.content).not.toContain("<script");
    expect(detail!.translations[0]!.content).not.toContain("onerror");
    expect(detail!.translations[0]!.content).toContain("ok");
  });
});

// ─── Redirects: slug AND track ───────────────────────────────

describe("redirects", () => {
  it("writes one when the slug changes", async () => {
    const topicId = await makeTopic();
    const before = (await videos.getVideoTopicAdmin(topicId))!.translations[0]!.slug;

    await videos.saveVideoTopic(editor, {
      topicId,
      meta: {},
      translation: { locale: "en", title: "Renamed", slug: "renamed-topic", content: "<p>b</p>" },
      videos: [{ externalUrl: EXTERNAL, sortOrder: 0 }],
      links: [],
    });

    const redirect = await db.redirect.findUnique({
      where: { fromPath: `/learn/forex/videos/${before}` },
    });
    expect(redirect?.toPath).toBe("/learn/forex/videos/renamed-topic");
  });

  it("writes one when the TRACK changes, because the track is part of the address", async () => {
    const topicId = await makeTopic({ track: "forex" });
    const slug = (await videos.getVideoTopicAdmin(topicId))!.translations[0]!.slug;

    await videos.saveVideoTopic(editor, {
      topicId,
      meta: { track: "crypto" },
      translation: { locale: "en", title: `Topic ${seq}`, slug, content: "<p>b</p>" },
      videos: [{ externalUrl: EXTERNAL, sortOrder: 0 }],
      links: [],
    });

    const redirect = await db.redirect.findUnique({
      where: { fromPath: `/learn/forex/videos/${slug}` },
    });
    expect(redirect?.toPath).toBe(`/learn/crypto/videos/${slug}`);
  });
});

// ─── Public reads ────────────────────────────────────────────

describe("public reads", () => {
  it("returns null for a topic loaded under the wrong track", async () => {
    const topicId = await makeTopic({ track: "forex" });
    const slug = (await videos.getVideoTopicAdmin(topicId))!.translations[0]!.slug;

    expect(await videos.loadVideoTopicBySlug("en", "forex", slug)).not.toBeNull();
    expect(await videos.loadVideoTopicBySlug("en", "crypto", slug)).toBeNull();
  });

  it("omits drafts and soft-deleted rows from every public read", async () => {
    const draftId = await makeTopic({ track: "crypto", publish: false });
    const draftSlug = (await videos.getVideoTopicAdmin(draftId))!.translations[0]!.slug;
    expect(await videos.loadVideoTopicBySlug("en", "crypto", draftSlug)).toBeNull();

    const liveId = await makeTopic({ track: "crypto" });
    const liveSlug = (await videos.getVideoTopicAdmin(liveId))!.translations[0]!.slug;
    expect(await videos.loadVideoTopicBySlug("en", "crypto", liveSlug)).not.toBeNull();

    await videos.setVideoTopicDeleted(editor, liveId, true);
    expect(await videos.loadVideoTopicBySlug("en", "crypto", liveSlug)).toBeNull();

    const cards = await videos.loadVideoTopics("en", "crypto");
    expect(cards.map((c) => c.slug)).not.toContain(draftSlug);
    expect(cards.map((c) => c.slug)).not.toContain(liveSlug);
  });

  it("drops a video row whose URL no provider recognises, rather than passing it through", async () => {
    const topicId = await makeTopic({
      videoRows: [
        { externalUrl: EXTERNAL, sortOrder: 0 },
        { externalUrl: "https://evil.example/clip.mp4", sortOrder: 1 },
      ],
    });
    const slug = (await videos.getVideoTopicAdmin(topicId))!.translations[0]!.slug;

    const view = await videos.loadVideoTopicBySlug("en", "forex", slug);
    expect(view!.videos).toHaveLength(1);
    expect(view!.videos[0]!.kind).toBe("embed");
    // The stored string never becomes a src — only a derived embed URL does.
    expect(JSON.stringify(view!.videos)).not.toContain("evil.example");
  });

  it("derives isExternal from which link branch was stored", async () => {
    const topicId = await makeTopic({
      links: [
        { label: "Internal", path: "/glossary/pip" },
        { label: "External", url: "https://example.com" },
      ],
    });
    const slug = (await videos.getVideoTopicAdmin(topicId))!.translations[0]!.slug;

    const view = await videos.loadVideoTopicBySlug("en", "forex", slug);
    expect(view!.links).toEqual([
      { label: "Internal", href: "/glossary/pip", isExternal: false },
      { label: "External", href: "https://example.com", isExternal: true },
    ]);
  });

  it("counts a category per track, not globally", async () => {
    const categoryId = await makeCategory("Shared");
    await makeTopic({ track: "forex", categoryId });
    await makeTopic({ track: "forex", categoryId });
    await makeTopic({ track: "crypto", categoryId });

    const forex = await videos.loadVideoCategories("en", "forex");
    const crypto = await videos.loadVideoCategories("en", "crypto");
    expect(forex.find((c) => c.id === categoryId)?.topicCount).toBe(2);
    expect(crypto.find((c) => c.id === categoryId)?.topicCount).toBe(1);
  });

  it("drops rows in an unregistered track from the sitemap", async () => {
    const topicId = await makeTopic({ track: "forex" });
    const slug = (await videos.getVideoTopicAdmin(topicId))!.translations[0]!.slug;
    await db.videoTopic.update({ where: { id: topicId }, data: { track: "not-a-track" } });

    const entries = await videos.loadVideoSitemapEntries();
    expect(entries.map((e) => e.path)).not.toContain("/learn/not-a-track/videos/" + slug);
    expect(entries.some((e) => e.path.includes("not-a-track"))).toBe(false);
  });
});

// ─── Publishing gate (ADR-068 §3) ────────────────────────────

describe("publishing", () => {
  /** Review-complete and legally publishable — so only the permission can stop it. */
  async function approved(): Promise<string> {
    const topicId = await makeTopic({ publish: false });
    for (const to of [ContentStatus.IN_REVIEW, ContentStatus.SEO_REVIEW, ContentStatus.APPROVED]) {
      await content.transitionContentStatus(editor, "videos", topicId, to);
    }
    return topicId;
  }

  it("throws PublishPermissionError without lessons.publish", async () => {
    const topicId = await approved();
    await expect(
      content.transitionContentStatus(assistant, "videos", topicId, ContentStatus.PUBLISHED),
    ).rejects.toThrow(content.PublishPermissionError);
    // And the row did not move — the gate is not advisory.
    const detail = await videos.getVideoTopicAdmin(topicId);
    expect(detail!.status).toBe(ContentStatus.APPROVED);
  });

  it("names the LESSON key, not a videos.* key that no role can hold", async () => {
    const topicId = await approved();
    await expect(
      content.transitionContentStatus(assistant, "videos", topicId, ContentStatus.PUBLISHED),
    ).rejects.toThrow(/lessons\.publish/);
  });

  it("refuses DRAFT to PUBLISHED even for an editor who may publish", async () => {
    const topicId = await makeTopic({ publish: false });
    await expect(
      content.transitionContentStatus(editor, "videos", topicId, ContentStatus.PUBLISHED),
    ).rejects.toThrow(content.IllegalTransitionError);
  });
});

// ─── Media references (ADR-068 §7) ───────────────────────────

describe("content references", () => {
  it("appear and disappear with the placements they track", async () => {
    const cover = await makeAsset("IMAGE");
    const upload = await makeAsset("VIDEO");
    const poster = await makeAsset("IMAGE");

    const topicId = await makeTopic({
      coverAssetId: cover,
      videoRows: [{ assetId: upload, posterAssetId: poster, sortOrder: 0 }],
    });

    const refs = await db.contentReference.findMany({
      where: { sourceType: "VIDEO_TOPIC", sourceId: topicId },
      select: { refId: true },
    });
    expect(refs.map((r) => r.refId).sort()).toEqual([cover, poster, upload].sort());

    // Clearing the cover and swapping to an external video must clear both.
    await videos.saveVideoTopic(editor, {
      topicId,
      meta: { coverAssetId: null },
      translation: { locale: "en", title: "Cleared", content: "<p>b</p>" },
      videos: [{ externalUrl: EXTERNAL, sortOrder: 0 }],
      links: [],
    });

    const after = await db.contentReference.findMany({
      where: { sourceType: "VIDEO_TOPIC", sourceId: topicId },
    });
    expect(after).toHaveLength(0);
  });
});

// ─── Categories ──────────────────────────────────────────────

describe("categories", () => {
  it("deleting one nulls categoryId and deletes no topic", async () => {
    const categoryId = await makeCategory("Doomed");
    const topicId = await makeTopic({ categoryId });

    await videos.deleteVideoCategory(editor, categoryId);

    const detail = await videos.getVideoTopicAdmin(topicId);
    expect(detail).not.toBeNull();
    expect(detail!.categoryId).toBeNull();
  });

  it("reorders by the whole submitted order", async () => {
    const a = await makeCategory("A");
    const b = await makeCategory("B");
    await videos.reorderVideoCategories(editor, { ids: [b, a] });

    const rows = await db.videoCategory.findMany({
      where: { id: { in: [a, b] } },
      select: { id: true, sortOrder: true },
    });
    expect(rows.find((r) => r.id === b)!.sortOrder).toBeLessThan(
      rows.find((r) => r.id === a)!.sortOrder,
    );
  });

  it("an inactive category is absent from the public list", async () => {
    const categoryId = await makeCategory("Hidden");
    await makeTopic({ track: "forex", categoryId });

    expect((await videos.loadVideoCategories("en", "forex")).map((c) => c.id)).toContain(
      categoryId,
    );
    await videos.setVideoCategoryActive(editor, categoryId, false);
    expect((await videos.loadVideoCategories("en", "forex")).map((c) => c.id)).not.toContain(
      categoryId,
    );
  });
});
