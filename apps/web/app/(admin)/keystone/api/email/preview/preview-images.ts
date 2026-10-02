/**
 * The renderer makes every site image absolute against `siteOrigin()`, which
 * is right for a SENT message and wrong for the preview frame when the
 * configured origin is not the one the admin is on — a tunnel in `SITE_URL`, a
 * staging host, port 3003 against a `:3000` setting. The logo then 404s or is
 * refused by `img-src`, and the preview shows a broken image the inbox would
 * not. Only `src` moves: the image is the same file either way, while a link's
 * HREF is something the author may be checking, so links stay as sent.
 */
export function viewerOrigin(request: Request): string {
  // The origin the admin's BROWSER is on. `request.url` is not it in
  // production: behind Cloudflare and the reverse proxy it is the server's
  // internal address, so rewriting the logo to it pointed every preview at a
  // host the browser cannot reach — the broken logo on the live templates
  // gallery. The preview is a form POST from the admin page, so the browser
  // sends `Origin`; the forwarded headers cover a client that does not.
  const sent = parseOrigin(request.headers.get("origin"));
  if (sent) return sent;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwarded = host ? parseOrigin(`${proto || "https"}://${host}`) : undefined;
  return forwarded ?? new URL(request.url).origin;
}

function parseOrigin(value: string | null | undefined): string | undefined {
  // `null` is what a sandboxed or privacy-stripped context sends.
  if (!value || value === "null") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function previewImagesFromViewer(html: string, site: string, viewer: string): string {
  if (site === "" || site === viewer) return html;
  const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`(\\ssrc=["'])${escaped}(?=/)`, "gi"), `$1${viewer}`);
}
