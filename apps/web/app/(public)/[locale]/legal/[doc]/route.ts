import { readStoredFile } from "@repo/core";
import {
  isLegalDocumentKey,
  LEGAL_DOCUMENT_MIME,
  LEGAL_DOCUMENT_SETTING,
  STORED_UPLOAD_PREFIX,
} from "@repo/contracts";
import { getSetting } from "@repo/settings";

// `/legal/terms`, `/legal/privacy`, `/legal/agreement` (changes-33, ADR-110).
//
// **The address is ours, not the file's.** An admin replaces the PDF and every
// link that has ever been printed — in the footer, in an email, in a signed
// document — still resolves. Linking the stored path directly would mean a
// replacement silently breaks last year's links, and would publish a storage
// key in the page source of every page on the site.
//
// A route handler, not a page: there is no chrome to put around a PDF that a
// browser's own viewer does not already give the reader, and an embedded
// viewer of ours would be a worse one that also has to be maintained.
//
// **Two branches, because two kinds of path reach it** (ADR-110):
//
//   - `/uploads/<key>` — an admin's own upload. The bytes come back through
//     `readStoredFile`, which will only serve a key the MediaAsset table
//     knows, and go out with `Content-Disposition: inline`. That is the one
//     deliberate exception to ADR-034 §1's attachment default for a DOCUMENT,
//     and it is narrow on purpose: this route, PDF only. The rule itself is
//     unchanged — `/uploads/[file]` still sends every DOCUMENT as an
//     attachment, because nothing there knows it was asked for on purpose.
//   - anything else — a committed file under `public/`, which is what a
//     seeded install points at. A redirect, because Next already serves it
//     with the right type and no disposition at all, and re-reading it
//     through here would be a second copy of the same bytes in memory.
//
// It lives inside `[locale]` rather than beside `/uploads` for one practical
// reason: the proxy locale-prefixes every path without a dot in it, so a
// root-level `/legal/terms` would be rewritten to a route that does not
// exist. Route handlers ignore layouts, so the locale segment costs nothing
// and `/es/legal/terms` resolves to the same document.

export async function GET(_request: Request, { params }: RouteContext<"/[locale]/legal/[doc]">) {
  const { doc } = await params;
  // Not a 400: which documents exist is not something a visitor should be
  // able to enumerate by watching status codes, and a typo'd legal link is a
  // missing page, not a malformed request.
  if (!isLegalDocumentKey(doc)) return new Response("Not found", { status: 404 });

  const stored = await getSetting(LEGAL_DOCUMENT_SETTING[doc]);
  // Empty is a legitimate state — an installation that has not published this
  // document. The footer already omits the link; this is the direct-navigation
  // half of the same answer.
  if (!stored) return new Response("Not found", { status: 404 });

  if (!stored.startsWith(STORED_UPLOAD_PREFIX)) {
    // A committed file under `public/`. `307`, not `301`: the target is a
    // setting an admin can change this afternoon, and a permanent redirect is
    // cached by browsers past any deploy that changes it.
    return Response.redirect(new URL(stored, _request.url), 307);
  }

  const key = stored.slice(STORED_UPLOAD_PREFIX.length);
  const file = await readStoredFile(key);
  if (!file) return new Response("Not found", { status: 404 });
  // The MIME recorded at upload decides, not the extension and not this
  // route's wish: an admin who pointed the setting at a `.docx` gets a 404
  // rather than a PDF header over bytes that are not one. `LEGAL_DOCUMENT_MIME`
  // is the whole allowlist, and it is what makes the inline exception above
  // defensible — a browser renders a PDF in a sandboxed viewer of its own.
  if (file.mimeType !== LEGAL_DOCUMENT_MIME) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": LEGAL_DOCUMENT_MIME,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // Short, and deliberately not the year `/uploads/[file]` uses: that
      // route's keys are random and never reused, so the bytes behind one can
      // never change. This URL is stable ACROSS a change of file, which is
      // the opposite property.
      "Cache-Control": "public, max-age=300",
    },
  });
}
