// Pure-function coverage for the upload pipeline (ADR-017 compliance):
// the sniffer decides by bytes, never by name or declared type; the size
// cap and key shape are asserted so the serving route's pattern and the
// driver's expectations stay in lockstep.
import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  OBJECT_KEY_PATTERN,
  UploadRejectedError,
  generateObjectKey,
  sniffImageType,
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
    expect(sniffImageType(input)?.mimeType).toBe(mime);
  });

  it.each([
    ["html renamed to .png", text("<!doctype html><html><body>hi</body></html>")],
    ["javascript", text("alert(1)")],
    ["pdf", text("%PDF-1.7\n")],
    ["riff that is not webp (wav)", bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)],
    ["svg carrying a <script>", text('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')],
    ["svg carrying an on* handler", text('<svg onload="alert(1)"></svg>')],
    ["empty", bytes()],
  ])("rejects %s", (_label, input) => {
    expect(sniffImageType(input)).toBeNull();
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

  it("returns the sniffed type for a valid image exactly at the cap", () => {
    const atCap = new Uint8Array(MAX_UPLOAD_BYTES);
    atCap.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateImageUpload(atCap)).toEqual({ mimeType: "image/png", extension: "png" });
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
