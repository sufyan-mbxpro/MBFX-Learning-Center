// The email shell, and the reason it exists: an email client drops class CSS,
// so every rule the editor expressed as a class has to become a `style`
// attribute before the message leaves (ADR-078 #7).
//
// Colours are the ACTIVE theme's values, loaded through
// `loadActiveThemeTokens` — a re-brand reaches email without anyone editing a
// template, and there is no hex literal in this package (code-style #1).
import { deriveTonalInk, type BrandColors, type SurfacePalette } from "@repo/theme";
import { sanitizeEmailHtmlWith } from "./sanitize.ts";

export interface EmailPalette {
  brand: BrandColors;
  surface: SurfacePalette;
  /** A real family list — an email client cannot fetch a web font. */
  fontFamily: string;
}

export interface EmailShellInput {
  bodyHtml: string;
  palette: EmailPalette;
  preheader?: string | undefined;
  logoUrl?: string | undefined;
  siteName: string;
  footerText?: string | undefined;
  postalAddress?: string | undefined;
  /** URL and label together: a package may not invent the word for it. */
  unsubscribe?: { url: string; label: string } | undefined;
}

/** The `ed-*` vocabulary, as inline styles. */
export function editorialStyle(className: string, palette: EmailPalette): string | null {
  const { brand, surface } = palette;
  switch (className) {
    case "ed-tx-primary":
      return `color:${brand.primary}`;
    case "ed-tx-success":
      return `color:${brand.success}`;
    case "ed-tx-warning":
      return `color:${brand.warning}`;
    case "ed-tx-info":
      return `color:${brand.info}`;
    case "ed-tx-danger":
      return `color:${brand.error}`;
    case "ed-tx-muted":
      return `color:${surface.textMuted}`;
    // A highlight needs padding, or the colour stops at the glyphs.
    case "ed-hl-primary":
      return `background-color:${brand.primary};color:${surface.background};padding:0 4px`;
    case "ed-hl-success":
      return `background-color:${brand.success};color:${surface.background};padding:0 4px`;
    case "ed-hl-warning":
      return `background-color:${brand.warning};color:${surface.background};padding:0 4px`;
    case "ed-hl-info":
      return `background-color:${brand.info};color:${surface.background};padding:0 4px`;
    case "ed-hl-danger":
      return `background-color:${brand.error};color:${surface.background};padding:0 4px`;
    case "ed-hl-muted":
      return `background-color:${surface.surfaceMuted};color:${surface.textPrimary};padding:0 4px`;
    // `ed-ff-sans` is the pre-2026-09-18 name of `ed-ff-body`; stored bodies
    // still carry it, so both map to the message's family.
    case "ed-ff-sans":
    case "ed-ff-body":
      return `font-family:${palette.fontFamily}`;
    // The site's display face is a web font no mail client can fetch, so it
    // falls back to the message's own family rather than to Times.
    case "ed-ff-display":
      return `font-family:${palette.fontFamily}`;
    case "ed-ff-serif":
      return "font-family:Georgia,'Times New Roman',serif";
    case "ed-ff-mono":
      return "font-family:Consolas,'Courier New',monospace";
    case "ed-fs-sm":
      return "font-size:14px";
    case "ed-fs-base":
      return "font-size:16px";
    case "ed-fs-lg":
      return "font-size:18px";
    case "ed-fs-xl":
      return "font-size:20px";
    case "ed-fs-2xl":
      return "font-size:24px";
    case "ed-align-start":
      return "text-align:left";
    case "ed-align-center":
      return "text-align:center";
    case "ed-align-end":
      return "text-align:right";
    case "ed-align-justify":
      return "text-align:justify";
    default:
      // `ed-embed` included: a video figure has no meaning in email, and it
      // keeps its markup rather than gaining a style that implies one.
      return null;
  }
}

/**
 * The colour a link is drawn in: the brand primary, darkened until it clears
 * 4.5:1 on the message's ground — exactly the site's `--primary-interactive`
 * (ADR-073). changes-46 #4: with no style of its own an `<a>` fell back to the
 * mail client's default BLUE, a colour the brand does not contain.
 */
export function emailLinkColor(palette: EmailPalette): string {
  return deriveTonalInk(palette.brand.primary, palette.surface.background);
}

/**
 * Fold every `ed-*` class into the element's `style`, and give every link the
 * brand's link ink. Runs the sanitiser again on the way through (defence in
 * depth — ADR-078 #7).
 */
