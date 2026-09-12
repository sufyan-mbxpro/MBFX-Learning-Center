// The email shell, and the reason it exists: an email client drops class CSS,
// so every rule the editor expressed as a class has to become a `style`
// attribute before the message leaves (ADR-078 #7).
//
// Colours are the ACTIVE theme's values, loaded through
// `loadActiveThemeTokens` — a re-brand reaches email without anyone editing a
// template, and there is no hex literal in this package (code-style #1).
import type { BrandColors, SurfacePalette } from "@repo/theme";
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
    case "ed-ff-sans":
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
 * Fold every `ed-*` class into the element's `style`. Runs the sanitiser
 * again on the way through (defence in depth — ADR-078 #7).
 */
export function inlineEditorialStyles(html: string, palette: EmailPalette): string {
  return sanitizeEmailHtmlWith(html, "RICH", {
    "*": (tagName, attribs) => {
      const classes = attribs.class?.split(/\s+/).filter(Boolean) ?? [];
      if (classes.length === 0) return { tagName, attribs };
      const styles = classes
        .map((className) => editorialStyle(className, palette))
        .filter((style): style is string => style !== null);
      if (styles.length === 0) return { tagName, attribs };
      // An author's own inline style wins: it is the more specific intent,
      // and the class map is the default the editor applied.
      const existing = attribs.style ? [attribs.style.replace(/;\s*$/, "")] : [];
      return { tagName, attribs: { ...attribs, style: [...styles, ...existing].join(";") } };
    },
  });
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
    .map(
      (line) =>
        `<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:${surface.textMuted}">${line}</p>`,
    )
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
          <td style="padding:32px;font-size:16px;line-height:24px;color:${surface.textPrimary}">${input.bodyHtml}</td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid ${surface.borderLight};background-color:${surface.surfaceMuted}">${footer}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
