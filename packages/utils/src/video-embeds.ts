// Video embed whitelist + URL parser (Module 15, ADR-015 #9).
//
// The database stores only the user-pasted URL; provider, video id, embed
// URL and thumbnail are derived here at validation/render time — iframes
// are never stored, which is what makes the embed pipeline XSS-safe by
// construction. Adding a provider = one entry in PARSERS.

export type VideoProvider = "youtube" | "vimeo" | "dailymotion";

export interface ParsedVideo {
  provider: VideoProvider;
  videoId: string;
  /** Privacy-enhanced domain for YouTube (youtube-nocookie.com). */
  embedUrl: string;
  /** null where deriving one needs an API call (Vimeo/Dailymotion). */
  thumbnailUrl: string | null;
  originalUrl: string;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const DAILYMOTION_ID = /^[a-z0-9]{5,12}$/;

function youtube(id: string, originalUrl: string): ParsedVideo | null {
  if (!YOUTUBE_ID.test(id)) return null;
  return {
    provider: "youtube",
    videoId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    originalUrl,
  };
}

function vimeo(id: string, originalUrl: string): ParsedVideo | null {
  if (!VIMEO_ID.test(id)) return null;
  return {
    provider: "vimeo",
    videoId: id,
    embedUrl: `https://player.vimeo.com/video/${id}`,
    thumbnailUrl: null,
    originalUrl,
  };
}

function dailymotion(id: string, originalUrl: string): ParsedVideo | null {
  if (!DAILYMOTION_ID.test(id)) return null;
  return {
    provider: "dailymotion",
    videoId: id,
    embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
    thumbnailUrl: null,
    originalUrl,
  };
}

type HostParser = (url: URL, originalUrl: string) => ParsedVideo | null;

const PARSERS: HostParser[] = [
  // youtube.com/watch?v=ID | /shorts/ID | /live/ID | /embed/ID
  (url, original) => {
    if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
    const v = url.searchParams.get("v");
    if (url.pathname === "/watch" && v) return youtube(v, original);
    const path = /^\/(shorts|live|embed)\/([^/]+)$/.exec(url.pathname);
    if (path?.[2]) return youtube(path[2], original);
    return null;
  },
  // youtu.be/ID
  (url, original) => {
    if (url.hostname !== "youtu.be") return null;
    const id = url.pathname.slice(1).split("/")[0];
    return id ? youtube(id, original) : null;
  },
  // vimeo.com/ID | player.vimeo.com/video/ID
  (url, original) => {
    if (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") {
      const id = url.pathname.slice(1).split("/")[0];
      return id ? vimeo(id, original) : null;
    }
    if (url.hostname === "player.vimeo.com") {
      const path = /^\/video\/(\d+)$/.exec(url.pathname);
      return path?.[1] ? vimeo(path[1], original) : null;
    }
    return null;
  },
  // dailymotion.com/video/ID | dai.ly/ID
  (url, original) => {
    if (url.hostname === "dailymotion.com" || url.hostname === "www.dailymotion.com") {
      const path = /^\/video\/([^/_]+)/.exec(url.pathname);
      return path?.[1] ? dailymotion(path[1], original) : null;
    }
    if (url.hostname === "dai.ly") {
      const id = url.pathname.slice(1).split("/")[0];
      return id ? dailymotion(id, original) : null;
    }
    return null;
  },
];

/**
 * Whitelist parse: a recognized YouTube/Vimeo/Dailymotion URL yields the
 * derived embed data; anything else — other hosts, malformed URLs,
 * non-http(s) schemes, raw iframe markup — yields null.
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  for (const parse of PARSERS) {
    const parsed = parse(url, input.trim());
    if (parsed) return parsed;
  }
  return null;
}

/**
 * The inverse of the three `embedUrl` shapes `parseVideoUrl` derives, and
 * the ONLY way an `<iframe>` is allowed to survive `sanitizeRichText`
 * (changes-10, ADR-046).
 *
 * ADR-015 #9 froze "iframes are never stored": the article-level video
 * field keeps the pasted URL and derives the frame at render. In-body
 * embeds cannot do that — the body renders through
 * `dangerouslySetInnerHTML`, so whatever is stored IS what renders. This
 * function preserves the property that matters instead: nothing an author
 * typed survives except a provider and an 11-character id, and the src,
 * the attribute set and the wrapper are all reconstructed from that on
 * EVERY save. A hand-written `<iframe src="https://evil.example">` in the
 * HTML source view parses to null and is dropped.
 */
export function parseVideoEmbedUrl(input: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  if (url.hostname === "www.youtube-nocookie.com") {
    const path = /^\/embed\/([^/?#]+)$/.exec(url.pathname);
    return path?.[1] ? youtube(path[1], input.trim()) : null;
  }
  if (url.hostname === "player.vimeo.com") {
    const path = /^\/video\/(\d+)$/.exec(url.pathname);
    return path?.[1] ? vimeo(path[1], input.trim()) : null;
  }
  if (url.hostname === "www.dailymotion.com") {
    const path = /^\/embed\/video\/([^/?#]+)$/.exec(url.pathname);
    return path?.[1] ? dailymotion(path[1], input.trim()) : null;
  }
  return null;
}
