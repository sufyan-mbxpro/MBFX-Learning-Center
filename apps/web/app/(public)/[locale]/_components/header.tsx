// Public header (Module 08) — server component. Everything here reads
// CACHED data (tags: navigation, settings:layout, settings:general, theme,
// locales); auth state is a CLIENT chip (auth-slot.tsx), so the server
// shell carries zero per-request reads and navigations stay cheap.
import { Search } from "lucide-react";
import { buildNavigation, getBrandAssets } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { cn } from "@repo/ui/lib/utils";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { getTranslations } from "next-intl/server";
import { AnnouncementBar } from "./announcement-bar.tsx";
import { AuthSlot } from "./auth-slot.tsx";
import { LocaleSwitcher } from "./locale-switcher.tsx";
import { MobileNav } from "./mobile-nav.tsx";
import { ModeToggle } from "./mode-toggle.tsx";
import { TopBar } from "./top-bar.tsx";
import { SiteNav, type SiteNavItem } from "../_nav/site-nav.tsx";

export async function SiteHeader({ locale }: { locale: string }) {
  const [nav, siteName, sticky, cta, announcement, topBar, showSearch, locales, t, brandAssets] =
    await Promise.all([
      buildNavigation("main", locale, null),
      getSetting("site.name"),
      getSetting("header.sticky"),
      getSetting("header.cta"),
      getSetting("header.announcementBar"),
      getSetting("header.topBar"),
      getSetting("header.showSearch"),
      getActiveLocales(),
      getTranslations({ locale, namespace: "nav" }),
      getBrandAssets(),
    ]);

  // One serializable projection of the menu tree, shared by both the
  // desktop panel and the mobile sheet — they render the SAME rows, so a
  // destination can never appear on one and not the other. `title` is the
  // per-row description a panel shows under the label.
  const navItems: SiteNavItem[] = nav.map((item) => ({
    id: item.id,
    label: item.label,
    title: item.title,
    href: item.href,
    isExternal: item.isExternal,
    openInNewTab: item.openInNewTab,
    children: item.children.map((child) => ({
      id: child.id,
      label: child.label,
      title: child.title,
      href: child.href,
      isExternal: child.isExternal,
      openInNewTab: child.openInNewTab,
    })),
  }));

  return (
    <div className={cn(sticky && "sticky top-0 z-40")}>
      {announcement?.enabled && (
        <AnnouncementBar text={announcement.text} dismissible={announcement.dismissible} />
      )}
      {topBar?.enabled && (
        <TopBar phone={topBar.phone} promoText={topBar.promoText} promoUrl={topBar.promoUrl} />
      )}
      <header className="bg-glow-primary relative isolate border-b border-border/70 bg-background/95 shadow-sm backdrop-blur-md">
        <Container className="flex h-[var(--height-header)] items-center gap-3 md:gap-6">
          {/* Below lg the nav lives behind the hamburger; same rows. */}
          <MobileNav items={navItems} menuLabel={t("openMenu")} />

          {/* Uploaded logo (changes-02, ADR-017) when set — light/dark
              variants swap via the `dark:` class variant, same as every
              other theme-aware surface; falls back to the site name. */}
          <Link
            href="/"
            className="flex shrink-0 items-center truncate transition-transform duration-(--duration-base) ease-(--ease-out-quint) hover:scale-[1.03]"
          >
            <BrandLogo
              light={brandAssets.logo_light?.url ?? null}
              dark={brandAssets.logo_dark?.url ?? null}
              alt={siteName ?? ""}
              className="h-8"
              fallback={<span className="text-lg font-semibold tracking-tight">{siteName}</span>}
            />
          </Link>

          {/* Desktop nav is a CLIENT component (ADR-048): the mega-menu panel
              registry carries icon components, which cannot cross the
              server/client boundary as props, so the arrangement lives with
              the registry and the server passes only serializable rows. */}
          <SiteNav items={navItems} ariaLabel={t("mainNavigation")} />

          <div className="ms-auto flex items-center gap-2">
            {/* No site-wide search backend exists yet (admin-search.tsx is
                admin-only and must not be imported here — architecture #5),
                so this is a link into the article listing's own `q` filter
                rather than a fake global search. */}
            {showSearch && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("search")}
                render={<Link href="/news" />}
              >
                <Search aria-hidden className="size-4" />
              </Button>
            )}
            <LocaleSwitcher locales={locales} />
            <ModeToggle />
            <AuthSlot />
            {cta?.enabled && (
              <Button
                shape="pill"
                className="glow-on-hover"
                render={<a href={cta.url}>{cta.label}</a>}
              />
            )}
          </div>
        </Container>
        {/* Thin brand hairline under the header — a large-fill gradient
            wash, not a thin literal border color (ADR-018 rule 5). */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-interactive/40 to-transparent"
        />
      </header>
    </div>
  );
}