export function inlineEditorialStyles(html: string, palette: EmailPalette): string {
  const linkStyle = `color:${emailLinkColor(palette)};text-decoration:underline`;
  return sanitizeEmailHtmlWith(html, "RICH", {
    "*": (tagName, attribs) => {
      const classes = attribs.class?.split(/\s+/).filter(Boolean) ?? [];
      // A link's colour comes FIRST, so a tone class or the author's own
      // style — both more specific intents — still wins.
      const base = tagName === "a" ? [linkStyle] : [];
      if (classes.length === 0 && base.length === 0) return { tagName, attribs };
      const styles = [
        ...base,
        ...classes
          .map((className) => editorialStyle(className, palette))
          .filter((style): style is string => style !== null),
      ];
      if (styles.length === 0) return { tagName, attribs };
      // An author's own inline style wins: it is the more specific intent,
      // and the class map is the default the editor applied.
      const existing = attribs.style ? [attribs.style.replace(/;\s*$/, "")] : [];
      return { tagName, attribs: { ...attribs, style: [...styles, ...existing].join(";") } };
    },
  });
}

/**
 * A site-relative URL made absolute against the site's origin.
 *
 * changes-46 #4: `email.logo` is stored as the upload path (`/uploads/…`),
 * which is what every picker writes. A relative `src` means nothing in an
 * inbox — there is no page for it to be relative TO — so the logo silently
 * vanished from every sent message and from the preview. Absolute URLs pass
 * through; a protocol-relative one (`//host`) is refused rather than
 * guessed at, and so is anything that is not a path.
 */
export function absoluteUrl(url: string, origin: string): string | undefined {
  const value = url.trim();
  if (value === "") return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/") || value.startsWith("//") || origin === "") return undefined;
  return `${origin.replace(/\/+$/, "")}${value}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * A 600px table on a muted ground — the shape every mail client agrees on.
 * Deliberately not a flex or grid layout: Outlook renders neither.
 *
 * Three surfaces, three roles, and they must not collapse into two: the PAGE
 * behind the message is `surfaceMuted`, the CARD is `background`, and the
 * footer band is `surface`. The footer used to take `surfaceMuted` as well,
 * which made it the same colour as the page — so the message had no visible
 * bottom edge, and the page below it read as one enormous footer. In a theme
 * where `surface` equals `background` the footer is simply the card's own
 * ground under a hairline, which is correct; a theme that tints `surface`
 * gets a tinted band for free, with no hex literal here (code-style #1).
 */
export function renderEmailShell(input: EmailShellInput): string {
  const { palette, siteName } = input;
  const { surface, brand } = palette;

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeText(input.preheader)}</div>`
    : "";

  const logo = input.logoUrl
    ? `<img src="${escapeAttribute(input.logoUrl)}" alt="${escapeAttribute(siteName)}" height="40" style="height:40px;max-width:200px" />`
    : `<span style="font-size:20px;font-weight:700;color:${brand.primary}">${escapeText(siteName)}</span>`;

  const footerLines = [
    input.footerText ? escapeText(input.footerText) : null,
    input.postalAddress ? escapeText(input.postalAddress) : null,
    input.unsubscribe
      ? `<a href="${escapeAttribute(input.unsubscribe.url)}" style="color:${surface.textMuted};text-decoration:underline">${escapeText(input.unsubscribe.label)}</a>`
      : null,
  ].filter((line): line is string => line !== null);

  const footer = footerLines
    .map((line, index) => {
      // The LAST line carries no bottom margin. Every line carrying one put 8px
      // of dead space under the final one, on top of the cell's own padding —
      // which is what made the band look taller than it is.
      const margin = index === footerLines.length - 1 ? "0" : "0 0 8px";
      return `<p style="margin:${margin};font-size:12px;line-height:18px;color:${surface.textMuted}">${line}</p>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:${surface.surfaceMuted};font-family:${palette.fontFamily};color:${surface.textPrimary}">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${surface.surfaceMuted};padding:24px 12px">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:${surface.background};border:1px solid ${surface.borderLight};border-radius:8px">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid ${surface.borderLight}" align="center">${logo}</td>
        </tr>
        <tr>
          <td style="padding:16px 32px;font-size:16px;line-height:24px;color:${surface.textPrimary}">${input.bodyHtml}</td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid ${surface.borderLight};background-color:${surface.surface}">${footer}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
