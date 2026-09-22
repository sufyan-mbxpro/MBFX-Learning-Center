import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { buildThemeStyleSheet, getActiveTheme, withAdminTypeface } from "@repo/theme";
import { curatedFontVariables } from "@repo/ui/fonts";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { ThemeScript } from "@repo/ui/components/theme-script";
import { ADMIN_THEME_STORAGE_KEY } from "@repo/ui/lib/theme-mode";
import "@repo/ui/globals.css";
import { faviconIcons } from "../_lib/favicon.ts";

// Root layout for the STAFF SIGN-IN surface — the third root layout in this
// app, and the reason ADR-052 needed a route group of its own.
//
// It cannot live in `(admin)`: that group's root layout IS the server-side
// STAFF re-check (it redirects a non-STAFF subject to this very page), so a
// sign-in screen inside it would redirect to itself forever. Next.js
// "multiple root layouts" — already the mechanism behind ADR-006's two
// surfaces — lets `/keystone` render from here with its own <html>
// while every other `/keystone/*` path keeps the gated layout.
//
// No session read, no AdminShell, no navigation: this page is reachable
// unauthenticated by design, so it exposes nothing but the form.

// `headers()` for the CSP nonce makes this segment dynamic; `instant =
// false` is the Cache-Components-era way to say so (the same note the
// (admin) layout carries — `export const dynamic` is a build error under
// cacheComponents).
export const instant = false;

// generateMetadata, like the other two root layouts, so the staff sign-in and
// recovery screens show the admin-uploaded favicon (changes-45). A static
// `metadata` here had no `icons`, so these three screens alone fell back to
// the stock `/favicon.ico` while every page behind them showed the brand's.
export async function generateMetadata(): Promise<Metadata> {
  const brandAssets = await getBrandAssets();
  return {
    title: "MBX Admin",
    robots: { index: false, follow: false },
    icons: faviconIcons(brandAssets.favicon),
  };
}

export default async function AdminAuthRootLayout({ children }: LayoutProps<"/">) {
  // The admin theme, so the sign-in screen matches the portal it opens
  // rather than the public site it is deliberately not part of.
  const theme = await getActiveTheme("admin");
  // Admin surface is en-only by design (ADR-043 #2) — no [locale] segment
  // here, so the request config falls back to the default locale.
  const messages = await getMessages();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // No per-surface scale class: public and admin share one type scale (ADR-072).
    <html
      lang="en"
      className={`h-full antialiased ${curatedFontVariables}`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        {/* ADR-064: the pre-paint mode guard, server-rendered so the browser
            actually executes it. Carries the nonce, like #brand-tokens. */}
        <ThemeScript nonce={nonce} storageKey={ADMIN_THEME_STORAGE_KEY} />
        <style
          id="brand-tokens"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: buildThemeStyleSheet(withAdminTypeface(theme)) }}
        />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider storageKey={ADMIN_THEME_STORAGE_KEY}>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
