// ADR-130: the upload-time optimiser, exercised against bytes sharp itself
// encodes — the policy is about real containers, so a fixture of fake bytes
// would test nothing.
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  OPTIMIZE_EDGE_STEPS,
  OPTIMIZE_MAX_EDGE,
  OPTIMIZE_MAX_QUALITY,
  OPTIMIZE_MIN_QUALITY,
  OPTIMIZE_TARGET_BYTES,
  optimizeImage,
  purposeIsOptimized,
  withExtension,
} from "./image-optimize.ts";
import { readImageDimensions, sniffImageType } from "./media.ts";

/**
 * A photograph-like raster: smooth gradients plus a little grain. Pure noise
 * is incompressible, so every encoder's output would be about the same size
 * and the "smaller" assertions would test the fixture, not the optimiser.
 */
async function photo(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp",
  options: { exifOrientation?: number; gps?: boolean } = {},
): Promise<Uint8Array> {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const grain = seed % 12;
      const i = (y * width + x) * 3;
      pixels[i] = Math.floor((x / width) * 200) + grain;
      pixels[i + 1] = Math.floor((y / height) * 200) + grain;
      pixels[i + 2] = Math.floor(((x + y) / (width + height)) * 200) + grain;
    }
  }
  let image = sharp(pixels, { raw: { width, height, channels: 3 } });
  if (options.exifOrientation || options.gps) {
    image = image.withMetadata({
      ...(options.exifOrientation ? { orientation: options.exifOrientation } : {}),
      ...(options.gps
        ? { exif: { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } } }
        : {}),
    });
  }
  const encoded =
    format === "jpeg"
      ? image.jpeg({ quality: 95 })
      : format === "png"
        ? image.png()
        : image.webp({ quality: 100 });
  return new Uint8Array(await encoded.toBuffer());
}

/** A smooth gradient with no grain: compresses so well it fits the budget at any size. */
async function flat(width: number, height: number, format: "png" | "webp"): Promise<Uint8Array> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      pixels[i] = Math.floor((x / width) * 255);
      pixels[i + 1] = Math.floor((y / height) * 255);
      pixels[i + 2] = 128;
    }
  }
  const image = sharp(pixels, { raw: { width, height, channels: 3 } });
  const encoded = format === "png" ? image.png() : image.webp({ quality: 100, lossless: true });
  return new Uint8Array(await encoded.toBuffer());
}

/** Pure noise: incompressible, so no quality fits the budget until the pixels go. */
async function noise(width: number, height: number): Promise<Uint8Array> {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 3;
  for (let i = 0; i < pixels.length; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    pixels[i] = seed % 256;
  }
  return new Uint8Array(
    await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 90 })
      .toBuffer(),
  );
}

describe("purposeIsOptimized", () => {
  it("leaves brand and setting uploads alone and optimises what pages show", () => {
    expect(purposeIsOptimized("brand")).toBe(false);
    expect(purposeIsOptimized("setting")).toBe(false);
    expect(purposeIsOptimized("article")).toBe(true);
    expect(purposeIsOptimized("content")).toBe(true);
    expect(purposeIsOptimized("avatar")).toBe(true);
  });
});

