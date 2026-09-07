// Pure-function coverage for the upload pipeline (ADR-017 compliance):
// the sniffer decides by bytes, never by name or declared type; the size
// cap and key shape are asserted so the serving route's pattern and the
// driver's expectations stay in lockstep.
import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  OBJECT_KEY_PATTERN,
  UNSAFE_SVG,
  UploadRejectedError,
  generateObjectKey,
  isUnsafeSvg,
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
