import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BRAND_FIELD_REGISTRY,
  buildThemeStyleSheet,
  contrastRatio,
  DEFAULT_BRAND,
  DEFAULT_DARK_BRAND_OVERRIDES,
  DEFAULT_DARK_SURFACE,
  DEFAULT_LAYOUT,
  DEFAULT_LIGHT_SURFACE,
  deriveInteractive,
  isCuratedFontKey,
  tokensToCss,
  validateMode,
  validateTheme,
} from "./index.ts";

describe("contrastRatio — known WCAG reference pairs", () => {
  it("#C28D5A on #FFFFFF ≈ 2.9 (the brand primary's documented failure point, plan.md)", () => {
    expect(contrastRatio("#C28D5A", "#FFFFFF")).toBeCloseTo(2.9, 1);
  });

  it("#E8B98C on #FFFFFF ≈ 1.79 (the changes-03 primary ADR-072 replaced)", () => {
    expect(contrastRatio("#E8B98C", "#FFFFFF")).toBeCloseTo(1.79, 1);
  });

  it("black on white is the maximum, 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("a colour against itself is 1:1", () => {
    expect(contrastRatio("#3382E2", "#3382E2")).toBeCloseTo(1, 5);
  });

  it("is order-independent (fg/bg swap gives the same ratio)", () => {
    expect(contrastRatio("#E8B98C", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#E8B98C"), 5);
  });

  it("expands 3-digit hex the same as its 6-digit equivalent", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(contrastRatio("#ffffff", "#000000"), 5);
  });
});

