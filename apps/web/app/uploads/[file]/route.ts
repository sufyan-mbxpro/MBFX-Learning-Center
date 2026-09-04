import { readStoredFile } from "@repo/core";

// Serves uploaded media (ADR-017). Only keys the MediaAsset table knows are
// served, with the MIME recorded at upload; the key pattern is enforced in
// core before any filesystem access, so traversal never reaches the disk.
// Lives outside both route groups (no locale prefix, no admin gate — these
// are public assets: logos, covers, share images). The proxy matcher skips
// dotted paths, so it never sees these requests.
//
// SVG gets a sandboxing CSP: inside an <img> scripts never run anyway, but a
// direct navigation to the file would — the header closes that door.
export async function GET(_request: Request, { params }: RouteContext<"/uploads/[file]">) {
  const { file } = await params;
  const stored = await readStoredFile(file);
  if (!stored) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": stored.mimeType,
    "Content-Length": String(stored.bytes.byteLength),
    // Keys are random and never reused — safe to cache forever.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  if (stored.mimeType === "image/svg+xml") {
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    );
  }
  // Buffer.from wraps without copying and satisfies Response's BodyInit
  // typing (a plain Uint8Array<ArrayBufferLike> does not, under this lib's
  // stricter typed-array generics).
  return new Response(Buffer.from(stored.bytes), { status: 200, headers });
}
