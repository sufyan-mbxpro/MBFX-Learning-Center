import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { LOCALE_DIRECTION, routing } from "@repo/i18n/routing";
import { buildThemeStyleSheet, getActiveTheme } from "@repo/theme";
import { curatedFontVariables } from "@repo/ui/fonts";
import { RevealObserver } from "@repo/ui/components/reveal-observer";
import { ScrollToTop } from "@repo/ui/components/scroll-to-top";
import { SiteLoader } from "@repo/ui/components/site-loader";
import { SiteFooter } from "./_components/footer.tsx";
import { SiteHeader } from "./_components/header.tsx";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import "@repo/ui/globals.css";

// Root layout for the PUBLIC surface (ADR-006: (public) and (admin) each own
// a root layout, no top-level app/layout.tsx). This is [locale], not
// (public) itself, because `lang`/`dir` on <html> need the resolved locale
// (architecture doc §4.3) — a route group folder has no params to read.
//
// Header/footer land in Module 08/12. Fonts are curated + self-hosted
// (ADR-005, @repo/ui/fonts) — no next/font/google anywhere.
//
// generateMetadata (not a static export) because the favicon is a
// BrandAsset upload (changes-02, ADR-017) — falls back to the static
// /favicon.ico in public/ when no admin upload has replaced it.
export async function generateMetadata(): Promise<Metadata> {
  const brandAssets = await getBrandAssets();
  return {
    title: "MBFX Learning Center",
    description: "Forex learning platform — scaffold in progress.",
    icons: brandAssets.favicon ? { icon: brandAssets.favicon } : undefined,
  };
}

// Cache Components + next-intl's locale-aware <Link>/getTranslations do
// not yet compose into a fully-static shell — every attempt surfaces as
// "runtime data during prerendering" on whichever route builds first
// (three in one day: nav strings, glossary list links, home spotlight
// links). Every read on this surface is cached and tag-invalidated
// (theme/settings/navigation/content/locales), so blocking IS a cache
// hit — this trades the PPR static shell for correctness in ONE place
// instead of per-page whack-a-mole. Revisit when next-intl ships static
// Cache Components support (tracked in DEVLOG Module 14 checklist).
export const instant = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PublicRootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  // The proxy's matcher and next-intl's own middleware keep an unrecognized
  // locale prefix from reaching this point in normal operation — this is
  // the defense-in-depth 404 for a locale segment that isn't in
  // routing.locales (SKILL.md's required "unknown locale → 404" case).
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering under Cache Components (ADR-004) — tells
  // next-intl which locale this render is for before any message lookup,
  // the same role loadActiveTheme/loadSubject's cache-tag calls play
  // elsewhere: declare context before the async work, not after.
  setRequestLocale(locale);

  const messages = await getMessages();

  // Cached read (tag "theme", ADR-004): resolved at build/revalidate time
  // for these static routes, invalidated by an admin theme save. The style
  // element id is frozen API — Module 14's CSP nonce attaches to
  // #brand-tokens by name (security.md #14).
  const [theme, pageLoader, t] = await Promise.all([
    getActiveTheme("web"),
    // ADR-018 rule 4d — the preloader's kill switch. A missing row (a
    // database seeded before Phase 3) reads as null and stays off.
    getSetting("layout.pageLoader"),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  return (
    <html
      lang={locale}
      dir={LOCALE_DIRECTION[locale]}
      className={`h-full antialiased ${curatedFontVariables}`}
      // next-themes mutates the class list before hydration (stored mode).
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) inject body attributes before React hydrates —
          same rationale as this <html>'s suppression above. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <style
          id="brand-tokens"
          dangerouslySetInnerHTML={{ __html: buildThemeStyleSheet(theme) }}
        />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {/* ADR-018: SiteLoader renders nothing during SSR and only
                appears post-hydration, so it can never delay first paint.
                RevealObserver is the ONE observer island per page (rule 2)
                — it does nothing at all in browsers with native
                scroll-driven animation support. */}
            {pageLoader && <SiteLoader />}
            <RevealObserver />
            <SiteHeader locale={locale} />
            <div className="flex-1">{children}</div>
            <SiteFooter locale={locale} />
            <ScrollToTop label={t("backToTop")} />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
