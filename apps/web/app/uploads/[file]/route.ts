import {
  contentDispositionFor,
  readStoredFile,
  readStoredFileMeta,
  readStoredFileRange,
} from "@repo/core";

// Serves uploaded media (ADR-017, extended by ADR-034 §1 for Range).  Only
// keys the MediaAsset table knows are served, with the MIME recorded at
// upload; the key pattern is enforced in core before any filesystem
// access, so traversal never reaches the disk. Lives outside both route
// groups (no locale prefix, no admin gate — these are public assets:
// logos, covers, share images, video/audio, documents). The proxy matcher
// skips dotted paths, so it never sees these requests.
//
// SVG gets a sandboxing CSP: inside an <img> scripts never run anyway, but a
// direct navigation to the file would — the header closes that door. A
// DOCUMENT gets `Content-Disposition: attachment` one kind over, for the same
// reason: nothing in this repository embeds a PDF, so a same-origin
// navigation into one is a render nobody asked for (ADR-034 §1, the half
// changes-13 §9 #6 recorded as still owed). Core decides; this composes.
//
// A single `Range: bytes=start-end` is honoured (video/audio seek); a
// missing or malformed header falls through to a full 200 response.
// Multi-range requests are not split into multipart/byteranges — treated
// as "no usable range", the same fallback as no header at all.
const SINGLE_RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

export async function GET(request: Request, { params }: RouteContext<"/uploads/[file]">) {
  const { file } = await params;
  // Metadata first: a range request must not pay for the whole object just
  // to learn its length. Reading a 100 MB video into memory to return a few
  // hundred KB of it is how one seeking viewer becomes a memory incident.
  const meta = await readStoredFileMeta(file);
  if (!meta) return new Response("Not found", { status: 404 });

  const total = meta.size;
  const baseHeaders = new Headers({
    "Content-Type": meta.mimeType,
    "Accept-Ranges": "bytes",
    // Keys are random and never reused — safe to cache forever.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  const disposition = contentDispositionFor(meta.kind, meta.fileName);
  if (disposition) baseHeaders.set("Content-Disposition", disposition);
  if (meta.mimeType === "image/svg+xml") {
    baseHeaders.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    );
  }

  const range = SINGLE_RANGE_PATTERN.exec(request.headers.get("range") ?? "");
  if (range) {
    const [, startText, endText] = range;
    const start = startText ? Number(startText) : total - Number(endText);
    const end = endText && startText ? Math.min(Number(endText), total - 1) : total - 1;
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start >= 0 &&
      start <= end &&
      end < total
    ) {
      const slice = await readStoredFileRange(file, start, end);
      if (!slice) return new Response("Not found", { status: 404 });
      baseHeaders.set("Content-Length", String(slice.byteLength));
      baseHeaders.set("Content-Range", `bytes ${start}-${end}/${total}`);
      return new Response(Buffer.from(slice), { status: 206, headers: baseHeaders });
    }
  }

  const stored = await readStoredFile(file);
  if (!stored) return new Response("Not found", { status: 404 });

  // Buffer.from wraps without copying and satisfies Response's BodyInit
  // typing (a plain Uint8Array<ArrayBufferLike> does not, under this lib's
  // stricter typed-array generics).
  baseHeaders.set("Content-Length", String(stored.bytes.byteLength));
  return new Response(Buffer.from(stored.bytes), { status: 200, headers: baseHeaders });
}
