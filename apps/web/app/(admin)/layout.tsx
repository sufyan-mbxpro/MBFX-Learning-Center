import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { auth } from "@repo/auth";
import { getBrandAssets, loadOwnProfile } from "@repo/core";
import { loadSubject } from "@repo/rbac";
import { buildThemeStyleSheet, getActiveTheme } from "@repo/theme";
import { curatedFontVariables } from "@repo/ui/fonts";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { ThemeScript } from "@repo/ui/components/theme-script";
import { AdminShell } from "./admin/_components/admin-shell.tsx";
import { faviconIcons } from "../_lib/favicon.ts";
import "@repo/ui/globals.css";

// Root layout for the ADMIN surface — one of two root layouts in this app
// (Next.js "multiple root layouts" convention: no top-level app/layout.tsx,
// one layout per route group, each owning <html> and <body>).
// See docs/memory/decisions/ADR-006-single-app-route-groups.md.
//
// No `export const dynamic = "force-dynamic"` here — with Cache Components
// (ADR-004, cacheComponents: true) that segment-config flag is a build
// error ("not compatible with nextConfig.cacheComponents"). `instant =
// false` is the Cache-Components-era replacement for what force-dynamic
// used to express: this segment is allowed to fully block on the server,
// not stream behind a static shell.
//
// Found the hard way, in this order: a top-level `await auth()` broke
// prerendering entirely (Next's own message: "push it into a component
// inside a boundary"). Moving the check into a <Suspense>-wrapped
// component fixed the build, but broke the actual redirect at runtime — a
// demoted user stayed in because a `redirect()` fired from inside a
// streamed Suspense boundary can't change the static shell's HTTP status,
// which was already committed as 200 by the time the redirect resolved.
// `instant = false` is the documented fix for exactly this shape of route
// (admin has no static-shell benefit to begin with — it's 100%
// authenticated), letting this go back to a plain top-level blocking
// await instead of fighting Suspense semantics that don't fit here.
export const instant = false;

// proxy.ts's STAFF check (a signed cookie, no DB call) is a gate, not the
// boundary — this re-check hits the database and is the real one. Never
// assume the proxy ran.
//
// Reads userType via @repo/rbac's loadSubject(userId), NOT
// session.user.userType — found live, not assumed: with Redis
// secondaryStorage configured (ADR-001), a still-valid session's attached
// user snapshot can be stale relative to the database (confirmed against a
// real promotion/demotion — packages/auth/src/auth.integration.test.ts
// documents it), which would silently defeat this re-check's whole
// purpose. loadSubject only trusts the session's user *id*, then
// re-queries fresh — the same discipline @repo/rbac's own
// requirePermission() already uses — and, as a bonus, naturally also
// rejects a deleted/deactivated STAFF user whose session happens to still
// be technically valid.

// generateMetadata (not a static export) so the admin favicon reflects the
// same BrandAsset upload the public surface reads (changes-02, ADR-017).
export async function generateMetadata(): Promise<Metadata> {
  const brandAssets = await getBrandAssets();
  return {
    title: "MBX Admin",
    description: "MBX Learning Center — admin portal.",
    robots: { index: false, follow: false },
    icons: faviconIcons(brandAssets.favicon),
  };
}

export default async function AdminRootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const subject = session?.user?.id ? await loadSubject(session.user.id) : null;
  if (subject?.userType !== "STAFF") redirect("/admin/sign-in");

  // Cached read (tag "theme", ADR-004) — an admin theme save invalidates
  // it; nothing polls. The style element id is frozen API: Module 14's CSP
  // work attaches its nonce to #brand-tokens by name (security.md #14).
  const theme = await getActiveTheme("admin");
  // Admin surface is en-only for now — no [locale] segment here, so the
  // request config falls back to the default locale by design.
  const messages = await getMessages();
  // Fresh row (not the session snapshot) — the profile page edits these
  // fields and the topbar must reflect the write on refresh.
  const profile = await loadOwnProfile(session!.user.id);
  const userName = profile?.name ?? session!.user.id;
  // Module 14 (security.md #14): the proxy mints a per-request nonce for
  // this fully-dynamic surface; #brand-tokens carries it so the admin CSP
  // can drop 'unsafe-inline' styles when it moves from report-only to
  // enforced.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning on <html>: <ThemeScript> stamps the mode class
    // pre-hydration (ADR-008, user-controlled mode — now on the admin
    // surface too, changes-01).
    // No per-surface scale class: public and admin share one type scale (ADR-072).
    <html
      lang="en"
      className={`h-full antialiased ${curatedFontVariables}`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) inject body attributes before React hydrates —
          same rationale as the public layout's <html> suppression. */}
      <body className="min-h-full" suppressHydrationWarning>
        {/* ADR-064: the pre-paint mode guard, server-rendered so the browser
            actually executes it. Carries the nonce, like #brand-tokens. */}
        <ThemeScript nonce={nonce} />
        <style
          id="brand-tokens"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: buildThemeStyleSheet(theme) }}
        />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AdminShell
              subject={subject!}
              userName={userName}
              email={profile?.email ?? ""}
              image={profile?.image ?? null}
            >
              {children}
            </AdminShell>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
