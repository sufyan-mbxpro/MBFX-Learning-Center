import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./video-embeds.ts";

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
