// The public surface's session read, and what hangs off it (ADR-094).
//
// Read as source, like every other guard under `apps/web/app`. `apps/web` has
// no jsdom environment and no React Testing Library — RTL lives in `@repo/ui`,
// where the components are pure and take props (see `quiz-card.test.tsx`).
// These two are app-level islands that fetch, so testing them through RTL
// would mean adding jsdom, `@testing-library/react` and a fetch stub to this
// package to assert three rules that are visible in the source and invisible
// to the type system. The rules are what matter:
//
//   1. ONE fetch on the public surface, in the provider, not per consumer.
//   2. A STAFF session reads as anonymous — applied once, at the provider.
//   3. The visitor band is absent while loading AND for a signed-in learner.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd(), "app/(public)/[locale]");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/**
 * Source with its comments removed.
 *
 * These guards assert what the code DOES, and several of the files under test
 * explain in a comment exactly which thing they deliberately do not do. A bare
 * substring search then matches the explanation and fails the file for saying
 * why it is correct — so the prose comes out before the assertion goes in.
 */
function withoutComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const SESSION_ENDPOINT = "/api/auth/get-session";

describe("ADR-094 — one session read for the whole public surface", () => {
  it("the provider is the only thing that calls the session endpoint", () => {
    const callers = [
      "_components/public-session.tsx",
      "_components/auth-slot.tsx",
      "_components/visitor-cta.tsx",
      "_components/header.tsx",
      "_components/mobile-nav.tsx",
      "layout.tsx",
    ].filter((path) => read(path).includes(SESSION_ENDPOINT));
    expect(callers).toEqual(["_components/public-session.tsx"]);
  });

  it("both consumers read it through the hook", () => {
    for (const path of ["_components/auth-slot.tsx", "_components/visitor-cta.tsx"]) {
      expect(read(path), path).toContain("usePublicSession()");
    }
  });

  it("the provider wraps the header and the band in the root layout", () => {
    const layout = read("layout.tsx");
    expect(layout).toContain("<PublicSessionProvider>");
    // Both consumers inside one provider. A provider around only the header
    // would leave the band reading the context default — `loading` forever,
    // which renders nothing and looks exactly like "working".
    const inside = layout.slice(
      layout.indexOf("<PublicSessionProvider>"),
      layout.indexOf("</PublicSessionProvider>"),
    );
    expect(inside).toContain("<SiteHeader");
    expect(inside).toContain("<VisitorCta />");
  });

  it("a STAFF session reads as anonymous, decided once at the provider", () => {
    // ADR-052: staff belong to the admin surface. A chip reading "System
    // Administrator" on the public header advertises the portal this site
    // deliberately hides. Applied at the provider so every consumer inherits
    // it rather than each remembering to.
    expect(read("_components/public-session.tsx")).toContain('userType !== "STAFF"');
    expect(read("_components/auth-slot.tsx")).not.toContain("STAFF");
  });

  it("a failed session read resolves to anonymous, never to an error state", () => {
    // A stuck spinner in the header of every cached page is worse, and lasts
    // longer, than a signed-in learner briefly seeing a sign-up prompt.
    expect(read("_components/public-session.tsx")).toContain('setSession({ status: "anonymous" })');
  });
});

describe("ADR-094 — the visitor band", () => {
  const src = read("_components/visitor-cta.tsx");

  it("renders only for an anonymous visitor", () => {
    // Not `=== "loading" ? null` plus a learner check: one condition, so a
    // fourth session state can never fall through to showing the band.
    expect(src).toContain('if (session.status !== "anonymous") return null;');
  });

  it("is in flow, never pinned to the viewport", () => {
    // A fixed bar covers content on exactly the screens with least of it, and
    // competes with the sticky header for a phone's vertical budget.
    expect(withoutComments(src)).not.toMatch(/className="[^"]*\b(?:fixed|sticky)\b/);
  });

  it("names itself for assistive technology", () => {
    expect(src).toContain("aria-label={t(");
  });

  it("carries no hardcoded copy", () => {
    // code-style.md #2. Every visible string is a catalog key.
    expect(src).toContain('t("visitorCtaTitle")');
    expect(src).toContain('t("visitorCtaAction")');
  });
});
