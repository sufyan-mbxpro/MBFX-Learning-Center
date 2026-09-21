// The header account menu and the read beacon (ADR-123), read as source like
// `public-session.test.ts` — `apps/web` has no jsdom, and these are rules
// about what the islands do, visible in the source and invisible to types.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd(), "app/(public)/[locale]");
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("ADR-123 — the signed-in account menu", () => {
  const slot = read("_components/auth-slot.tsx");

  it("is a dropdown menu, not a bare name chip", () => {
    expect(slot).toContain("<DropdownMenu>");
    expect(slot).toContain("<DropdownMenuTrigger");
  });

  it("carries no verify-email nudge — that lives on the profile page (changes-45, ADR-142 §2)", () => {
    expect(slot).not.toContain("resendVerification");
    expect(slot).not.toContain("verify-email");
    expect(slot).not.toContain("verify-dot");
    expect(slot).not.toMatch(/t\("verify/);
  });

  it("leaves the anonymous pair to the mobile menu below xl, never the signed-in avatar", () => {
    expect(slot).toContain('inMenuBelowXl ? "hidden xl:flex" : "flex"');
    const signedIn = slot.slice(slot.indexOf("<DropdownMenuTrigger"));
    expect(signedIn).not.toContain("anonymousDisplay");
    expect(read("_components/header.tsx")).toContain("inMenuBelowXl={navItems.length > 0}");
  });

  it("links to the profile page and signs out through the one sign-out helper", () => {
    expect(slot).toContain("<Link href={ACCOUNT_PATH}>");
    expect(slot).toMatch(/await signOut\(\)/);
    expect(slot).not.toContain("/api/auth/sign-out");
  });
});

describe("ADR-123 — the read beacon keeps the article page cached", () => {
  it("the article page reads no session and mounts the client beacon", () => {
    const page = read("news/[slug]/page.tsx");
    expect(page).toContain("<ReadBeacon articleId={view.articleId} />");
    expect(page).not.toMatch(/\bauth\(\)/);
    expect(page).not.toContain("@repo/auth");
  });

  it("the beacon is a client island that posts only for a signed-in learner", () => {
    const beacon = read("news/_components/read-beacon.tsx");
    expect(beacon.trimStart().startsWith('"use client"')).toBe(true);
    expect(beacon).toContain('session.status !== "learner"');
    expect(beacon).not.toContain("userId");
  });

  it("both account pages are noindex and read the session only inside Suspense", () => {
    const profile = read("account/page.tsx");
    const progress = read("account/progress/page.tsx");
    expect(profile).toMatch(/<Suspense[\s\S]*<ProfileContent/);
    expect(progress).toMatch(/<Suspense[\s\S]*<ProgressContent/);
    for (const page of [profile, progress]) {
      expect(page).toContain("robots: { index: false, follow: false }");
      expect(page).not.toMatch(/\bauth\(\)/);
    }
    expect(read("account/_components/profile-content.tsx")).toContain("requireLearnerSession(");
    expect(read("account/progress/_components/progress-content.tsx")).toContain(
      "requireLearnerSession(",
    );
    expect(read("account/_lib/learner-session.ts")).toContain("await auth()");
  });
});

describe("ADR-125 — two account pages, and a profile change reaches the header", () => {
  it("the layout reads no session and draws one section bar over both pages", () => {
    const layout = read("account/layout.tsx");
    expect(layout).not.toMatch(/\bauth\(\)/);
    expect(layout).toContain("<SectionNav");
    expect(layout).toContain("href: ACCOUNT_PATH");
    expect(layout).toContain("href: ACCOUNT_PROGRESS_PATH");
  });

  it("the menu links to the progress page", () => {
    expect(read("_components/auth-slot.tsx")).toContain("<Link href={ACCOUNT_PROGRESS_PATH}>");
  });

  it("the profile page resends through the rate-limited helper, back to itself", () => {
    const panel = read("account/_components/email-verification-panel.tsx");
    expect(panel).toContain("resendVerification(email, callbackURL)");
    expect(panel).not.toContain("/api/auth/send-verification-email");
    expect(panel).toMatch(/role="status"[\s\S]*?data-slot="verification-sent"/);
    expect(read("account/_components/profile-content.tsx")).toContain(
      "callbackURL={`${getPathname({ href: ACCOUNT_PATH, locale })}?verified=1`}",
    );
  });

  it("every learner profile write refreshes Better Auth's copies of the user", () => {
    const actions = read("_actions/account.ts");
    for (const write of ["updateOwnProfile(", "setOwnAvatar(", "removeOwnAvatar("]) {
      const after = actions.slice(actions.indexOf(`await ${write}`));
      expect(after.slice(0, after.indexOf('return { status: "ok" }'))).toContain(
        "await refreshSessionUser(userId)",
      );
    }
  });

  it("the provider re-reads past the cookie cache, and the account pages ask it to", () => {
    const provider = read("_components/public-session.tsx");
    expect(provider).toContain("/api/auth/get-session?disableCookieCache=true");
    expect(provider).toContain("export function useRefreshPublicSession()");
    expect(read("account/_components/account-masthead.tsx")).toContain("<SessionSync");
    const sync = read("account/_components/session-sync.tsx");
    expect(sync).toContain("session.image !== image");
    // Once per distinct server value — a failed refresh must not loop.
    expect(sync).toContain("attempted.current === key");
  });
});
