// Pure-function coverage for the upload pipeline (ADR-017 compliance):
// the sniffer decides by bytes, never by name or declared type; the size
// cap and key shape are asserted so the serving route's pattern and the
// driver's expectations stay in lockstep.
import { readFile } from "node:fs/promises";
import { ReferenceSourceType } from "@repo/db";
import { mediaSourceTypeSchema } from "@repo/contracts";
import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  OBJECT_KEY_PATTERN,
  UNSAFE_SVG,
  UploadRejectedError,
  contentDispositionFor,
  decodeMediaCursor,
  encodeMediaCursor,
  generateObjectKey,
  isUnsafeSvg,
  readImageDimensions,
  resolveThumbnailUrl,
  sniffImageType,
  sniffMediaType,
  validateImageUpload,
} from "./media.ts";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);

describe("sniffImageType", () => {
  it.each([
    ["png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0), "image/png"],
    ["jpeg", bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46), "image/jpeg"],
    ["gif89a", bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0), "image/gif"],
    ["gif87a", bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 1, 0), "image/gif"],
    [
      "webp",
      bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20),
      "image/webp",
    ],
    ["ico", bytes(0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10), "image/x-icon"],
    ["svg (bare)", text('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'), "image/svg+xml"],
    [
      "svg (xml prolog + doctype + BOM)",
      text(
        '﻿<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<svg></svg>',
      ),
      "image/svg+xml",
    ],
  ])("recognises %s by magic bytes", (_label, input, mime) => {
    const sniffed = sniffImageType(input);
    expect(isUnsafeSvg(sniffed)).toBe(false);
    expect(sniffed && !isUnsafeSvg(sniffed) ? sniffed.mimeType : null).toBe(mime);
  });

  it.each([
    ["html renamed to .png", text("<!doctype html><html><body>hi</body></html>")],
    ["javascript", text("alert(1)")],
    ["pdf", text("%PDF-1.7\n")],
    [
      "riff that is not webp (wav)",
      bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45),
    ],
    ["empty", bytes()],
  ])("rejects %s", (_label, input) => {
    expect(sniffImageType(input)).toBeNull();
  });

  // ADR-049 §6: still refused, but distinguishably so. Returning the same
  // `null` an unrecognised binary returns made validateImageUpload tell an
  // admin their SVG was not an SVG.
  it.each([
    [
      "svg carrying a <script>",
      text('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'),
    ],
    ["svg carrying an on* handler", text('<svg onload="alert(1)"></svg>')],
  ])("refuses %s as UNSAFE_SVG, not as an unrecognised type", (_label, input) => {
    expect(sniffImageType(input)).toBe(UNSAFE_SVG);
    expect(isUnsafeSvg(sniffImageType(input))).toBe(true);
    // The distinction has to survive the media sniffer too, or storeMedia
    // would fall through to the video/audio/document branches.
    expect(sniffMediaType(input)).toBe(UNSAFE_SVG);
  });
});

describe("validateImageUpload", () => {
  it("rejects an empty file, an unknown type and an oversize file with UploadRejectedError", () => {
    expect(() => validateImageUpload(bytes())).toThrow(UploadRejectedError);
    expect(() => validateImageUpload(text("nope"))).toThrow(UploadRejectedError);
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => validateImageUpload(big)).toThrow(/larger than/);
  });

  it("tells an admin WHY a scripted SVG was refused, not that it is not an image", () => {
    const scripted = text('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
    expect(() => validateImageUpload(scripted)).toThrow(/script or an event handler/);
    // The old message claimed an SVG was not one of the accepted types.
    expect(() => validateImageUpload(scripted)).not.toThrow(/are accepted/);
  });

  it("returns the sniffed type for a valid image exactly at the cap", () => {
    const atCap = new Uint8Array(MAX_UPLOAD_BYTES);
    atCap.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateImageUpload(atCap)).toEqual({ mimeType: "image/png", extension: "png" });
  });
});

