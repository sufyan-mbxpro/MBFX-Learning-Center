// Public footer (Module 08 + changes-03-plan.md §6.4) — server component,
// fully cached data (tags: navigation, settings:layout, settings:general,
// settings:legal).
//
// The footer is a SITEMAP, not a shortcut list: `footer.menuColumns` names
// every footer-location menu, and the seed gives those menus a row for each
// destination the header offers (Learn / Markets & Tools / Company). A
// visitor who has scrolled to the bottom never has to scroll back up.
//
// A NOTE ON BRAND COLOUR HERE, because it is the one thing that reads as a
// missed opportunity: this band is `--secondary`, and both `--primary` and
// `--primary-interactive` are derived against `--background` (see
// `deriveInteractive` in @repo/theme), so neither has a contrast guarantee
// on this surface. ADR-018 rule 5 already bars raw `--primary` on thin and
// text-adjacent elements; on THIS band the same reasoning bars
// `--primary-interactive` too. So every accent below is built from
// `currentcolor`/`--secondary-foreground` at an opacity — guaranteed legible
// because `--secondary-foreground` is derived readable ON `--secondary` —
// and `--primary` appears only where it is a FILL with its own paired ink
// (the social hover swap) or a large ambient wash (`bg-glow-primary`, and
// `.sheen`'s decorative sweep, which carries no text).
import { getTranslations } from "next-intl/server";
import { cacheLife } from "next/cache";
import { Apple, ChevronRight, Monitor, Smartphone } from "lucide-react";
import { buildMenu, getActiveSocialLinks, getBrandAssets } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { SocialGlyph } from "@repo/ui/components/social-glyph";
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

// A social link's icon: the admin-uploaded asset when there is one,
// otherwise the built-in glyph named by `icon` (ADR-045). This used to
// look the name up as a `lucide-react` export, which resolved to
// `undefined` for every brand icon after lucide v1 removed them — the
// footer rendered five empty circles and said nothing about it.
function SocialLinkIcon({ icon, iconUrl }: { icon: string; iconUrl: string | null }) {
  if (iconUrl) {
    // Plain <img>: uploaded assets are served by our own route (ADR-017),
    // and the icon is decorative here — the <a> carries the label.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={iconUrl} alt="" aria-hidden className="size-4 object-contain" />;
  }
  return <SocialGlyph name={icon} />;
}

// App-store links are admin-configured URLs (footer.appLinks). The BADGE
// artwork would be a third-party logo, which security/code-style rules keep
// out of the repo — so these render as labelled text links until an admin
// uploads their own badge assets (ADR-017).
const APP_PLATFORM_ICON = {
  ios: Apple,
  android: Smartphone,
  windows: Monitor,
} as const;

// Static class strings, keyed by how many link cells there actually are —
// Tailwind scans source text, so a template-built `lg:grid-cols-${n}` would
// generate nothing. Column COUNT is data (an admin can add a fourth menu),
// so the grid has to answer for every plausible count rather than assuming
// today's three.
//
// These divide the EIGHT-of-twelve track the links share with the brand
// block, not the whole container. Spread across the full 1400px, three
// columns land roughly 400px apart and the band reads as three lonely lists
// with holes between them; inside 8/12 they sit about 280px apart and read
// as one block.
const LINK_GRID_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

// The heading treatment shared by the menu columns and the app-store column,
// so a column that comes from settings and one that comes from code cannot
// drift apart visually.
function ColumnHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-secondary-foreground">
      <span className="text-xs font-semibold tracking-[0.14em] uppercase">{children}</span>
      {/* Short rule under the heading. currentcolor, so it inherits the
          band's own legible ink instead of asking a brand token to work on
          a surface it was never derived against. */}
      <span aria-hidden className="mt-2 block h-0.5 w-8 rounded-full bg-current opacity-30" />
    </h2>
  );
}