describe("shade (via deriveInteractive, which is the only exported consumer)", () => {
  it("clamps at white/black rather than overflowing on repeated pushes", () => {
    // A near-white colour pushed lighter (dark background) must clamp at
    // #FFFFFF, not wrap or produce an invalid hex.
    const result = deriveInteractive("#FEFEFE", "#000000");
    expect(result).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("deriveInteractive", () => {
  it("returns the color unchanged when it already clears the target ratio", () => {
    expect(deriveInteractive("#000000", "#FFFFFF")).toBe("#000000");
  });

  const brandColors = [
    DEFAULT_BRAND.primary,
    DEFAULT_BRAND.success,
    DEFAULT_BRAND.error,
    DEFAULT_BRAND.warning,
    DEFAULT_BRAND.info,
  ];

  it.each(brandColors)(
    "derives a same-hue-family variant of %s on white that clears 4.5:1",
    (color) => {
      const derived = deriveInteractive(color, "#FFFFFF");
      expect(contrastRatio(derived, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(brandColors)("derives a variant of %s on near-black that clears 4.5:1", (color) => {
    const derived = deriveInteractive(color, "#141413");
    expect(contrastRatio(derived, "#141413")).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to a guaranteed-legible colour when out of headroom", () => {
    // A mid-gray target ratio that no amount of same-hue shading can clear
    // against a background just as mid-gray — forces the fallback path.
    const result = deriveInteractive("#808080", "#7A7A7A", 21);
    expect(["#1A1A1A", "#FFFFFF"]).toContain(result);
  });
});

// Fields covered by the four background/border checks and the button-label
// check — kept in one place so tests can select "the checks that used to
// block" without depending on severity, which no longer discriminates them
// from the link-text advisory (changes-05: everything is "warning" now).
const FLOOR_CHECK_FIELDS = new Set(["textPrimary", "textSecondary", "borderMedium"]);

describe("validateTheme / validateMode — contrast checks are advisory only (changes-05)", () => {
  // Module 02 shipped this test documenting the OPPOSITE: the defaults
  // failed their own validator (canSave false), flagged in the DEVLOG for
  // whoever owns design values rather than silently re-picked by the
  // engine. That bill came due when the theme editor blocked saving the
  // out-of-the-box theme. Two-part resolution, pinned here:
  //  1. ENGINE BUG — dark mode's label candidates were white +
  //     surface.textPrimary (also light in dark mode), so mid-tone fills
  //     like the brand primary "had no legible label" despite a dark ink
  //     reading fine on them. Candidates are now the fixed INK_LIGHT/
  //     INK_DARK pair in both tokensToCss and validateMode.
  //  2. VALUE FIXES — success/error nudged to their own derived remedies
  //     (#2D72C7/#D93A34) and both borderMedium values raised to clear the
  //     3:1 input-border floor. Brand identity (primary/secondary/accent)
  //     untouched.
  // Later still blocked real admin edits to background/surface (the
  // 2026-09-02 addenda below, and changes-05's live reports): a remedy
  // computed for one background stops applying the moment the admin nudges
  // the background again, which read as the editor being broken rather
  // than as guidance. Resolved by making every check advisory — no
  // severity is ever "error" anymore, `canSave` stays true unconditionally,
  // and Save always proceeds. The checks and their remedies are unchanged;
  // only whether they block is different.
  it("the shipped defaults clear their own validation — zero issues from the floor checks, canSave true", () => {
    const { issues, canSave } = validateTheme(
      DEFAULT_BRAND,
      DEFAULT_LIGHT_SURFACE,
      DEFAULT_DARK_SURFACE,
      DEFAULT_DARK_BRAND_OVERRIDES,
    );
    expect(issues.filter((i) => FLOOR_CHECK_FIELDS.has(i.field))).toEqual([]);
    expect(canSave).toBe(true);
  });

  it("flags body text on background as advisory when contrast fails, and does not block save", () => {
    const badSurface = { ...DEFAULT_LIGHT_SURFACE, textPrimary: "#F5F5F5" }; // near-white on white
    const issues = validateMode(DEFAULT_BRAND, badSurface, "light");
    const issue = issues.find(
      (i) => i.field === "textPrimary" && i.label.includes("Body text on background"),
    );
    expect(issue?.severity).toBe("warning");
  });

  it("canSave stays true even when a mode has a contrast-failing surface — advisory only, save is never refused", () => {
    const badSurface = { ...DEFAULT_LIGHT_SURFACE, textPrimary: "#F5F5F5" };
    const { canSave } = validateTheme(
      DEFAULT_BRAND,
      badSurface,
      DEFAULT_DARK_SURFACE,
      DEFAULT_DARK_BRAND_OVERRIDES,
    );
    expect(canSave).toBe(true);
  });

  it("a raw swatch failing as link text is advisory, since a derived variant exists", () => {
    // DEFAULT_BRAND.primary (#C28D5A) is the documented ~2.9:1 case.
    const issues = validateMode(DEFAULT_BRAND, DEFAULT_LIGHT_SURFACE, "light");
    const advisory = issues.find((i) => i.field === "primary" && i.label.includes("link text"));
    expect(advisory?.severity).toBe("warning");
    expect(advisory?.remedy).toMatch(/#/);
  });

  it("dark-mode overrides are applied before validation, not after — an override that fixes a button-label failure prevents the issue", () => {
    // Deliberately constructed, not the shipped defaults: DEFAULT_DARK_BRAND_
    // OVERRIDES only touches accent/secondary, and neither is in the `fills`
    // list validateMode checks for button-label/link-text issues (only
    // primary/success/error/warning/info are) — so the shipped override
    // can't demonstrate this path at all. A TRUE mid-tone "warning" swatch
    // (#7F7F7F — fails against BOTH label inks) is repaired by a darker
    // per-mode override.
    const brand = { ...DEFAULT_BRAND, warning: "#7F7F7F" };
    const withoutOverride = validateMode(brand, DEFAULT_DARK_SURFACE, "dark");
    const withOverride = validateMode(brand, DEFAULT_DARK_SURFACE, "dark", { warning: "#8A6D2F" });
    const failsWithout = withoutOverride.some(
      (i) => i.field === "warning" && i.label.includes("button label"),
    );
    const failsWith = withOverride.some(
      (i) => i.field === "warning" && i.label.includes("button label"),
    );
    expect(failsWithout).toBe(true);
    expect(failsWith).toBe(false);
  });

  it("an input-border failure carries a concrete remedy value — editing the light background alone (not the border) is the reported way admins trip this floor, and unlike button-label/link-text the renderer has no derived stand-in to fall back on, so the admin needs a value to type in", () => {
    // The shipped borderMedium (#7F8FA5 since ADR-072) clears 3:1 on white
    // but not on this slightly darker, still-plausible light background
    // (~2.7:1 — the shape of the reported case) — the border swatch itself
    // is untouched.
    const editedSurface = { ...DEFAULT_LIGHT_SURFACE, background: "#E8E8E8" };
    const issues = validateMode(DEFAULT_BRAND, editedSurface, "light");
    const issue = issues.find((i) => i.field === "borderMedium");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warning");
    expect(issue?.remedy).toMatch(/^Try #[0-9A-F]{6} instead/);

    const suggested = issue!.remedy!.match(/#[0-9A-F]{6}/)![0];
    expect(contrastRatio(suggested, editedSurface.background)).toBeGreaterThanOrEqual(3.0);
  });

  it("every floor check gets its own remedy, not just the border one — the exact follow-on report: the same #E0CCCC background edit also fails 'Secondary text on background', which shipped with no remedy at all the first time this was fixed", () => {
    const editedSurface = { ...DEFAULT_LIGHT_SURFACE, background: "#E0CCCC" };
    const issues = validateMode(DEFAULT_BRAND, editedSurface, "light");
    const floorIssues = issues.filter((i) => FLOOR_CHECK_FIELDS.has(i.field));

    // Reproduces the screenshot: both the border AND secondary-text floors
    // fail on this background — as advisory, not blocking.
    expect(floorIssues.some((i) => i.field === "borderMedium")).toBe(true);
    expect(floorIssues.some((i) => i.field === "textSecondary")).toBe(true);
    expect(floorIssues.every((i) => i.severity === "warning")).toBe(true);

    for (const issue of floorIssues) {
      expect(issue.remedy).toMatch(/^Try #[0-9A-F]{6} instead — clears [\d.]+:1 here\.$/);
      const suggested = issue.remedy!.match(/#[0-9A-F]{6}/)![0];
      // "Body text on muted surface" is the one floor check whose
      // background is surfaceMuted, not the edited background itself.
      const background = issue.label.includes("muted surface")
        ? editedSurface.surfaceMuted
        : editedSurface.background;
      expect(contrastRatio(suggested, background)).toBeGreaterThanOrEqual(issue.required);
    }
  });

  it("no palette can ever set canSave to false — the property this whole file used to guard is now unconditional", () => {
    // The single worst case: illegible-on-everything text on a background
    // it's identical to, which would have failed every "error" check pre-
    // changes-05. canSave still comes back true; the issues are still
    // reported (checked below), just never block.
    const illegible = { ...DEFAULT_LIGHT_SURFACE, background: "#808080", textPrimary: "#808080" };
    const { issues, canSave } = validateTheme(
      DEFAULT_BRAND,
      illegible,
      DEFAULT_DARK_SURFACE,
      DEFAULT_DARK_BRAND_OVERRIDES,
    );
    expect(canSave).toBe(true);
    expect(issues.some((i) => i.field === "textPrimary")).toBe(true);
  });
});

describe("property-based contract (fast-check): every deriveInteractive-backed value meets its WCAG floor", () => {
  // Scoped to the *-interactive vars and --ring, not the plain *-foreground
  // vars. Found empirically, not assumed: *-foreground is readableOn-based
  // (picks the better of white/near-black, no guarantee either clears the
  // target — a medium-luminance fill like #8165ce can fail both). Only
  // deriveInteractive carries an engineered guarantee (push-until-passing,
  // then a fallback chosen specifically to clear almost any real
  // background) — *-interactive and --ring are the values actually built
  // from it, so they're the ones this contract can honestly claim to hold.
  const hexColor = fc
    .integer({ min: 0, max: 0xffffff })
    .map((n) => `#${n.toString(16).padStart(6, "0")}`);
  const brandArb = fc.record({
    primary: hexColor,
    secondary: hexColor,
    success: hexColor,
    error: hexColor,
    warning: hexColor,
    info: hexColor,
    accent: hexColor,
  });

  it("random palettes always produce *-interactive values ≥ 4.5:1 and a ring ≥ 3:1 against the surface background", () => {
    fc.assert(
      fc.property(brandArb, (brand) => {
        const css = tokensToCss({ brand, surface: DEFAULT_LIGHT_SURFACE, layout: DEFAULT_LAYOUT });
        const vars = Object.fromEntries(
          [...css.matchAll(/(--[a-z-]+):([^;]+);/g)].map((m) => [m[1], m[2]]),
        );
        const bg = DEFAULT_LIGHT_SURFACE.background;

        for (const base of ["primary", "success", "destructive", "warning", "info"]) {
          const interactive = vars[`--${base}-interactive`];
          if (interactive)
            expect(contrastRatio(interactive, bg)).toBeGreaterThanOrEqual(4.5 - 0.01);
        }

        expect(contrastRatio(vars["--ring"]!, bg)).toBeGreaterThanOrEqual(3 - 0.01);
      }),
      { numRuns: 200 },
    );
  });
});

describe("buildThemeStyleSheet — CSS snapshot", () => {
  it("emits full hex values (no rgbChannels triples) and --brand-font-* naming (A5.2/A5.3)", () => {
    const css = buildThemeStyleSheet({
      key: "default",
      lightCss: tokensToCss({
        brand: DEFAULT_BRAND,
        surface: DEFAULT_LIGHT_SURFACE,
        layout: DEFAULT_LAYOUT,
      }),
      darkCss: tokensToCss({
        brand: DEFAULT_BRAND,
        surface: DEFAULT_DARK_SURFACE,
        layout: DEFAULT_LAYOUT,
        overrides: DEFAULT_DARK_BRAND_OVERRIDES,
      }),
      layout: DEFAULT_LAYOUT,
    });

    expect(css).toContain("--background:#FFFFFF;");
    expect(css).not.toMatch(/--background:\d+ \d+ \d+;/); // no rgbChannels triple
    expect(css).toContain("--brand-font-sans:");
    expect(css).toContain("--brand-font-mono:");
    expect(css).toContain("--brand-base-font-size:16px;");
    expect(css).not.toContain("--font-sans:var(--font-sans)"); // no circular self-reference
    expect(css).toMatchSnapshot();
  });

  it("falls back to the system stack for a font key that isn't in the curated registry", () => {
    // buildThemeStyleSheet is a public function — it can receive a
    // ResolvedTheme whose layout didn't go through loadActiveTheme's own
    // defensive default (e.g. a removed curated font, ADR-005's noted
    // consequence), so it needs its own fallback too.
    const css = buildThemeStyleSheet({
      key: "default",
      lightCss: "",
      darkCss: "",
      layout: { ...DEFAULT_LAYOUT, fontSans: "no-longer-curated" as never },
    });
    expect(css).toContain(`--brand-font-sans:-apple-system`);
  });
});

describe("curated fonts (ADR-005)", () => {
  it("system and systemmono are valid keys with no file dependency", () => {
    expect(isCuratedFontKey("system")).toBe(true);
    expect(isCuratedFontKey("systemmono")).toBe(true);
  });

  // ADR-072 (superseding ADR-039). The default is a real curated key, so
  // @repo/ui owes it a --font-{key} family; asserting the emitted var()
  // (rather than just the key) is what would catch a default silently
  // reverting to a literal stack — the failure mode that would make "Inter
  // everywhere" a no-op.
  it("Inter is the default sans and emits a var(--font-inter) reference", () => {
    expect(DEFAULT_LAYOUT.fontSans).toBe("inter");
    expect(isCuratedFontKey("inter")).toBe(true);
    const css = buildThemeStyleSheet({
      key: "default",
      lightCss: "",
      darkCss: "",
      layout: DEFAULT_LAYOUT,
    });
    expect(css).toContain("--brand-font-sans:var(--font-inter);");
  });

  it("Outfit stays selectable after ADR-072 — superseding a default deletes no admin choice", () => {
    expect(isCuratedFontKey("outfit")).toBe(true);
  });

  it("rejects an arbitrary/unregistered font key", () => {
    expect(isCuratedFontKey("comic-sans-from-a-random-url")).toBe(false);
  });
});

describe("BRAND_FIELD_REGISTRY", () => {
  it("has no hover/active entries (ADR-003: those are always derived, never editable)", () => {
    const keys = BRAND_FIELD_REGISTRY.map((f) => f.key);
    expect(keys).not.toContain("primaryHover");
    expect(keys).not.toContain("primaryActive");
    expect(keys.sort()).toEqual(
      ["accent", "error", "info", "primary", "secondary", "success", "warning"].sort(),
    );
  });
});

/** Parses tokensToCss's `--x:v;` output into a lookup. */
function cssVars(css: string): Record<string, string> {
  return Object.fromEntries([...css.matchAll(/(--[a-z-]+):([^;]+);/g)].map((m) => [m[1], m[2]]));
}
const lightVars = cssVars(
  tokensToCss({ brand: DEFAULT_BRAND, surface: DEFAULT_LIGHT_SURFACE, layout: DEFAULT_LAYOUT }),
);
const darkVars = cssVars(
  tokensToCss({
    brand: DEFAULT_BRAND,
    surface: DEFAULT_DARK_SURFACE,
    layout: DEFAULT_LAYOUT,
    overrides: DEFAULT_DARK_BRAND_OVERRIDES,
  }),
);

// ADR-072 (changes-20): the reference's bronze primary, adopted under the
// rule that accessibility overrides visual copying. These pin the values the
// engine actually emits and the reasons behind them — and, via ADR-018 rule
// 5, why raw --primary is still never used for thin or small elements.
describe("ADR-072 — brand primary #C28D5A and its derived states", () => {
  it("derives #936B44 as link text on white, and uses the raw swatch on dark", () => {
    expect(DEFAULT_BRAND.primary).toBe("#C28D5A");
    expect(deriveInteractive(DEFAULT_BRAND.primary, DEFAULT_LIGHT_SURFACE.background)).toBe(
      "#936b44",
    );
    // On the dark surface the raw swatch already clears 4.5:1, so the
    // engine returns it untouched — the brand colour IS the link colour there.
    expect(deriveInteractive(DEFAULT_BRAND.primary, DEFAULT_DARK_SURFACE.background)).toBe(
      "#C28D5A",
    );
  });

  it("labels bronze fills with DARK ink at ~6.0:1 — never the reference's white at 2.77:1", () => {
    expect(lightVars["--primary-foreground"]).toBe("#1A1A1A");
    expect(darkVars["--primary-foreground"]).toBe("#1A1A1A");
    expect(contrastRatio(DEFAULT_BRAND.primary, "#1A1A1A")).toBeCloseTo(6.01, 1);
    expect(contrastRatio(DEFAULT_BRAND.primary, "#FFFFFF")).toBeLessThan(4.5);
  });

  it("labels the warning fill with dark ink too — the reference's white is 1.91:1", () => {
    expect(lightVars["--warning-foreground"]).toBe("#1A1A1A");
    expect(contrastRatio(DEFAULT_BRAND.warning, "#1A1A1A")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps white labels legible on success and error (the reason they are not the reference's hex)", () => {
    expect(lightVars["--success-foreground"]).toBe("#FFFFFF");
    expect(lightVars["--destructive-foreground"]).toBe("#FFFFFF");
    expect(contrastRatio(DEFAULT_BRAND.success, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DEFAULT_BRAND.error, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("raw --primary clears NEITHER text nor non-text floors on a light surface — ADR-018 rule 5's reason", () => {
    // 2.9:1 is below 4.5:1 (text) AND below 3:1 (non-text UI). A 1px bronze
    // border or small icon glyph in raw --primary on white fails, and
    // validateMode only flags the TEXT case — so the rule ("fills and large
    // shapes only") is structural, not linted.
    const ratio = contrastRatio(DEFAULT_BRAND.primary, DEFAULT_LIGHT_SURFACE.background);
    expect(ratio).toBeLessThan(3.0);
    expect(ratio).toBeCloseTo(2.9, 1);
  });

  it("the palette introduces no BLOCKING validation issue — only the link-text advisory", () => {
    const { issues, canSave } = validateTheme(
      DEFAULT_BRAND,
      DEFAULT_LIGHT_SURFACE,
      DEFAULT_DARK_SURFACE,
      DEFAULT_DARK_BRAND_OVERRIDES,
    );
    expect(canSave).toBe(true);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    const advisory = issues.find((i) => i.field === "primary" && i.label.includes("link text"));
    expect(advisory?.severity).toBe("warning");
    expect(advisory?.remedy).toContain("#936B44");
  });
});

describe("ADR-072 — focus ring and input border", () => {
  it("derives --ring from the PRIMARY (bronze), at the 3:1 non-text floor, in both modes", () => {
    expect(lightVars["--ring"]).toBe(deriveInteractive(DEFAULT_BRAND.primary, "#FFFFFF", 3.0));
    expect(darkVars["--ring"]).toBe(
      deriveInteractive(DEFAULT_BRAND.primary, DEFAULT_DARK_SURFACE.background, 3.0),
    );
    expect(
      contrastRatio(lightVars["--ring"]!, DEFAULT_LIGHT_SURFACE.background),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(darkVars["--ring"]!, DEFAULT_DARK_SURFACE.background),
    ).toBeGreaterThanOrEqual(3);
  });

  it("a different primary moves the ring — it follows the admin's brand, not a constant", () => {
    const vars = cssVars(
      tokensToCss({
        brand: { ...DEFAULT_BRAND, primary: "#1D4ED8" },
        surface: DEFAULT_LIGHT_SURFACE,
        layout: DEFAULT_LAYOUT,
      }),
    );
    expect(vars["--ring"]).toBe("#1D4ED8");
  });

  it("the light input border clears 3:1 on BOTH the background and the muted surface", () => {
    const { borderMedium, background, surfaceMuted } = DEFAULT_LIGHT_SURFACE;
    expect(contrastRatio(borderMedium, background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(borderMedium, surfaceMuted)).toBeGreaterThanOrEqual(3);
  });

  it("the dark input border clears 3:1 on the dark background", () => {
    const { borderMedium, background } = DEFAULT_DARK_SURFACE;
    expect(contrastRatio(borderMedium, background)).toBeGreaterThanOrEqual(3);
  });
});
