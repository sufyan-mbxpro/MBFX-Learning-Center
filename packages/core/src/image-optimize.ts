// Upload-time image optimisation (ADR-130). The one place uploaded pixels are
// re-encoded: EXIF orientation is applied, every metadata block (GPS
// included) is dropped, and the result is a WebP sized to a byte budget.
//
// Pure with respect to storage and the database — `storeMedia` and
// `replaceMedia` decide what to do with the result — so the policy is unit
// tested against real encoded bytes rather than through an upload.
import sharp from "sharp";

/**
 * The size an uploaded image is aimed at (owner, 2026-09-17: "around 80kb").
 * A budget rather than a fixed quality, because a fixed quality makes a
 * detailed 1920px photograph 250 KB and a flat diagram 15 KB — the same
 * setting cannot land both near one size.
 */
export const OPTIMIZE_TARGET_BYTES = 80_000;

/**
 * Quality is searched between these. The top is the medium-compression
 * setting the owner accepted; nothing is ever encoded sharper just to spend
 * a budget a simple image does not need. Below the floor WebP blocks and
 * smears visibly, so resolution gives way before quality does.
 */
export const OPTIMIZE_MAX_QUALITY = 85;
export const OPTIMIZE_MIN_QUALITY = 60;

/**
 * Longest-edge steps, tried in order until the floor quality fits the budget.
 * 1280 is the smallest step: it still covers the widest in-page slot (the
 * 768px article cover) at better than 1.5x. An image that is over budget even
 * there is kept at 1280 / the floor quality, the closest it can get.
 */
export const OPTIMIZE_EDGE_STEPS = [3840, 2560, 1920, 1600, 1280] as const;
export const OPTIMIZE_MAX_EDGE = OPTIMIZE_EDGE_STEPS[0];

/**
 * Pixel ceiling handed to libvips. An image past it is not optimised — it is
 * stored as sent, exactly as every image was before ADR-130 — so a
 * decompression bomb costs a refusal to decode, never the process's memory.
 */
const MAX_INPUT_PIXELS = 100_000_000;

/**
 * `brand` and `setting` keep their bytes. Those uploads are logos, the
 * favicon, the email logo and the default share image: an email client
 * (Outlook desktop) and some link-preview crawlers do not render WebP, and a
 * favicon's container is the point of it. Everything a PAGE shows — covers,
 * inline images, avatars — is optimised.
 */
export function purposeIsOptimized(purpose: string): boolean {
  return purpose !== "brand" && purpose !== "setting";
}

/**
 * Raster formats worth re-encoding. GIF is left alone because libvips would
 * keep only its first frame of an animation; ICO and SVG are not photographs.
 */
const OPTIMIZABLE_EXTENSIONS = new Set(["jpg", "png", "webp"]);

export interface OptimizedImage {
  bytes: Uint8Array;
  mimeType: "image/webp";
  extension: "webp";
  width: number;
  height: number;
  /** The WebP quality the budget search settled on, for the audit row. */
  quality: number;
}

/** An APNG is a PNG carrying an `acTL` chunk before its first `IDAT`; re-encoding would freeze it. */
function isAnimatedPng(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const actl = head.indexOf("acTL");
  const idat = head.indexOf("IDAT");
  return actl !== -1 && (idat === -1 || actl < idat);
}

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  channels: 1 | 2 | 3 | 4;
}

interface Encoded {
  data: Buffer;
  quality: number;
}

async function resizeRaw(source: RawImage, edge: number): Promise<RawImage> {
  if (Math.max(source.width, source.height) <= edge) return source;
  const { data, info } = await sharp(source.data, {
    raw: { width: source.width, height: source.height, channels: source.channels },
  })
    .resize({ width: edge, height: edge, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

async function encode(image: RawImage, quality: number): Promise<Encoded> {
  const data = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: image.channels },
  })
    // smartSubsample: sharper colour edges (red text, chart lines) for a few % more bytes.
    .webp({ quality, smartSubsample: true })
    .toBuffer();
  return { data, quality };
}

/**
 * The highest quality in [MIN, MAX] that fits the budget at this size, or
 * `null` when even the floor does not fit. Integer bisection: at most six
 * encodes, usually four.
 */
