// Class CSS does not survive an email client, so every `ed-*` rule has to
// arrive as an inline style. What breaks here breaks silently: the message
// still renders, just unstyled and off-brand.
import { describe, expect, it } from "vitest";
import { EDITORIAL_CLASSES } from "@repo/contracts";
import { DEFAULT_BRAND, DEFAULT_LIGHT_SURFACE, deriveTonalInk } from "@repo/theme";
import {
  absoluteUrl,
  editorialStyle,
  emailLinkColor,
  inlineEditorialStyles,
  renderEmailShell,
} from "./layout.ts";
import type { EmailPalette } from "./layout.ts";

const palette: EmailPalette = {
  brand: DEFAULT_BRAND,
  surface: DEFAULT_LIGHT_SURFACE,
  fontFamily: "Inter, Arial, sans-serif",
};

describe("editorialStyle", () => {
  it("covers every class the editor can emit, except the video figure", () => {
    // `ed-embed` is deliberately unmapped: a video has no meaning in email,
    // so it keeps its markup rather than gaining a style that implies one.
    const unmapped = EDITORIAL_CLASSES.filter((name) => editorialStyle(name, palette) === null);
    expect(unmapped).toEqual(["ed-embed"]);
  });

  it("takes its colours from the palette, not from a literal", () => {
    expect(editorialStyle("ed-tx-primary", palette)).toBe(`color:${DEFAULT_BRAND.primary}`);
    expect(editorialStyle("ed-tx-muted", palette)).toBe(`color:${DEFAULT_LIGHT_SURFACE.textMuted}`);
  });

  it("gives a highlight padding, or the colour stops at the glyphs", () => {
    expect(editorialStyle("ed-hl-warning", palette)).toContain("padding:");
  });

  it("ignores a class it does not know", () => {
    expect(editorialStyle("ed-not-a-thing", palette)).toBeNull();
  });
});

describe("inlineEditorialStyles", () => {
  it("folds a class into a style attribute", () => {
    const output = inlineEditorialStyles(`<p class="ed-tx-primary">hi</p>`, palette);
    expect(output).toContain(`style="color:${DEFAULT_BRAND.primary}"`);
  });

  it("folds several classes at once", () => {
    const output = inlineEditorialStyles(`<p class="ed-align-center ed-fs-lg">hi</p>`, palette);
    expect(output).toContain("text-align:center");
    expect(output).toContain("font-size:18px");
  });

  it("lets the author's own inline style win", () => {
    const output = inlineEditorialStyles(
      `<p class="ed-fs-lg" style="font-size:11px">hi</p>`,
      palette,
    );
    // Both are present, the author's last — the later declaration wins in CSS.
    expect(output.indexOf("font-size:18px")).toBeLessThan(output.indexOf("font-size:11px"));
  });

  it("leaves an element with no editorial class untouched", () => {
    expect(inlineEditorialStyles(`<p>hi</p>`, palette)).toBe("<p>hi</p>");
  });

  it("draws a link in the brand's link ink, never the client's default blue", () => {
    const output = inlineEditorialStyles(`<p><a href="https://x.test">go</a></p>`, palette);
    expect(output).toContain(`color:${emailLinkColor(palette)}`);
    expect(emailLinkColor(palette)).toBe(
      deriveTonalInk(DEFAULT_BRAND.primary, DEFAULT_LIGHT_SURFACE.background),
    );
  });

  it("lets a tone class on a link override the link ink", () => {
    const output = inlineEditorialStyles(
      `<a class="ed-tx-danger" href="https://x.test">go</a>`,
      palette,
    );
    expect(output.indexOf(emailLinkColor(palette))).toBeLessThan(
      output.indexOf(DEFAULT_BRAND.error),
    );
  });

  it("still sanitises on the way through", () => {
    const output = inlineEditorialStyles(
      `<p class="ed-tx-info">hi</p><script>x()</script>`,
      palette,
    );
    expect(output).not.toContain("<script");
  });
});

describe("renderEmailShell", () => {
  const base = { bodyHtml: "<p>hi</p>", palette, siteName: "MBX Learning Center" };

  it("is a table layout, because Outlook renders neither flex nor grid", () => {
    const html = renderEmailShell(base);
    expect(html).toContain("<table");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display:grid");
    expect(html).toContain("width:600px");
  });

  it("shows the logo when there is one, and the name when there is not", () => {
    expect(renderEmailShell({ ...base, logoUrl: "https://example.com/logo.png" })).toContain(
      '<img src="https://example.com/logo.png"',
    );
    expect(renderEmailShell(base)).toContain("MBX Learning Center");
  });

  it("escapes what it is given", () => {
    const html = renderEmailShell({ ...base, siteName: `<script>alert(1)</script>` });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an unsubscribe line only when given one, with its own label", () => {
    expect(renderEmailShell(base)).not.toContain("unsubscribe");
    const html = renderEmailShell({
      ...base,
      unsubscribe: { url: "https://example.com/u?token=x", label: "Unsubscribe" },
    });
    expect(html).toContain("https://example.com/u?token=x");
    expect(html).toContain("Unsubscribe");
  });

  it("takes its ground and ink from the palette", () => {
    const html = renderEmailShell(base);
    expect(html).toContain(DEFAULT_LIGHT_SURFACE.background);
    expect(html).toContain(DEFAULT_LIGHT_SURFACE.textPrimary);
  });

  it("does not paint the footer band in the PAGE's ground", () => {
    // The page and the footer were both `surfaceMuted`, so the message had no
    // visible bottom edge and the ground below it read as part of the footer.
    // Asserted on a palette whose three surfaces differ, because the seeded
    // themes happen to give `surface` and `background` the same value — the
    // bug is invisible on those and the rule is not.
    // Sentinels rather than colours: the shell interpolates whatever the token
    // holds, so this asserts WHICH token the band reads — which is the rule —
    // and keeps code-style #1's no-hex-literal rule intact in a test.
    const distinct = {
      ...palette,
      surface: {
        ...DEFAULT_LIGHT_SURFACE,
        surface: "token-card-footer",
        surfaceMuted: "token-page-ground",
      },
    };
    const html = renderEmailShell({ ...base, palette: distinct });
    const footerCell = html.slice(html.indexOf("border-top:1px solid"));
    expect(footerCell).toContain("background-color:token-card-footer");
    expect(footerCell).not.toContain("background-color:token-page-ground");
  });

  it("leaves no trailing margin under the last footer line", () => {
    const html = renderEmailShell({
      ...base,
      footerText: "Because you have an account.",
      postalAddress: "1 Example Street",
    });
    const lines = [...html.matchAll(/<p style="margin:([^;]+);font-size:12px/g)].map((m) => m[1]);
    expect(lines).toEqual(["0 0 8px", "0"]);
  });
});

describe("absoluteUrl", () => {
  it("makes an upload path absolute against the site origin", () => {
    expect(absoluteUrl("/uploads/logo.png", "http://localhost:3000/")).toBe(
      "http://localhost:3000/uploads/logo.png",
    );
  });

  it("passes an absolute http(s) URL through", () => {
    expect(absoluteUrl("https://cdn.example.com/l.png", "https://site.test")).toBe(
      "https://cdn.example.com/l.png",
    );
  });

  it("refuses what it cannot resolve safely", () => {
    expect(absoluteUrl("", "https://site.test")).toBeUndefined();
    expect(absoluteUrl("//evil.example/l.png", "https://site.test")).toBeUndefined();
    expect(absoluteUrl("javascript:alert(1)", "https://site.test")).toBeUndefined();
    expect(absoluteUrl("/uploads/l.png", "")).toBeUndefined();
  });
});
