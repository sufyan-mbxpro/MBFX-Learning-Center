// changes-39 — the owner's fix list, guarded as source.
//
// Read as source like `grid-base.test.ts` and `radius-scale.test.ts`: apps/web's
// vitest config has no JSX transform, and each property here is one a reviewer
// checks by reading.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP = resolve(process.cwd(), "app");
const PUBLIC = join(APP, "(public)/[locale]");
const UI = resolve(process.cwd(), "../../packages/ui/src/components");
const read = (path: string) => readFileSync(path, "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".tsx") && !path.includes(".test.") ? [path] : [];
  });
}

describe("the sitemap has its cover image", () => {
  it("draws the owner's banner behind the masthead", () => {
    const page = read(join(PUBLIC, "sitemap/page.tsx"));
    expect(page).toContain('backdrop={<SitemapBackdrop slot="banner" />}');
    const media = read(join(PUBLIC, "sitemap/_content/sitemap-media.ts"));
    expect(media).toContain('"/banners/sitemap.webp"');
    expect(statSync(resolve(process.cwd(), "public/banners/sitemap.webp")).size).toBeGreaterThan(0);
  });
});

describe("a glossary topic page (ADR-133)", () => {
  const page = read(join(PUBLIC, "glossary/topics/[topic]/page.tsx"));

  it("no longer closes its masthead with a 'Browse by topic · N' counter", () => {
    expect(page).not.toContain("<dl");
    expect(page).not.toContain("view.termCount");
  });

  it("shows the topic's cover, falling back to the glossary's artwork", () => {
    expect(page).toContain("<TopicCover coverUrl={view.coverUrl}");
    const cover = read(join(PUBLIC, "glossary/_components/topic-cover.tsx"));
    expect(cover).toContain("coverUrl ?? GLOSSARY_MEDIA.topicsBanner");
  });

  it("gives every card on the topics index the same picture box", () => {
    const index = read(join(PUBLIC, "glossary/topics/page.tsx"));
    expect(index).toContain("coverUrl={topic.coverUrl}");
  });
});

describe("the progress island is not aborted by its own Strict Mode guard", () => {
  // Under Strict Mode the effect's cleanup ran between its two invocations:
  // the first request was aborted and the ref stopped the second, so status
  // stayed `loading` (the complete button stayed disabled) and the visit that
  // records reading history never reached the server.
  it("does not abort the one request a `started` ref allows", () => {
    const source = read(join(PUBLIC, "learn/_components/progress-provider.tsx"));
    const provider = source.slice(
      source.indexOf("export function ProgressProvider"),
      source.indexOf("export function useLearnerDashboard"),
    );
    expect(provider).toContain("started.current = true");
    expect(provider).not.toContain(".abort()");
    expect(provider).not.toContain("new AbortController");
  });
});

describe("one hover recipe for a clickable card (changes-39)", () => {
  // `.card-hover` owns `--tw-ring-color` and `border-color` on hover, so a
  // `hover:ring-primary/*` or `hover:border-primary/*` beside it never shows.
  // Written anyway, it is how two cards that look different in the source
  // come to look identical on screen — or the other way round.
  const TRAP = /card-hover[^"`]*hover:(?:ring|border)-primary/;

  it("never pairs card-hover with a hover tint it silently overrides", () => {
    const offenders = [...walk(PUBLIC), ...walk(UI)]
      .filter((path) => TRAP.test(read(path)))
      .map((path) => relative(process.cwd(), path));
    expect(offenders).toEqual([]);
  });

  it.each([
    "glossary/topics/page.tsx",
    "glossary/topics/[topic]/page.tsx",
    "_sections/featured-lessons.tsx",
    "learn/_components/video-links.tsx",
    "learn/_components/course-sidebar.tsx",
    "learn/[track]/[course]/page.tsx",
    "learn/[track]/[course]/[lesson]/page.tsx",
  ])("%s draws its cards from INTERACTIVE_CARD", (path) => {
    expect(read(join(PUBLIC, path))).toContain("INTERACTIVE_CARD");
  });

  it.each([
    "glossary/topics/[topic]/page.tsx",
    "glossary/[slug]/page.tsx",
    "glossary/_components/glossary-footer-search.tsx",
    "news/[slug]/page.tsx",
  ])("%s draws its chips from CHIP_LINK", (path) => {
    expect(read(join(PUBLIC, path))).toContain("className={CHIP_LINK}");
  });
});
