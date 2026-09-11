import { describe, expect, it } from "vitest";

import {
  createVideoTopicSchema,
  internalPathSchema,
  videoCategoryInputSchema,
  videoTopicInputSchema,
  videoTopicLinkSchema,
  videoTopicMetaSchema,
  videoTopicVideoSchema,
} from "./videos.ts";

// ─── Internal paths (ADR-068 §5) ─────────────────────────────
//
// The one test in this file that is about an attack rather than a shape. An
// "internal link" field that accepts `//evil.example` sends readers off-site
// from a control labelled internal, and every naive startsWith("/") check
// passes it.

describe("internalPathSchema", () => {
  it("accepts real site-relative paths", () => {
    for (const path of [
      "/",
      "/learn/forex",
      "/learn/forex/price-action/what-is-a-pip",
      "/glossary/leverage",
      "/news?page=2",
      "/learn/forex#curriculum",
      "/about/why-us",
    ]) {
      expect(internalPathSchema.safeParse(path).success, path).toBe(true);
    }
  });

  it("rejects a protocol-relative URL that looks internal", () => {
    expect(internalPathSchema.safeParse("//evil.example").success).toBe(false);
    expect(internalPathSchema.safeParse("//evil.example/learn").success).toBe(false);
  });

  it("rejects absolute URLs and dangerous schemes", () => {
    for (const value of [
      "https://evil.example",
      "http://evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "mailto:someone@example.com",
    ]) {
      expect(internalPathSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("rejects a path with no leading slash, and the empty string", () => {
    expect(internalPathSchema.safeParse("learn/forex").success).toBe(false);
    expect(internalPathSchema.safeParse("").success).toBe(false);
    expect(internalPathSchema.safeParse("   ").success).toBe(false);
  });
});

// ─── Links carry exactly one href ────────────────────────────

describe("videoTopicLinkSchema", () => {
  it("accepts an internal link", () => {
    const result = videoTopicLinkSchema.safeParse({
      label: "The full course",
      path: "/learn/forex/price-action",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an external link", () => {
    const result = videoTopicLinkSchema.safeParse({
      label: "Broker docs",
      url: "https://example.com/docs",
    });
    expect(result.success).toBe(true);
  });

  it("rejects both together", () => {
    const result = videoTopicLinkSchema.safeParse({
      label: "Both",
      path: "/learn/forex",
      url: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects neither", () => {
    expect(videoTopicLinkSchema.safeParse({ label: "Nowhere" }).success).toBe(false);
    expect(videoTopicLinkSchema.safeParse({ label: "Nulls", path: null, url: null }).success).toBe(
      false,
    );
  });

  it("requires a label", () => {
    expect(videoTopicLinkSchema.safeParse({ label: "", path: "/learn" }).success).toBe(false);
    expect(videoTopicLinkSchema.safeParse({ label: "   ", path: "/learn" }).success).toBe(false);
  });

  it("refuses a non-https external URL", () => {
    expect(
      videoTopicLinkSchema.safeParse({ label: "Insecure", url: "http://example.com" }).success,
    ).toBe(false);
  });
});

// ─── Videos carry exactly one source (ADR-068 §4) ────────────

describe("videoTopicVideoSchema", () => {
  const base = { sortOrder: 0 };

  it("accepts an uploaded asset", () => {
    expect(videoTopicVideoSchema.safeParse({ ...base, assetId: "asset_1" }).success).toBe(true);
  });

  it("accepts an external URL", () => {
    expect(
      videoTopicVideoSchema.safeParse({
        ...base,
        externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }).success,
    ).toBe(true);
  });

  it("rejects both sources at once", () => {
    expect(
      videoTopicVideoSchema.safeParse({
        ...base,
        assetId: "asset_1",
        externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }).success,
    ).toBe(false);
  });

  it("rejects neither source", () => {
    expect(videoTopicVideoSchema.safeParse(base).success).toBe(false);
    expect(
      videoTopicVideoSchema.safeParse({ ...base, assetId: null, externalUrl: null }).success,
    ).toBe(false);
  });

  it("allows a poster beside an upload, and does not refuse one beside a URL", () => {
    // Not rejected on purpose: an editor who pastes a URL over an upload
    // should not have a save refused for a field they can no longer see.
    expect(
      videoTopicVideoSchema.safeParse({ ...base, assetId: "a1", posterAssetId: "p1" }).success,
    ).toBe(true);
    expect(
      videoTopicVideoSchema.safeParse({
        ...base,
        externalUrl: "https://vimeo.com/123456",
        posterAssetId: "p1",
      }).success,
    ).toBe(true);
  });
});

// ─── Topic meta ──────────────────────────────────────────────

describe("videoTopicMetaSchema", () => {
  it("requires a registered track", () => {
    expect(videoTopicMetaSchema.safeParse({ track: "forex" }).success).toBe(true);
    expect(videoTopicMetaSchema.safeParse({ track: "crypto" }).success).toBe(true);
    expect(videoTopicMetaSchema.safeParse({ track: "stocks" }).success).toBe(false);
    expect(videoTopicMetaSchema.safeParse({}).success).toBe(false);
    // Nullable is exactly what a quiz's track is not, and for the same reason
    // (ADR-068 §1): a URL cannot be built from a null.
    expect(videoTopicMetaSchema.safeParse({ track: null }).success).toBe(false);
  });

  it("lets a topic sit outside any category", () => {
    expect(videoTopicMetaSchema.safeParse({ track: "forex", categoryId: null }).success).toBe(true);
  });
});

describe("createVideoTopicSchema", () => {
  it("asks for a title and a track", () => {
    expect(createVideoTopicSchema.safeParse({ title: "MT5 alerts", track: "forex" }).success).toBe(
      true,
    );
    expect(createVideoTopicSchema.safeParse({ title: "MT5 alerts" }).success).toBe(false);
    expect(createVideoTopicSchema.safeParse({ title: "", track: "forex" }).success).toBe(false);
  });
});

// ─── The capability rule ─────────────────────────────────────

describe("videoTopicInputSchema", () => {
  const translation = { locale: "en", title: "How to set up alerts in MT5" };
  const shell = { topicId: "t1", meta: { track: "forex" as const }, links: [] };

  it("accepts a topic with a video and no body", () => {
    const result = videoTopicInputSchema.safeParse({
      ...shell,
      translation,
      videos: [{ assetId: "a1", sortOrder: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a topic with a body and no video", () => {
    const result = videoTopicInputSchema.safeParse({
      ...shell,
      translation: { ...translation, content: "<p>A written guide.</p>" },
      videos: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a topic with neither", () => {
    const result = videoTopicInputSchema.safeParse({ ...shell, translation, videos: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["videos"]);
  });

  it("treats a whitespace-only body as no body", () => {
    const result = videoTopicInputSchema.safeParse({
      ...shell,
      translation: { ...translation, content: "   \n  " },
      videos: [],
    });
    expect(result.success).toBe(false);
  });

  it("requires the lists rather than defaulting them", () => {
    // The reason lessonInputSchema.attachments is required: an optional list
    // cannot tell "sent nothing" from "cleared everything", so the capability
    // rule would depend on what the caller meant.
    expect(videoTopicInputSchema.safeParse({ ...shell, translation }).success).toBe(false);
  });

  it("rejects a bad video row inside an otherwise valid payload", () => {
    const result = videoTopicInputSchema.safeParse({
      ...shell,
      translation,
      videos: [{ sortOrder: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("caps the lists", () => {
    const videos = Array.from({ length: 51 }, (_, i) => ({ assetId: `a${i}`, sortOrder: i }));
    expect(videoTopicInputSchema.safeParse({ ...shell, translation, videos }).success).toBe(false);

    const links = Array.from({ length: 21 }, (_, i) => ({ label: `L${i}`, path: "/learn" }));
    expect(
      videoTopicInputSchema.safeParse({
        ...shell,
        translation,
        links,
        videos: [{ assetId: "a1", sortOrder: 0 }],
      }).success,
    ).toBe(false);
  });
});

// ─── Categories ──────────────────────────────────────────────

describe("videoCategoryInputSchema", () => {
  it("creates without an id and updates with one", () => {
    expect(
      videoCategoryInputSchema.safeParse({ translation: { locale: "en", name: "MetaTrader" } })
        .success,
    ).toBe(true);
    expect(
      videoCategoryInputSchema.safeParse({
        categoryId: "c1",
        isActive: false,
        translation: { locale: "en", name: "MetaTrader", slug: "metatrader" },
      }).success,
    ).toBe(true);
  });

  it("requires a name", () => {
    expect(
      videoCategoryInputSchema.safeParse({ translation: { locale: "en", name: "" } }).success,
    ).toBe(false);
  });
});
