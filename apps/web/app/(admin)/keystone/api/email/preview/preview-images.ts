/**
 * The renderer makes every site image absolute against `siteOrigin()`, which
 * is right for a SENT message and wrong for the preview frame when the
 * configured origin is not the one the admin is on — a tunnel in `SITE_URL`, a
 * staging host, port 3003 against a `:3000` setting. The logo then 404s or is
 * refused by `img-src`, and the preview shows a broken image the inbox would
 * not. Only `src` moves: the image is the same file either way, while a link's
 * HREF is something the author may be checking, so links stay as sent.
 */
export function previewImagesFromViewer(html: string, site: string, viewer: string): string {
  if (site === "" || site === viewer) return html;
  const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`(\\ssrc=["'])${escaped}(?=/)`, "gi"), `$1${viewer}`);
}
