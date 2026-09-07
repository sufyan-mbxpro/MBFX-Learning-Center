import { describe, expect, it } from "vitest";
import { parseVideoEmbedUrl, parseVideoUrl } from "./video-embeds.ts";

const YT_ID = "dQw4w9WgXcQ";

describe("parseVideoUrl — YouTube", () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT_ID}`,
    `https://youtube.com/watch?v=${YT_ID}`,
    `https://m.youtube.com/watch?v=${YT_ID}&t=42s`,
    `https://www.youtube.com/shorts/${YT_ID}`,
    `https://www.youtube.com/live/${YT_ID}`,
    `https://www.youtube.com/embed/${YT_ID}`,
    `https://youtu.be/${YT_ID}`,
    `https://youtu.be/${YT_ID}?si=share-junk`,
  ])("parses %s", (url) => {
    const parsed = parseVideoUrl(url);
    expect(parsed).toMatchObject({
      provider: "youtube",
      videoId: YT_ID,
      embedUrl: `https://www.youtube-nocookie.com/embed/${YT_ID}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${YT_ID}/hqdefault.jpg`,
    });
  });

  it("keeps the pasted URL verbatim as originalUrl", () => {
    const url = `  https://youtu.be/${YT_ID}  `;
    expect(parseVideoUrl(url)?.originalUrl).toBe(url.trim());
  });

  it("rejects a malformed video id", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseVideoUrl("https://youtu.be/definitely-not-eleven-chars")).toBeNull();
  });

  it("rejects non-video YouTube paths", () => {
    expect(parseVideoUrl("https://www.youtube.com/@somechannel")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/playlist?list=PL123")).toBeNull();
  });
});

describe("parseVideoUrl — Vimeo", () => {
  it.each([
    "https://vimeo.com/76979871",
    "https://www.vimeo.com/76979871",
    "https://player.vimeo.com/video/76979871",
  ])("parses %s", (url) => {
    expect(parseVideoUrl(url)).toMatchObject({
      provider: "vimeo",
      videoId: "76979871",
      embedUrl: "https://player.vimeo.com/video/76979871",
      thumbnailUrl: null,
    });
  });

  it("rejects non-numeric vimeo paths", () => {
    expect(parseVideoUrl("https://vimeo.com/about")).toBeNull();
  });
});

describe("parseVideoUrl — Dailymotion", () => {
  it.each([
    "https://www.dailymotion.com/video/x7tgad0",
    "https://dailymotion.com/video/x7tgad0",
    "https://dai.ly/x7tgad0",
  ])("parses %s", (url) => {
    expect(parseVideoUrl(url)).toMatchObject({
      provider: "dailymotion",
      videoId: "x7tgad0",
      embedUrl: "https://www.dailymotion.com/embed/video/x7tgad0",
      thumbnailUrl: null,
    });
  });
});

describe("parseVideoUrl — whitelist rejections", () => {
  it.each([
    "https://evil.example.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.tiktok.com/@user/video/123",
    "not a url at all",
    "",
    // No raw-iframe passthrough — markup is not a URL.
    `<iframe src="https://www.youtube.com/embed/${YT_ID}"></iframe>`,
    // Scheme abuse.
    "javascript:alert(1)",
    `ftp://youtube.com/watch?v=${YT_ID}`,
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

// ── changes-10 / ADR-046 ──
// `parseVideoEmbedUrl` is the gate `sanitizeRichText` puts in front of every
// stored <iframe>, so its rejections matter more than its acceptances.
describe("parseVideoEmbedUrl", () => {
  it.each([
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://player.vimeo.com/video/123456", "vimeo", "123456"],
    ["https://www.dailymotion.com/embed/video/x7tgad0", "dailymotion", "x7tgad0"],
  ])("recognises %s", (url, provider, videoId) => {
    const parsed = parseVideoEmbedUrl(url);
    expect(parsed?.provider).toBe(provider);
    expect(parsed?.videoId).toBe(videoId);
    // Round-trip: what it hands back is what the sanitizer will store, and
    // that must be OUR derived URL, not the caller's string.
    expect(parsed?.embedUrl).toBe(url);
  });

  it.each([
    [
      "a watch URL rather than an embed URL",
      "https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ",
    ],
    ["the cookie-ful YouTube host", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    [
      "a suffixed look-alike host",
      "https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ",
    ],
    ["a prefixed look-alike host", "https://evilwww.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["http rather than https", "http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["a traversal in the id", "https://www.youtube-nocookie.com/embed/../../admin"],
    ["a short id", "https://www.youtube-nocookie.com/embed/abc"],
    ["a non-numeric Vimeo id", "https://player.vimeo.com/video/notanid"],
    ["a nested path", "https://player.vimeo.com/video/123456/extra"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>1</script>"],
    ["empty input", ""],
    ["raw iframe markup", '<iframe src="https://player.vimeo.com/video/123456"></iframe>'],
  ])("rejects %s", (_case, input) => {
    expect(parseVideoEmbedUrl(input)).toBeNull();
  });

  it("accepts every embedUrl parseVideoUrl derives — the two stay in step", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://vimeo.com/123456",
      "https://www.dailymotion.com/video/x7tgad0",
    ]) {
      const derived = parseVideoUrl(url);
      expect(derived).not.toBeNull();
      expect(parseVideoEmbedUrl(derived!.embedUrl)?.videoId).toBe(derived!.videoId);
    }
  });
});
