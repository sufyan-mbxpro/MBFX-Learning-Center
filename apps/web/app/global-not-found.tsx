import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { buildThemeStyleSheet, getActiveTheme } from "@repo/theme";
import { curatedFontVariables } from "@repo/ui/fonts";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { ThemeScript } from "@repo/ui/components/theme-script";
import "@repo/ui/globals.css";
import { faviconIcons } from "./_lib/favicon.ts";
import { NotFoundView, notFoundLabels } from "./_components/not-found-view.tsx";

// Next 16's global-not-found convention (see next.config.ts's
// `experimental.globalNotFound`): the ONE catch-all for a URL that matches
// no route at all, and for a `notFound()` thrown from a layout before it
// ever returns its own shell — the exact situation the (public) surface's
// [locale] layout hits for an unrecognized locale segment, since that
// layout IS the one rendering <html> (ADR-006: no top-level app/layout.tsx
// to fall back on). Bypasses every other layout, so it is self-contained:
// its own <html>, its own stylesheet import.
//
// changes-49 made it the page most 404s land on: the proxy now rewrites an
// address nothing answers here, because this is the one render Next serves
// with a real 404 status (ADR-146). So it is no longer "deliberately plain":
// it carries the site's theme tokens, favicon and logo, and the shared
// coming-soon design. The strings are the default locale's — there is no
// [locale] segment to read another from.
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

export default async function GlobalNotFound() {
  const [t, theme, brandAssets] = await Promise.all([
    getTranslations({ locale: "en", namespace: "notFound" }),
    getActiveTheme("web"),
    getBrandAssets(),
  ]);
  return (
    // suppressHydrationWarning: this file owns its own <html>/<body> because
    // it bypasses every layout, so it needs the same browser-extension
    // tolerance the three root layouts already carry.
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
        <NotFoundView
          labels={notFoundLabels(t)}
          // Next makes this a full load: the site's root layouts differ.
          renderLink={(href) => <Link href={href} />}
          brand={
            <Link href="/" className="inline-flex">
              <BrandLogo
                light={brandAssets.logo_light?.url ?? null}
                dark={brandAssets.logo_dark?.url ?? null}
                alt=""
                className="h-12"
                fallback={<span className="text-xl font-semibold tracking-tight">MBX</span>}
              />
            </Link>
          }
        />
      </body>
    </html>
  );
}