describe("sniffMediaType — ADR-034 §1, video/audio/document", () => {
  it("recognises an mp4 (ISO-BMFF, non-M4A brand) as VIDEO", () => {
    const mp4 = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0);
    expect(sniffMediaType(mp4)).toEqual({ kind: "VIDEO", mimeType: "video/mp4", extension: "mp4" });
  });

  it("recognises an m4a (ISO-BMFF, M4A brand) as AUDIO", () => {
    const m4a = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20, 0, 0, 0, 0);
    expect(sniffMediaType(m4a)).toEqual({ kind: "AUDIO", mimeType: "audio/mp4", extension: "m4a" });
  });

  it("recognises a webm (EBML magic) as VIDEO", () => {
    const webm = bytes(0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4);
    expect(sniffMediaType(webm)).toEqual({
      kind: "VIDEO",
      mimeType: "video/webm",
      extension: "webm",
    });
  });

  it("recognises an mp3 by its ID3 tag as AUDIO", () => {
    const mp3 = bytes(0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0);
    expect(sniffMediaType(mp3)).toEqual({
      kind: "AUDIO",
      mimeType: "audio/mpeg",
      extension: "mp3",
    });
  });

  it("recognises an mp3 by a bare frame sync as AUDIO", () => {
    const mp3 = bytes(0xff, 0xfb, 0x90, 0, 0, 0);
    expect(sniffMediaType(mp3)).toEqual({
      kind: "AUDIO",
      mimeType: "audio/mpeg",
      extension: "mp3",
    });
  });

  it("recognises a pdf as DOCUMENT", () => {
    expect(sniffMediaType(text("%PDF-1.7\n"))).toEqual({
      kind: "DOCUMENT",
      mimeType: "application/pdf",
      extension: "pdf",
    });
  });

  it("still recognises images, folding them into the same result shape", () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
    expect(sniffMediaType(png)).toEqual({ kind: "IMAGE", mimeType: "image/png", extension: "png" });
  });

  it("rejects an unrecognised type", () => {
    expect(sniffMediaType(text("just some text"))).toBeNull();
    expect(sniffMediaType(bytes())).toBeNull();
  });

  it("never confuses an mp3 frame-sync false-positive with a webp riff header", () => {
    // RIFF...WEBP must not be mistaken for anything above — sanity check
    // that the two sniffers don't collide on overlapping leading bytes.
    const webp = bytes(
      0x52,
      0x49,
      0x46,
      0x46,
      0x24,
      0,
      0,
      0,
      0x57,
      0x45,
      0x42,
      0x50,
      0x56,
      0x50,
      0x38,
      0x20,
    );
    expect(sniffMediaType(webp)).toEqual({
      kind: "IMAGE",
      mimeType: "image/webp",
      extension: "webp",
    });
  });
});

describe("generateObjectKey", () => {
  it("produces random, extension-bearing keys the serving route accepts", () => {
    const a = generateObjectKey("png");
    const b = generateObjectKey("svg");
    expect(a).toMatch(OBJECT_KEY_PATTERN);
    expect(b).toMatch(OBJECT_KEY_PATTERN);
    expect(a).not.toBe(generateObjectKey("png"));
  });

  it("the serving pattern rejects traversal and foreign extensions", () => {
    for (const bad of ["../etc/passwd", "abc.html", "x.png", `${"a".repeat(24)}.exe`, ""]) {
      expect(OBJECT_KEY_PATTERN.test(bad)).toBe(false);
    }
  });
});

// ─── changes-13 / ADR-066 & ADR-067 ──────────────────────────

describe("readImageDimensions", () => {
  const png = (width: number, height: number) => {
    const buffer = new Uint8Array(24);
    buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(buffer.buffer).setUint32(16, width);
    new DataView(buffer.buffer).setUint32(20, height);
    return buffer;
  };

  it("reads a PNG's IHDR", () => {
    expect(readImageDimensions(png(1280, 720))).toEqual({ width: 1280, height: 720 });
  });

  it("reads a GIF's little-endian screen descriptor", () => {
    const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0xc0, 0x01);
    expect(readImageDimensions(gif)).toEqual({ width: 800, height: 448 });
  });

  it("reads a lossy WebP's VP8 frame header", () => {
    const webp = new Uint8Array(30);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    webp.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
    new DataView(webp.buffer).setUint16(26, 640, true);
    new DataView(webp.buffer).setUint16(28, 480, true);
    expect(readImageDimensions(webp)).toEqual({ width: 640, height: 480 });
  });

  it("walks a JPEG's marker chain to its start-of-frame", () => {
    // SOI, an APP0 segment to walk past, then SOF0 carrying 300x200.
    const jpeg = bytes(
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00, // APP0, length 4
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x00,
      0xc8,
      0x01,
      0x2c, // SOF0: 200 high, 300 wide
      0x03,
      0x01,
      0x11,
      0x00,
    );
    expect(readImageDimensions(jpeg)).toEqual({ width: 300, height: 200 });
  });

  it("reads an SVG's attributes, falling back to its viewBox", () => {
    expect(readImageDimensions(text('<svg width="64" height="32"></svg>'))).toEqual({
      width: 64,
      height: 32,
    });
    expect(readImageDimensions(text('<svg viewBox="0 0 120 60"></svg>'))).toEqual({
      width: 120,
      height: 60,
    });
  });

  it("returns null for anything it does not recognise, rather than throwing", () => {
    expect(readImageDimensions(text("not an image at all"))).toBeNull();
    expect(readImageDimensions(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBeNull();
    expect(readImageDimensions(bytes())).toBeNull();
    // A truncated JPEG must terminate, not spin.
    expect(readImageDimensions(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00))).toBeNull();
  });
});

