// The About section shell (ADR-047): the icon sub-nav every page in the
// section shares, plus the one `Organization` JSON-LD graph that describes
// the site itself. Per-page graphs (`AboutPage`, `FAQPage`) belong to their
// own routes — this one is site-level and must not be emitted five times.
//
// The five destinations come from ABOUT_ROUTE_KEYS, so the strip cannot
// drift from the sitemap or the mega-menu panel: all three enumerate the
// same registry.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { getSetting } from "@repo/settings";
import { IS_DEMO_CONTENT } from "./_content/about-content-mode.ts";
import { SectionNav, type SectionNavItem } from "./_components/section-nav.tsx";

export default async function AboutLayout({ children, params }: LayoutProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, common, siteName] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getTranslations({ locale, namespace: "common" }),
    getSetting("site.name"),
  ]);

  // Labels only — SectionNav resolves each entry's icon itself, because a
  // component cannot cross the server/client boundary as a prop.
  const items: SectionNavItem[] = [
    { href: ROUTE_PATHS.about, label: t("nav.aboutUs") },
    { href: ROUTE_PATHS["about-why-us"], label: t("nav.whyUs") },
    { href: ROUTE_PATHS["about-transparency"], label: t("nav.transparency") },
    { href: ROUTE_PATHS["about-security"], label: t("nav.security") },
    { href: ROUTE_PATHS["about-support"], label: t("nav.support") },
  ];

  // Only fields we can state truthfully from data we hold: the site's own
  // name and description. No address, no founding date, no legal name —
  // ADR-047 §2 applies to structured data exactly as it applies to visible
  // copy, and a fabricated `Organization` graph is worse than none.
  //
  // This does NOT grow when ABOUT_CONTENT_MODE is "demo" (ADR-051 §3). Visible
  // copy is read by someone who can see the page it sits on; a JSON-LD graph
  // is machine-read, syndicated and cached out of context, so a placeholder
  // `foundingDate` or `award` here outlives the page it came from. Demo mode
  // is a rendering state, never a publishing claim.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName ?? common("siteName"),
    description: common("siteDescription"),
  };

  return (
    // data-about-content is how a reviewer, an operator or a test tells the
    // two states apart without a banner across the design (ADR-051 §3).
    <main className="flex flex-col" data-about-content={IS_DEMO_CONTENT ? "demo" : "real"}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SectionNav items={items} ariaLabel={t("nav.sectionLabel")} />
      {children}
    </main>
  );
}