describe("optimizeImage", () => {
  it("converts a JPEG to a smaller WebP the sniffer recognises", async () => {
    const input = await photo(800, 600, "jpeg");
    const result = await optimizeImage(input, "jpg");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/webp");
    expect(result!.bytes.length).toBeLessThan(input.length);
    expect(sniffImageType(result!.bytes)).toEqual({ mimeType: "image/webp", extension: "webp" });
    expect(readImageDimensions(result!.bytes)).toEqual({ width: 800, height: 600 });
  });

  it("caps the longest edge and keeps the aspect ratio", async () => {
    const input = await flat(4800, 2400, "png");
    const result = await optimizeImage(input, "png");
    expect(result).toMatchObject({ width: OPTIMIZE_MAX_EDGE, height: OPTIMIZE_MAX_EDGE / 2 });
  });

  it("never enlarges a small image", async () => {
    const result = await optimizeImage(await photo(300, 200, "png"), "png");
    expect(result).toMatchObject({ width: 300, height: 200 });
  });

  it("applies EXIF orientation and strips metadata, GPS included", async () => {
    // Orientation 6 = rotate 90° clockwise to display: a 400×200 landscape
    // sensor frame is a 200×400 portrait on screen.
    const input = await photo(400, 200, "jpeg", { exifOrientation: 6, gps: true });
    const before = await sharp(input).metadata();
    expect(before.orientation).toBe(6); // the fixture really carries both
    expect(before.exif).toBeDefined();
    const result = await optimizeImage(input, "jpg");
    expect(result).toMatchObject({ width: 200, height: 400 });
    const meta = await sharp(result!.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("keeps the original when a re-encode would be larger and nothing was resized", async () => {
    // A tiny WebP at a low quality has no room left to shrink.
    const tiny = new Uint8Array(
      await sharp({
        create: { width: 16, height: 16, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .webp({ quality: 1 })
        .toBuffer(),
    );
    expect(await optimizeImage(tiny, "webp")).toBeNull();
  });

  it("re-encodes an oversized WebP even though it is already WebP", async () => {
    const result = await optimizeImage(await flat(4800, 2400, "webp"), "webp");
    expect(result).toMatchObject({ width: OPTIMIZE_MAX_EDGE, height: OPTIMIZE_MAX_EDGE / 2 });
  });

  it("keeps the medium quality when the image is already under budget", async () => {
    const result = await optimizeImage(await photo(800, 600, "jpeg"), "jpg");
    expect(result!.quality).toBe(OPTIMIZE_MAX_QUALITY);
    expect(result!.bytes.length).toBeLessThanOrEqual(OPTIMIZE_TARGET_BYTES);
  });

  it("brings a detailed photograph under the budget, lowering quality before resolution", async () => {
    const input = await photo(1920, 1280, "jpeg");
    expect(input.length).toBeGreaterThan(OPTIMIZE_TARGET_BYTES); // the fixture really is over
    const result = await optimizeImage(input, "jpg");
    expect(result!.bytes.length).toBeLessThanOrEqual(OPTIMIZE_TARGET_BYTES);
    expect(result!.quality).toBeGreaterThanOrEqual(OPTIMIZE_MIN_QUALITY);
    expect(result!.width / result!.height).toBeCloseTo(1920 / 1280, 2);
    // Resolution only gives way when the floor quality did not fit at full size.
    if (result!.width < 1920) expect(result!.quality).toBeGreaterThan(OPTIMIZE_MIN_QUALITY);
  });

  it("steps down to the smallest edge at the floor quality when nothing else fits", async () => {
    const result = await optimizeImage(await noise(3000, 2000), "jpg");
    const smallest = OPTIMIZE_EDGE_STEPS[OPTIMIZE_EDGE_STEPS.length - 1];
    expect(result).toMatchObject({ width: smallest, quality: OPTIMIZE_MIN_QUALITY });
  });

  it("does not touch GIF, ICO or SVG", async () => {
    const bytes = await photo(64, 64, "png");
    for (const extension of ["gif", "ico", "svg"]) {
      expect(await optimizeImage(bytes, extension)).toBeNull();
    }
  });

  it("does not freeze an animated PNG", async () => {
    const png = await photo(64, 64, "png");
    // Splice an acTL chunk in after IHDR (8-byte signature + 25-byte IHDR).
    const actl = new Uint8Array([
      0, 0, 0, 8, 0x61, 0x63, 0x54, 0x4c, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const apng = new Uint8Array(png.length + actl.length);
    apng.set(png.subarray(0, 33));
    apng.set(actl, 33);
    apng.set(png.subarray(33), 33 + actl.length);
    expect(await optimizeImage(apng, "png")).toBeNull();
  });

  it("returns null for bytes it cannot decode instead of failing the upload", async () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
    expect(await optimizeImage(broken, "jpg")).toBeNull();
  });
});

describe("withExtension", () => {
  it("swaps the extension and keeps the stem", () => {
    expect(withExtension("Holiday Photo.JPG", "webp")).toBe("Holiday Photo.webp");
    expect(withExtension("archive.tar.png", "webp")).toBe("archive.tar.webp");
    expect(withExtension("noext", "webp")).toBe("noext.webp");
    expect(withExtension(".hidden", "webp")).toBe(".hidden.webp");
  });

  it("stays within the 255-character column", () => {
    const name = withExtension(`${"a".repeat(300)}.png`, "webp");
    expect(name.length).toBeLessThanOrEqual(255);
    expect(name.endsWith(".webp")).toBe(true);
  });
});
