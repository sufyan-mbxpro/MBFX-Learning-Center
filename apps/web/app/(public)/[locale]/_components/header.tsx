// Public header (Module 08) — server component. Everything here reads
// CACHED data (tags: navigation, settings:layout, settings:general, theme,
// locales); auth state is a CLIENT chip (auth-slot.tsx), so the server
// shell carries zero per-request reads and navigations stay cheap.
import { ChevronDown, Search } from "lucide-react";
import { buildNavigation, getBrandAssets } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { getTranslations } from "next-intl/server";
import { AnnouncementBar } from "./announcement-bar.tsx";
import { AuthSlot } from "./auth-slot.tsx";
import { LocaleSwitcher } from "./locale-switcher.tsx";
import { MobileNav } from "./mobile-nav.tsx";
import { ModeToggle } from "./mode-toggle.tsx";
import { NavLink } from "./nav-link.tsx";
import { TopBar } from "./top-bar.tsx";

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
          {/* Below lg the nav lives behind the hamburger; same NavItem data. */}
          <MobileNav
            items={nav.map((item) => ({
              id: item.id,
              label: item.label,
              href: item.href,
              isExternal: item.isExternal,
              openInNewTab: item.openInNewTab,
              children: item.children.map((child) => ({
                id: child.id,
                label: child.label,
                href: child.href,
                isExternal: child.isExternal,
                openInNewTab: child.openInNewTab,
                children: [],
              })),
            }))}
            menuLabel={t("openMenu")}
          />

          {/* Uploaded logo (changes-02, ADR-017) when set — light/dark
              variants swap via the `dark:` class variant, same as every
              other theme-aware surface; falls back to the site name. */}
          <Link
            href="/"
            className="flex shrink-0 items-center truncate transition-transform duration-(--duration-base) ease-(--ease-out-quint) hover:scale-[1.03]"
          >
            {brandAssets.logo_light || brandAssets.logo_dark ? (
              <>
                {brandAssets.logo_light && (
                  // eslint-disable-next-line @next/next/no-img-element -- served by our own route (ADR-017), no optimizer allowlist to maintain
                  <img
                    src={brandAssets.logo_light.url}
                    alt={siteName ?? ""}
                    className={brandAssets.logo_dark ? "h-8 w-auto dark:hidden" : "h-8 w-auto"}
                  />
                )}
                {brandAssets.logo_dark && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandAssets.logo_dark.url}
                    alt={siteName ?? ""}
                    className={
                      brandAssets.logo_light ? "hidden h-8 w-auto dark:block" : "h-8 w-auto"
                    }
                  />
                )}
              </>
            ) : (
              <span className="text-lg font-semibold tracking-tight">{siteName}</span>
            )}
          </Link>

          <nav className="hidden items-center gap-5 lg:flex" aria-label={t("mainNavigation")}>
            {nav.map((item) =>
              item.children.length > 0 ? (
                <DropdownMenu key={item.id}>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                        {item.label}
                        <ChevronDown
                          aria-hidden
                          className="size-3.5 transition-transform duration-(--duration-base) group-aria-expanded/button:rotate-180"
                        />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start">
                    {item.children.map((child) => (
                      <DropdownMenuItem
                        key={child.id}
                        render={
                          <NavLink
                            href={child.href}
                            isExternal={child.isExternal}
                            openInNewTab={child.openInNewTab}
                          >
                            {child.label}
                          </NavLink>
                        }
                      />
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <NavLink
                  key={item.id}
                  href={item.href}
                  isExternal={item.isExternal}
                  openInNewTab={item.openInNewTab}
                  className="link-underline py-1"
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

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
