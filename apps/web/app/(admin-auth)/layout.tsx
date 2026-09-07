import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { buildThemeStyleSheet, getActiveTheme } from "@repo/theme";
import { curatedFontVariables } from "@repo/ui/fonts";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import "@repo/ui/globals.css";

// Root layout for the STAFF SIGN-IN surface — the third root layout in this
// app, and the reason ADR-052 needed a route group of its own.
//
// It cannot live in `(admin)`: that group's root layout IS the server-side
// STAFF re-check (it redirects a non-STAFF subject to this very page), so a
// sign-in screen inside it would redirect to itself forever. Next.js
// "multiple root layouts" — already the mechanism behind ADR-006's two
// surfaces — lets `/admin/sign-in` render from here with its own <html>
// while every other `/admin/*` path keeps the gated layout.
//
// No session read, no AdminShell, no navigation: this page is reachable
// unauthenticated by design, so it exposes nothing but the form.

// `headers()` for the CSP nonce makes this segment dynamic; `instant =
// false` is the Cache-Components-era way to say so (the same note the
// (admin) layout carries — `export const dynamic` is a build error under
// cacheComponents).
export const instant = false;

export const metadata: Metadata = {
  title: "MBFX Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAuthRootLayout({ children }: LayoutProps<"/">) {
  // The admin theme, so the sign-in screen matches the portal it opens
  // rather than the public site it is deliberately not part of.
  const theme = await getActiveTheme("admin");
  // Admin surface is en-only by design (ADR-043 #2) — no [locale] segment
  // here, so the request config falls back to the default locale.
  const messages = await getMessages();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`h-full antialiased ${curatedFontVariables}`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <style
          id="brand-tokens"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: buildThemeStyleSheet(theme) }}
        />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
