// Public footer (Module 08 + changes-03-plan.md §6.4) — server component,
// fully cached data (tags: navigation, settings:layout, settings:general,
// settings:legal).
import { getTranslations } from "next-intl/server";
import { cacheLife } from "next/cache";
import * as icons from "lucide-react";
import { buildMenu, getActiveSocialLinks, getBrandAssets } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { NavLink } from "./nav-link.tsx";
import { NewsletterForm } from "./newsletter-form.tsx";

// Cache Components rejects a bare `new Date()` during prerender — rightly:
// it would bake the build-time year into the static shell forever. Cached
// with an hourly revalidate instead, so the copyright year rolls over at
// New Year without a deploy.
async function getCurrentYear(): Promise<number> {
  "use cache";
  cacheLife({ revalidate: 3600 });
  return new Date().getFullYear();
}

function SocialIcon({ name }: { name: string }) {
  const lucide = icons as unknown as Record<
    string,
    React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> | undefined
  >;
  // Icon column stores a lucide name in kebab-case; resolve PascalCase.
  const pascal = name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());
  const Icon = lucide[pascal];
  return Icon ? <Icon aria-hidden className="size-4" /> : null;
}

// App-store links are admin-configured URLs (footer.appLinks). The BADGE
// artwork would be a third-party logo, which security/code-style rules keep
// out of the repo — so these render as labelled text links until an admin
// uploads their own badge assets (ADR-017).
const APP_PLATFORM_ICON: Record<string, string> = {
  ios: "apple",
  android: "smartphone",
  windows: "monitor",
};

export async function SiteFooter({ locale }: { locale: string }) {
  const [
    t,
    siteName,
    copyright,
    disclaimer,
    menuColumns,
    newsletterEnabled,
    appLinks,
    showPaymentBadges,
    socialLinks,
    brandAssets,
  ] = await Promise.all([
    getTranslations({ locale, namespace: "footer" }),
    getSetting("site.name"),
    getSetting("legal.copyrightNotice"),
    getSetting("legal.riskDisclaimer"),
    getSetting("footer.menuColumns"),
    getSetting("footer.newsletterEnabled"),
    getSetting("footer.appLinks"),
    getSetting("footer.showPaymentBadges"),
    getActiveSocialLinks(),
    getBrandAssets(),
  ]);

  // buildMenu (Phase 3) instead of buildNavigation: the columns need the
  // menu's own NAME for their heading, which buildNavigation never returned
  // — that is why every footer column rendered untitled until now.
  const columns = await Promise.all(
    (menuColumns ?? [])
      .toSorted((a, b) => a.order - b.order)
      .map((column) => buildMenu(column.menuKey, locale, null)),
  );

  // {year} is a rendering-time token (seed.ts's own note: Module 08 owns
  // the substitution).
  const copyrightLine = (copyright ?? "").replaceAll("{year}", String(await getCurrentYear()));

  return (
    <footer className="relative isolate overflow-hidden bg-secondary text-secondary-foreground">
      {/* Decorative texture, faded top-to-bottom so it never competes with
          content (ADR-018 rule 5 — large ambient fill, not a text/border
          color). Built from currentcolor (globals.css), so it reads
          correctly against this inverted surface. aria-hidden: purely
          visual. */}
      <div
        aria-hidden
        className="bg-dot-grid pointer-events-none absolute inset-0 opacity-[0.15] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
      />
      <Reveal variant="up" className="relative">
        <Container className="flex flex-col gap-10 py-12">
          {/* Responsive grid, not bare space-between: columns keep a steady
              rhythm at every width instead of stretching to the edges. The
              brand block gets double width on large screens. */}
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-4 lg:col-span-2">
              {/* Uploaded logo (ADR-017), same swap mechanism as the header
                  — but INVERTED: this band is always the opposite of the
                  page's own light/dark state (--secondary flips with mode),
                  so it needs the light-ink mark exactly when the header
                  needs the dark-ink one, and vice versa. */}
              {brandAssets.logo_light || brandAssets.logo_dark ? (
                <Link href="/" className="flex w-fit items-center truncate">
                  {brandAssets.logo_dark && (
                    // eslint-disable-next-line @next/next/no-img-element -- served by our own route (ADR-017), no optimizer allowlist to maintain
                    <img
                      src={brandAssets.logo_dark.url}
                      alt={siteName ?? ""}
                      className={brandAssets.logo_light ? "h-7 w-auto dark:hidden" : "h-7 w-auto"}
                    />
                  )}
                  {brandAssets.logo_light && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brandAssets.logo_light.url}
                      alt={siteName ?? ""}
                      className={
                        brandAssets.logo_dark ? "hidden h-7 w-auto dark:block" : "h-7 w-auto"
                      }
                    />
                  )}
                </Link>
              ) : (
                <p className="text-lg font-semibold">{siteName}</p>
              )}

              {socialLinks.filter((l) => l.showInFooter).length > 0 && (
                <ul className="flex items-center gap-2.5">
                  {socialLinks
                    .filter((l) => l.showInFooter)
                    .map((link) => (
                      <li key={link.platform}>
                        <a
                          href={link.url}
                          aria-label={link.label}
                          className="flex size-9 items-center justify-center rounded-full bg-secondary-foreground/10 text-secondary-foreground transition-[background-color,color,transform] duration-(--duration-base) ease-(--ease-out-quint) hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground"
                          {...(link.openInNewTab
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          <SocialIcon name={link.icon} />
                        </a>
                      </li>
                    ))}
                </ul>
              )}

              {(appLinks ?? []).length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{t("getTheApp")}</p>
                  <ul className="flex flex-wrap items-center gap-2">
                    {(appLinks ?? []).map((link) => (
                      <li key={link.platform}>
                        <a
                          href={link.url}
                          className="inline-flex items-center gap-1.5 rounded-md bg-secondary-foreground/10 px-3 py-1.5 text-xs transition-[background-color,transform] duration-(--duration-base) hover:-translate-y-0.5 hover:bg-secondary-foreground/15"
                        >
                          <SocialIcon name={APP_PLATFORM_ICON[link.platform] ?? "smartphone"} />
                          {t(`appPlatform.${link.platform}`)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showPaymentBadges && (
                <p className="text-xs text-secondary-foreground/70">{t("paymentMethods")}</p>
              )}
            </div>

            {columns.map(
              (column) =>
                column.items.length > 0 && (
                  <div key={column.key} className="flex flex-col gap-3">
                    {column.name && <p className="text-sm font-semibold">{column.name}</p>}
                    <ul className="flex flex-col gap-2.5">
                      {column.items.map((item) => (
                        <li key={item.id}>
                          <NavLink
                            href={item.href}
                            isExternal={item.isExternal}
                            openInNewTab={item.openInNewTab}
                            className="link-underline text-secondary-foreground/70 hover:text-secondary-foreground"
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}

            {newsletterEnabled && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t("newsletterHeading")}</p>
                <NewsletterForm
                  tone="onSecondary"
                  placeholder={t("newsletterPlaceholder")}
                  label={t("newsletterLabel")}
                  submitLabel={t("newsletterSubmit")}
                  unavailableLabel={t("newsletterUnavailable")}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-secondary-foreground/15 pt-6">
            {disclaimer && (
              <p className="text-xs leading-relaxed text-secondary-foreground/70">{disclaimer}</p>
            )}
            <p className="text-xs text-secondary-foreground/70">{copyrightLine}</p>
          </div>
        </Container>
      </Reveal>
    </footer>
  );
}
