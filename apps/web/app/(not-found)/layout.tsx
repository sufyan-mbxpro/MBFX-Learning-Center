import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { buildThemeStyleSheet, getActiveTheme } from "@repo/theme";
import { curatedFontVariables } from "@repo/ui/fonts";
import { ThemeScript } from "@repo/ui/components/theme-script";
import "@repo/ui/globals.css";
import { faviconIcons } from "../_lib/favicon.ts";

// The fourth root layout (changes-49, ADR-146): the document a REAL 404 is
// served in.
//
// Why a route group of its own. The proxy decides, before anything streams,
// that an address answers nothing, and rewrites it here. Inside `(public)` a
// 404 status is impossible — `[locale]/loading.tsx` wraps every page in a
// Suspense boundary, so the 200 is on the wire before `notFound()` runs — and
// `global-not-found.tsx` is not what Next serves when the `[locale]` layout
// throws (it renders its own built-in page). A layout with NO loading
// boundary, whose page calls `notFound()` at once, is the one shape that
// answers 404 with our own markup.
//
// Deliberately chrome-less (no header, no footer): it reads no session, no
// menu and no request data, so the render is cheap for a response bots ask
// for by the thousand. The theme, fonts and favicon make it the site's page.
export async function generateMetadata(): Promise<Metadata> {
  const [t, brandAssets] = await Promise.all([
    getTranslations({ locale: "en", namespace: "notFound" }),
    getBrandAssets(),
  ]);
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: true },
    icons: faviconIcons(brandAssets.favicon),
  };
}

export default async function NotFoundRootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getActiveTheme("web");
  return (
    <html
      lang="en"
      className={`h-full antialiased ${curatedFontVariables}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <ThemeScript />
        <style
          id="brand-tokens"
          dangerouslySetInnerHTML={{ __html: buildThemeStyleSheet(theme) }}
        />
        {children}
      </body>
    </html>
  );
}