async function fitQuality(image: RawImage): Promise<{ fit: Encoded | null; floor: Encoded }> {
  const top = await encode(image, OPTIMIZE_MAX_QUALITY);
  if (top.data.length <= OPTIMIZE_TARGET_BYTES) return { fit: top, floor: top };
  const floor = await encode(image, OPTIMIZE_MIN_QUALITY);
  if (floor.data.length > OPTIMIZE_TARGET_BYTES) return { fit: null, floor };

  let best = floor;
  let lo = OPTIMIZE_MIN_QUALITY;
  let hi = OPTIMIZE_MAX_QUALITY;
  // Quality steps under 3 are not visible; stopping there saves two encodes.
  while (hi - lo > 3) {
    const mid = Math.floor((lo + hi) / 2);
    const attempt = await encode(image, mid);
    if (attempt.data.length <= OPTIMIZE_TARGET_BYTES) {
      best = attempt;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { fit: best, floor };
}

/**
 * Returns the WebP to store, or `null` to store the original bytes.
 *
 * Size first, then quality: at each edge step the best quality that fits
 * `OPTIMIZE_TARGET_BYTES` wins, and only when the floor quality does not fit
 * does the image step down to the next edge. A step is skipped outright when
 * the floor's size, scaled by pixel count, says it cannot fit either.
 *
 * `null` is never a failure the uploader sees: the sniffer already accepted
 * the file, and an image this step cannot improve (an animation, an
 * undecodable body, a re-encode that came out LARGER without a resize) is
 * exactly as good as it was before this step existed.
 */
export async function optimizeImage(
  bytes: Uint8Array,
  extension: string,
): Promise<OptimizedImage | null> {
  if (!OPTIMIZABLE_EXTENSIONS.has(extension)) return null;
  if (extension === "png" && isAnimatedPng(bytes)) return null;

  try {
    const input = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await input.metadata();
    if ((meta.pages ?? 1) > 1) return null; // animated WebP
    const originalEdge = Math.max(meta.width ?? 0, meta.height ?? 0);

    const decoded = await input
      .rotate() // bake EXIF orientation in before the metadata carrying it is dropped
      .resize({
        width: OPTIMIZE_MAX_EDGE,
        height: OPTIMIZE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Every step resizes from this, never from the previous step, so a second
    // downscale does not compound the first one's softening.
    const full: RawImage = {
      data: decoded.data,
      width: decoded.info.width,
      height: decoded.info.height,
      channels: decoded.info.channels,
    };
    let image = full;

    let chosen: Encoded | null = null;
    const steps = OPTIMIZE_EDGE_STEPS.filter((edge) => edge < Math.max(full.width, full.height));
    for (let index = -1; index < steps.length; index++) {
      if (index >= 0) image = await resizeRaw(full, steps[index] as number);
      const { fit, floor } = await fitQuality(image);
      if (fit) {
        chosen = fit;
        break;
      }
      chosen = floor; // over budget here; kept only if no smaller step exists

      // Bytes scale roughly with pixel count: skip steps that cannot fit.
      while (index + 1 < steps.length - 1) {
        const next = steps[index + 1] as number;
        const scale = next / Math.max(image.width, image.height);
        const predicted = floor.data.length * scale * scale;
        if (predicted <= OPTIMIZE_TARGET_BYTES * 1.15) break;
        index++;
      }
    }
    if (!chosen) return null;

    const finalEdge = Math.max(image.width, image.height);
    // A small, already-tight image can grow by re-encoding. Without a resize
    // there is nothing gained by keeping the bigger file.
    if (finalEdge >= originalEdge && chosen.data.length >= bytes.length) return null;

    return {
      bytes: new Uint8Array(chosen.data.buffer, chosen.data.byteOffset, chosen.data.length),
      mimeType: "image/webp",
      extension: "webp",
      width: image.width,
      height: image.height,
      quality: chosen.quality,
    };
  } catch {
    return null;
  }
}

/** `holiday.JPG` → `holiday.webp`, so a download's suggested name matches its bytes. */
export function withExtension(fileName: string, extension: string): string {
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${stem.slice(0, 254 - extension.length)}.${extension}`;
}