export async function SiteFooter({ locale }: { locale: string }) {
  const [
    t,
    siteName,
    siteDescription,
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
    getSetting("site.description"),
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
  const allColumns = await Promise.all(
    (menuColumns ?? [])
      .toSorted((a, b) => a.order - b.order)
      .map((column) => buildMenu(column.menuKey, locale, null)),
  );
  // A menu whose every item was pruned (feature flag off, all items
  // inactive) must not reserve a grid cell — otherwise turning `courses` off
  // leaves a titled, empty column behind.
  const columns = allColumns.filter((column) => column.items.length > 0);

  const footerSocials = socialLinks.filter((link) => link.showInFooter);
  const platformLinks = appLinks ?? [];
  const linkCellCount = columns.length + (platformLinks.length > 0 ? 1 : 0);

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
      {/* Ambient brand wash — the one large-area use of --primary this band
          allows (the same utility the header uses). Sits UNDER the dot grid
          at low strength so it reads as depth, not as a colour block. */}
      <div
        aria-hidden
        className="bg-glow-primary pointer-events-none absolute inset-0 opacity-70"
      />
      {/* Hairline that separates the band from the page above it. A gradient
          rather than a flat border so the footer starts softly at the edges
          and is most defined under the content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-25"
      />

      <div className="relative">
        <Container>
          {/* ── Band 1: brand identity + every menu ─────────────────── */}
          {/* One row, twelve tracks: brand on four, the whole sitemap on
              eight. Keeping the links beside the brand rather than in a band
              of their own is what stops three columns from floating in
              1400px of empty secondary. */}
          <div className="grid gap-x-8 gap-y-12 pt-14 pb-10 lg:grid-cols-12 lg:gap-x-12">
            <Reveal variant="up" className="lg:col-span-4">
              <div className="flex flex-col items-start gap-5">
                {/* Uploaded logo (ADR-017) via the shared BrandLogo, with
                    light/dark passed SWAPPED on purpose: this band is always
                    the opposite of the page's own light/dark state
                    (--secondary flips with mode), so it needs the light-ink
                    mark exactly when the header needs the dark-ink one. The
                    inversion is this call site's business — expressing it as
                    swapped props keeps a band-specific special case out of
                    the shared component. */}
                <Link
                  href="/"
                  className="flex w-fit items-center truncate transition-transform duration-(--duration-base) ease-(--ease-out-quint) hover:scale-[1.03]"
                >
                  <BrandLogo
                    light={brandAssets.logo_dark?.url ?? null}
                    dark={brandAssets.logo_light?.url ?? null}
                    alt={siteName ?? ""}
                    className="h-11"
                    fallback={<span className="text-xl font-semibold">{siteName}</span>}
                  />
                </Link>

                {siteDescription && (
                  <p className="max-w-md text-sm leading-relaxed text-secondary-foreground/80">
                    {siteDescription}
                  </p>
                )}

                {footerSocials.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold tracking-[0.14em] text-secondary-foreground/70 uppercase">
                      {t("followUs")}
                    </p>
                    <ul className="flex flex-wrap items-center gap-2.5">
                      {footerSocials.map((link) => (
                        <li key={link.platform}>
                          <a
                            href={link.url}
                            aria-label={link.label}
                            // The one brand FILL on this band: --primary with
                            // its own paired --primary-foreground ink, which
                            // IS contrast-guaranteed (readableOn in
                            // @repo/theme). Rule 5 permits exactly this.
                            className="flex size-10 items-center justify-center rounded-full bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/15 transition-[background-color,color,transform,box-shadow] duration-(--duration-base) ease-(--ease-out-quint) ring-inset hover:-translate-y-0.5 hover:scale-105 hover:bg-primary hover:text-primary-foreground hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:bg-primary focus-visible:text-primary-foreground"
                            {...(link.openInNewTab
                              ? { target: "_blank", rel: "noopener noreferrer" }
                              : {})}
                          >
                            {/* The accessible name is the <a>'s aria-label — the
                                glyph itself stays decorative. */}
                            <SocialLinkIcon icon={link.icon} iconUrl={link.iconUrl} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Reveal>

            {linkCellCount > 0 && (
              <div
                className={`grid gap-x-8 gap-y-10 lg:col-span-8 ${LINK_GRID_CLASS[linkCellCount] ?? "grid-cols-2 sm:grid-cols-3"}`}
              >
                {columns.map((column, index) => {
                  const headingId = `footer-col-${column.key}`;
                  return (
                    // Staggered entrance: each column arrives just after the
                    // one before it, which reads as one movement rather than
                    // four simultaneous ones. Best-effort under a scroll
                    // timeline (see Reveal's own note) — never load-bearing.
                    <Reveal key={column.key} variant="up" delay={index * 70}>
                      <nav aria-labelledby={headingId} className="flex flex-col gap-4">
                        <ColumnHeading id={headingId}>{column.name ?? ""}</ColumnHeading>
                        <ul className="flex flex-col gap-0.5">
                          {column.items.map((item) => (
                            <li key={item.id}>
                              <NavLink
                                href={item.href}
                                isExternal={item.isExternal}
                                openInNewTab={item.openInNewTab}
                                // aria-[current=page]:text-secondary-foreground
                                // overrides NavLink's own
                                // aria-[current=page]:text-foreground, which is
                                // the PAGE's ink and has no contrast guarantee
                                // on this inverted band.
                                className="group/link -ms-2 flex items-center gap-0 rounded-md px-2 py-1.5 text-sm font-normal text-secondary-foreground/80 hover:bg-secondary-foreground/[0.07] hover:text-secondary-foreground aria-[current=page]:font-medium aria-[current=page]:text-secondary-foreground"
                              >
                                {/* Marker rule that grows out of the inline
                                    START on hover — a logical inline-size, so
                                    it runs the correct way in RTL with no
                                    [dir] rule of its own. */}
                                <span
                                  aria-hidden
                                  className="h-px w-0 shrink-0 bg-current opacity-70 transition-[width,margin] duration-(--duration-base) ease-(--ease-out-quint) group-hover/link:me-2 group-hover/link:w-3 group-focus-visible/link:me-2 group-focus-visible/link:w-3"
                                />
                                <span className="truncate">{item.label}</span>
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    </Reveal>
                  );
                })}

                {platformLinks.length > 0 && (
                  <Reveal variant="up" delay={columns.length * 70}>
                    <div className="flex flex-col gap-4">
                      <ColumnHeading id="footer-col-apps">{t("getTheApp")}</ColumnHeading>
                      <ul className="flex flex-col gap-2">
                        {platformLinks.map((link) => {
                          const Icon =
                            APP_PLATFORM_ICON[link.platform as keyof typeof APP_PLATFORM_ICON] ??
                            Smartphone;
                          return (
                            <li key={link.platform}>
                              {/* .hover-lift declares its own `transition`
                                  shorthand and, being hand-written, wins over
                                  Tailwind's transition utilities — so this
                                  element deliberately carries none of its own.
                                  `group` is for the chevron's .hover-arrow. */}
                              <a
                                href={link.url}
                                className="hover-lift group flex items-center gap-2.5 rounded-lg bg-secondary-foreground/[0.07] px-3 py-2.5 text-sm text-secondary-foreground ring-1 ring-secondary-foreground/12 ring-inset hover:ring-secondary-foreground/30"
                              >
                                <Icon aria-hidden className="size-4 shrink-0 opacity-80" />
                                <span className="truncate">
                                  {t(`appPlatform.${link.platform}`)}
                                </span>
                                <ChevronRight
                                  aria-hidden
                                  className="hover-arrow ms-auto size-4 shrink-0 opacity-50 rtl:rotate-180"
                                />
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </Reveal>
                )}
              </div>
            )}
          </div>

          {/* ── Band 2: newsletter ───────────────────────────────────── */}
          {newsletterEnabled && (
            <div className="border-t border-secondary-foreground/12 py-8">
              {/* .sheen supplies its own position/overflow/isolation, so no
                  Tailwind `relative` here — and nothing that sets `position`
                  may follow it in the class list (the cascade trap
                  globals.css documents beside .pulse-ring). A full-width
                  strip rather than a card beside the brand: the sweep has
                  room to travel, and the form is not competing with the
                  sitemap for the same eye. */}
              <div className="sheen rounded-2xl bg-secondary-foreground/[0.06] p-6 ring-1 ring-secondary-foreground/12 ring-inset sm:p-7">
                <div className="relative z-[2] flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
                  <div className="flex flex-col gap-1.5 md:max-w-lg">
                    <p className="text-base font-semibold text-secondary-foreground">
                      {t("newsletterHeading")}
                    </p>
                    <p className="text-sm leading-relaxed text-secondary-foreground/75">
                      {t("newsletterBlurb")}
                    </p>
                  </div>
                  <div className="w-full md:max-w-sm md:shrink-0">
                    <NewsletterForm
                      tone="onSecondary"
                      placeholder={t("newsletterPlaceholder")}
                      label={t("newsletterLabel")}
                      submitLabel={t("newsletterSubmit")}
                      unavailableLabel={t("newsletterUnavailable")}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Band 3: legal ────────────────────────────────────────── */}
          <div className="flex flex-col gap-6 border-t border-secondary-foreground/12 py-8">
            {disclaimer && (
              // Given a label and an inset panel rather than left as loose
              // grey text: a forex risk disclaimer is the one paragraph down
              // here a regulator expects to find, and an unlabelled run of
              // 11px prose reads as boilerplate nobody meant to be read.
              <div className="rounded-xl border-s-2 border-secondary-foreground/25 bg-secondary-foreground/[0.04] px-4 py-3.5">
                <p className="text-xs font-semibold tracking-[0.12em] text-secondary-foreground/70 uppercase">
                  {t("riskDisclaimerLabel")}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-secondary-foreground/75">
                  {disclaimer}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 text-xs text-secondary-foreground/70 sm:flex-row sm:items-center sm:justify-between">
              <p>{copyrightLine}</p>
              {showPaymentBadges && <p>{t("paymentMethods")}</p>}
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
