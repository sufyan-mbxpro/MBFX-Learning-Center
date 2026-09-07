import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  SOCIAL_GLYPH_NAMES,
  SocialGlyph,
  isSocialGlyphName,
  resolveSocialGlyph,
} from "./social-glyph.tsx";

describe("resolveSocialGlyph", () => {
  it("resolves every platform the seed ships", () => {
    for (const platform of ["instagram", "facebook", "youtube", "linkedin", "x"]) {
      expect(resolveSocialGlyph(platform)).toBe(platform);
    }
  });

  it("maps the seed's legacy `twitter` icon value onto X", () => {
    expect(resolveSocialGlyph("twitter")).toBe("x");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(resolveSocialGlyph("  YouTube ")).toBe("youtube");
  });

  it("falls back to the link mark instead of rendering nothing", () => {
    // The regression this whole component exists for: an unresolvable icon
    // name used to produce an EMPTY circle in the footer.
    expect(resolveSocialGlyph("mastodon")).toBe("link");
    expect(resolveSocialGlyph(null)).toBe("link");
    expect(resolveSocialGlyph("")).toBe("link");
  });
});

describe("isSocialGlyphName", () => {
  it("agrees with the exported name list", () => {
    for (const name of SOCIAL_GLYPH_NAMES) expect(isSocialGlyphName(name)).toBe(true);
    expect(isSocialGlyphName("mastodon")).toBe(false);
  });
});

describe("SocialGlyph", () => {
  it("always draws something, for every name and for an unknown one", () => {
    for (const name of [...SOCIAL_GLYPH_NAMES, "mastodon", "", null]) {
      const { container, unmount } = render(<SocialGlyph name={name} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.childElementCount ?? 0).toBeGreaterThan(0);
      unmount();
    }
  });

  it("inherits colour and is hidden from assistive tech (the label is on the link)", () => {
    const { container } = render(<SocialGlyph name="facebook" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
