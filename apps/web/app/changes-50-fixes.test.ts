// changes-50 — the owner's fix list, as guards (the `changes-48-fixes` shape).
//
// Each block names the complaint it answers, because a guard whose reason is
// lost is a guard the next person deletes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SETTING_GROUPS } from "@repo/contracts";
import en from "@repo/i18n/messages/en.json" with { type: "json" };

import { SETTINGS_GROUP_TABS } from "./(admin)/keystone/settings/_components/settings-shared.ts";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const ADMIN = "app/(admin)/keystone/";
const PUBLIC = "app/(public)/[locale]/";

// ─── #1 "all the extra input details will be under the inputs" ───────────

describe("a setting's badge and description sit under its input", () => {
  const src = read(ADMIN + "settings/settings-group-form.tsx");

  it("draws the label alone, then the control, then the details", () => {
    const row = src.slice(src.lastIndexOf("<FieldLabel>{setting.label}</FieldLabel>"));
    const control = row.indexOf("{renderControl(setting)}");
    const description = row.indexOf("<FieldDescription>");
    const badges = row.indexOf("{badges(setting)}");
    expect(control).toBeGreaterThan(0);
    expect(description).toBeGreaterThan(control);
    expect(badges).toBeGreaterThan(description);
  });

  it("no longer puts the badges on the label's row", () => {
    expect(src).not.toMatch(/<FieldLabel>\{setting\.label\}<\/FieldLabel>\s*\{badges\(setting\)\}/);
    expect(src).not.toMatch(/<FieldTitle[^>]*>\{setting\.label\}<\/FieldTitle>\s*\{badges/);
  });
});

// ─── #2 "maintain the right side settings with all tabs" ────────────────

describe("the course editor's settings rail sits beside every tab", () => {
  const src = read(ADMIN + "learn/courses/[id]/course-editor.tsx");

  it("renders the rail once, after the last tab panel rather than inside Details", () => {
    const aside = src.indexOf("<aside");
    expect(aside).toBeGreaterThan(src.lastIndexOf("</TabsContent>"));
    expect(src.indexOf("<ContentStatusPanel")).toBeGreaterThan(aside);
  });

  it("puts the SEO analysis under the SEO fields, in the SEO tab", () => {
    const seoTab = src.slice(src.indexOf('<TabsContent value="seo">'));
    expect(seoTab.indexOf("<SeoAnalysis")).toBeGreaterThan(seoTab.indexOf("<EditorSection"));
    expect(seoTab.indexOf("<SeoAnalysis")).toBeLessThan(seoTab.indexOf("</TabsContent>"));
  });
});

// ─── #3 "why remove the join/sign in section … please revert back" ──────
//
// It was never removed: an admin browsing the site is a STAFF session, which
// the public header shows as signed out (ADR-094) while the progress endpoint
// answered it with real progress, so every guest prompt stayed hidden.

describe("a reader the public site shows as signed out gets the guest prompts", () => {
  it("the progress provider reports `guest` for an anonymous-reading session", () => {
    const src = read(PUBLIC + "learn/_components/progress-provider.tsx");
    expect(src).toContain("usePublicSession");
    expect(src).toMatch(
      /session\.status === "anonymous" && \(status === "ready" \|\| status === "guest"\)/,
    );
  });

  it("the quiz listing's prompt does the same, and still stays away when the feature is off", () => {
    const src = read(PUBLIC + "learn/_components/quiz-sign-in-prompt.tsx");
    expect(src).toContain("usePublicSession");
    expect(src).toContain("response.status !== 404");
  });

  // 2026-09-22: the owner removed the sidebar "Save your progress" card; the
  // band above the curriculum is the course page's one guest prompt.
  it("the course page mounts the band and no longer the sidebar card", () => {
    const src = read(PUBLIC + "learn/[track]/[course]/page.tsx");
    expect(src).not.toContain("ProgressSignInCard");
    expect(src).toContain("<TrackProgressBand");
  });
});

// ─── #4 "this row should have the same background … as the footer top strip"

describe("the footer's subscribe strip is the visitor band's flat surface", () => {
  it("is a full-width bg-secondary band outside the footer's Container", () => {
    const src = read(PUBLIC + "_components/footer.tsx");
    // The footer's Container closes right before the band, and the band opens
    // its own, so the flat strip spans the footer edge to edge.
    expect(src).toMatch(/<\/Container>\s*\{\/\* ── Band 2: the subscribe banner/);
    const strip = src.slice(src.indexOf("Band 2: the subscribe banner"), src.indexOf("Band 3"));
    expect(strip).toContain("bg-secondary text-secondary-foreground");
    expect(strip).toContain('<Container className="py-6">');
  });
});

// ─── #5 "the video section will appear before body" ─────────────────────

describe("the video topic editor draws the videos before the body", () => {
  it("VideosPanel precedes the body editor, as the public page does", () => {
    const src = read(ADMIN + "learn/videos/[id]/video-editor.tsx");
    expect(src.indexOf("<VideosPanel")).toBeGreaterThan(0);
    expect(src.indexOf("<VideosPanel")).toBeLessThan(src.indexOf("<RichTextEditor"));
  });
});

// ─── #6 presets, suggestions, white ground ──────────────────────────────

describe("the theme editor", () => {
  const src = read(ADMIN + "theme/theme-editor.tsx");
  const page = read(ADMIN + "theme/page.tsx");

  it("asks for the presets of THIS surface, so the live one is marked", () => {
    expect(page).toContain("loadThemePresets(surface)");
  });

  it("is keyed by the palette, so activating a preset reloads every tab", () => {
    expect(page).toMatch(/key=\{`\$\{tokens\.themeKey\}:\$\{JSON\.stringify\(/);
  });

  it("marks the live preset with a ring and says which it is", () => {
    expect(src).toContain('preset.isActive && "border-primary bg-primary/5 ring-2 ring-primary"');
    expect(src).toContain('te("presetActiveNow"');
    expect(en.admin.themeEditor.presetCustom).toBeTruthy();
  });

  it("shows each suggestion as a collapsible ticket", () => {
    expect(src).toContain("<AccordionItem");
    expect(src).not.toContain("<Alert ");
  });

  it("no longer carries the logos (they are General → Branding)", () => {
    expect(src).not.toContain('value="logos"');
    expect(src).not.toContain("setBrandAssetAction");
  });
});

// ─── #7 "the general settings page should be show in tabs … branding" ───

describe("General is tabbed, and Branding is one of its tabs", () => {
  const general = SETTINGS_GROUP_TABS.general ?? [];

  it("places every general key on exactly one tab", () => {
    const keys = Object.entries(SETTING_GROUPS)
      .filter(([, group]) => group === "general")
      .map(([key]) => key);
    for (const key of keys) {
      expect(
        general.filter((tab) => tab.keys.includes(key)),
        key,
      ).toHaveLength(1);
    }
  });

  it("names every tab in the catalog", () => {
    const labels = en.admin.settingsTabs as Record<string, string>;
    for (const tab of general) expect(labels[tab.id], tab.id).toBeTruthy();
  });

  it("renders the logos there, behind the key their actions check", () => {
    const page = read(ADMIN + "settings/[group]/page.tsx");
    expect(page).toContain("<BrandAssetsForm");
    expect(page).toContain('can(subject, "theme.update")');
  });
});

// ─── #8 "what is use of social media & advance tab" ─────────────────────

describe("the article SEO panel", () => {
  const src = read(ADMIN + "articles/[id]/article-editor.tsx");

  it("drops Advanced, which only restated the Basic tab", () => {
    expect(src).not.toContain('value="advanced"');
  });

  it("keeps Social sharing, which the public page's metadata reads, and previews it", () => {
    expect(src).toContain('value="social"');
    expect(src).toContain("<SharePreview");
    const publicPage = read(PUBLIC + "news/[slug]/page.tsx");
    expect(publicPage).toContain("view.ogTitle");
    expect(publicPage).toContain("view.twitterImageUrl");
  });
});