describe("media cursors (ADR-067 §3)", () => {
  it("round-trips a timestamp and id, and rejects a malformed cursor", () => {
    const createdAt = new Date("2026-09-09T10:11:12.345Z");
    const decoded = decodeMediaCursor(encodeMediaCursor({ createdAt, id: "abc123" }));
    expect(decoded?.id).toBe("abc123");
    expect(decoded?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(decodeMediaCursor("not-a-cursor")).toBeNull();
    expect(decodeMediaCursor(Buffer.from("nope|", "utf8").toString("base64url"))).toBeNull();
  });
});

describe("resolveThumbnailUrl (changes-13 D6 — the derivative seam)", () => {
  it("is the asset URL for an image and empty for every other kind", () => {
    expect(resolveThumbnailUrl({ url: "/uploads/a.png", kind: "IMAGE" })).toBe("/uploads/a.png");
    for (const kind of ["VIDEO", "AUDIO", "DOCUMENT"] as const) {
      expect(resolveThumbnailUrl({ url: "/uploads/a.mp4", kind })).toBe("");
    }
  });
});

describe("contentDispositionFor (ADR-034 §1, the gap changes-13 §9 #6 named)", () => {
  it("makes a DOCUMENT a download and leaves every renderable kind inline", () => {
    expect(contentDispositionFor("DOCUMENT", "guide.pdf")).toContain("attachment");
    for (const kind of ["IMAGE", "VIDEO", "AUDIO"] as const) {
      expect(contentDispositionFor(kind, "cover.png")).toBeNull();
    }
  });

  it("carries both filename forms, so an old parser and a correct one agree", () => {
    expect(contentDispositionFor("DOCUMENT", "risk-guide.pdf")).toBe(
      `attachment; filename="risk-guide.pdf"; filename*=UTF-8''risk-guide.pdf`,
    );
  });

  it("never lets a filename break out of the header value", () => {
    // A filename is whatever the uploader's file was called — quotes,
    // backslashes, CR/LF and every other control byte are scrubbed from the
    // ASCII fallback, and the RFC 5987 form is percent-encoded regardless.
    const header = contentDispositionFor("DOCUMENT", 'a"; x=y\r\nX-Evil: 1\\b.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain(`filename="a_; x=y__X-Evil: 1_b.pdf"`);
    expect(header).toContain("filename*=UTF-8''a%22%3B%20x%3Dy%0D%0AX-Evil%3A%201%5Cb.pdf");
    // The header a Response would carry must survive Headers' own validation.
    expect(() => new Headers({ "Content-Disposition": header ?? "" })).not.toThrow();
  });

  it("falls back to a name rather than an empty quoted string for a non-ASCII filename", () => {
    const header = contentDispositionFor("DOCUMENT", "دليل.pdf");
    expect(header).toContain(`filename="____.pdf"`);
    expect(header).toContain("filename*=UTF-8''%D8%AF%D9%84%D9%8A%D9%84.pdf");
    expect(contentDispositionFor("DOCUMENT", "…")).toContain(`filename="download"`);
  });
});

describe("ADR-067 §1 — no unbounded read exists", () => {
  it("no exported reader hands back a bare MediaAssetRow[] list of the library", async () => {
    const source = await readFile(new URL("./media.ts", import.meta.url), "utf8");
    // `getRecentlyUsedMedia` is the one array-returning reader, and it is
    // bounded internally (<= 24). Anything else returning an array of rows
    // would be a way to ask for the whole library, which is the door
    // ADR-067 closes.
    const arrayReturners = [
      ...source.matchAll(/export async function (\w+)[\s\S]*?Promise<([^>]+)>/g),
    ]
      .filter(([, , returns]) => returns?.includes("MediaAssetRow[]"))
      .map(([, name]) => name);
    expect(arrayReturners).toEqual(["getRecentlyUsedMedia"]);
    expect(source).toContain("export async function listMediaAssets(");
    expect(source).toMatch(/listMediaAssets\([\s\S]*?\): Promise<ListMediaAssetsPage>/);
  });
});

describe("mediaSourceTypeSchema mirrors the Prisma enum", () => {
  it("names exactly the ReferenceSourceType members — a drift guard, since contracts cannot import the client", () => {
    expect([...mediaSourceTypeSchema.options].sort()).toEqual(
      Object.values(ReferenceSourceType).sort(),
    );
  });
});
