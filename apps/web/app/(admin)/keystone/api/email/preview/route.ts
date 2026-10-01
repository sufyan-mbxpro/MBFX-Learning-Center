import {
  announcementPreviewSchema,
  emailDesignSaveSchema,
  emailPreviewSchema,
} from "@repo/contracts";
import {
  renderAnnouncementPreview,
  renderCustomEmailPreview,
  renderEmailDesignPreview,
  renderEmailPreview,
} from "@repo/core";
import { requireAnyPermission, requirePermission } from "@repo/rbac";
import { siteUrl } from "../../../../../_lib/site-url";
import { previewImagesFromViewer } from "./preview-images";

// The email preview, isolated (ADR-078 #8).
//
// It serves the rendered message as a DOCUMENT, because that is what it is: an
// email body, authored by an admin, possibly a whole `<html>` document in HTML
// mode. Three things keep it from being an XSS on the admin surface:
//
//   1. **Its own CSP.** `sandbox` gives the response an opaque origin with no
//      script, no forms and no same-origin access, whatever the body contains.
//      `style-src 'unsafe-inline'` is deliberate — inline styles are what an
//      email IS, and the sandbox is what makes allowing them safe.
//   2. **The frame.** The editor renders it in `<iframe sandbox="">`, so the
//      restriction is asserted at both ends.
//   3. **The sanitiser.** `renderEmailPreview` runs the same email allowlist
//      the send path runs, so a script tag never reaches the response at all.
//
// Why not `srcDoc`: a srcDoc frame inherits the admin surface's nonce CSP, and
// the `<style>` blocks HTML mode allows would stop working the day that policy
// is enforced — the preview would silently start lying about what arrives.
//
// **Why a form POST and not fetch.** The editor submits a real `<form
// target="…">` at the frame, so the response becomes the frame's document on
// its own origin. The alternative — fetch the HTML and hand it to the frame as
// a blob URL — would put the preview back on the ADMIN origin, which is the
// one thing this route exists to avoid. POST rather than GET because the body
// is an unsaved draft that can be 200KB.

export async function POST(request: Request): Promise<Response> {
  const input = await readInput(request);

  // An announcement's preview (ADR-171, changes-54 §10.3): the SAVED campaign
  // with its real course variables. Its own key, because the person drafting
  // an announcement need not be able to read every template — and this route,
  // not a second one, because it is the ONE framable admin path.
  if (isAnnouncementPreview(input)) {
    const subject = await requirePermission("announcements.view");
    const announcement = announcementPreviewSchema.safeParse(input);
    if (!announcement.success) {
      return new Response(document("This preview request was not valid."), {
        status: 400,
        headers: previewHeaders(request),
      });
    }
    try {
      // A custom or direct email has no course to render against: its words
      // are its own (ADR-172 #2).
      const rendered =
        (await renderAnnouncementPreview(subject, announcement.data)) ??
        (await renderCustomEmailPreview(subject, announcement.data));
      if (!rendered) {
        return new Response(document("This announcement has nothing to preview yet."), {
          status: 404,
          headers: previewHeaders(request),
        });
      }
      return previewResponse(request, rendered.html);
    } catch (error) {
      return new Response(document(error instanceof Error ? error.message : String(error)), {
        status: 200,
        headers: previewHeaders(request),
      });
    }
  }

  // An email design's preview (ADR-172 #3): the UNSAVED draft on screen, so
  // an author sees what they are typing. Anyone who may read designs may
  // render one; the draft passes the same schema a save does.
  if (isDesignPreview(input)) {
    const subject = await requireAnyPermission([
      "email.templates.view",
      "announcements.create",
      "announcements.direct",
    ]);
    const design = emailDesignSaveSchema.safeParse(input);
    if (!design.success) {
      return new Response(document("This design cannot be previewed until its body is valid."), {
        status: 200,
        headers: previewHeaders(request),
      });
    }
    try {
      const rendered = await renderEmailDesignPreview(subject, { draft: design.data });
      if (!rendered) {
        return new Response(document("This design has nothing to preview yet."), {
          status: 404,
          headers: previewHeaders(request),
        });
      }
      return previewResponse(request, rendered.html);
    } catch (error) {
      return new Response(document(error instanceof Error ? error.message : String(error)), {
        status: 200,
        headers: previewHeaders(request),
      });
    }
  }

  // The boundary, not the proxy's STAFF gate (security.md #3). `.view` rather
  // than `.update`: rendering a preview changes nothing.
  await requirePermission("email.templates.view");

  const parsed = emailPreviewSchema.safeParse(input);
  if (!parsed.success) {
    return new Response(document("This preview request was not valid."), {
      status: 400,
      headers: previewHeaders(request),
    });
  }

  try {
    const rendered = await renderEmailPreview(parsed.data);
    if (!rendered)
      return new Response(document("This template has no content yet."), {
        status: 404,
        headers: previewHeaders(request),
      });
    return previewResponse(request, rendered.html);
  } catch (error) {
    // A render error is the useful answer here: a missing required variable or
    // a non-http URL is exactly what an author needs to be told, and as a 500
    // it would arrive as an empty frame. Status 200 so the frame renders it.
    return new Response(document(error instanceof Error ? error.message : String(error)), {
      status: 200,
      headers: previewHeaders(request),
    });
  }
}

function isAnnouncementPreview(input: unknown): boolean {
  return typeof input === "object" && input !== null && "campaignId" in input;
}

/** The design editor and the direct-email dialog post `preview=design`. */
function isDesignPreview(input: unknown): boolean {
  return (
    typeof input === "object" &&
    input !== null &&
    "preview" in input &&
    (input as { preview: unknown }).preview === "design"
  );
}

/** Form-encoded from the editor's frame target; JSON for anything scripted. */
async function readInput(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return request.json().catch(() => null);
  const form = await request.formData().catch(() => null);
  if (!form) return null;
  return Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string"));
}

function previewResponse(request: Request, html: string): Response {
  return new Response(previewImagesFromViewer(html, siteUrl(), new URL(request.url).origin), {
    status: 200,
    headers: previewHeaders(request),
  });
}

function previewHeaders(request: Request): Headers {
  // The site's OWN origin joins `img-src` (changes-46 #4). The renderer now
  // makes the logo absolute against it, and a sandboxed document has an
  // opaque origin, so `'self'` would match nothing — and on a plain-http
  // install (every dev machine) `https:` does not cover it either, which is
  // how the logo was missing from the preview while a real send had it.
  const origin = new URL(request.url).origin;
  return new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": `sandbox; default-src 'none'; img-src https: data: ${origin}; style-src 'unsafe-inline'`,
    // A staff-scoped render of unsaved content.
    "Cache-Control": "no-store",
    // Framed by the editor on the same origin, and by nothing else. Every
    // other /keystone path stays DENY — see `proxy.ts`.
    "X-Frame-Options": "SAMEORIGIN",
  });
}

/**
 * A message, as a document the sandboxed frame can show.
 *
 * Deliberately unstyled beyond type and spacing: this response has
 * `default-src 'none'` and its own origin, so it cannot read the admin theme's
 * CSS variables, and code-style #1 forbids inventing a colour here. Text on the
 * default ground is the honest answer — the editor shows the failure in its own
 * chrome as well.
 */
function document(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;font:14px/1.6 system-ui,sans-serif"><p style="margin:0">${escaped}</p></body>`;
}
