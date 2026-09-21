import { jsonLd, localizedPath } from "../../../_lib/seo.ts";
import { siteUrl } from "../../../_lib/site-url.ts";

// `BreadcrumbList` structured data for a trail a page already DRAWS.
//
// Only ever rendered beside a visible breadcrumb, never instead of one: the
// markup describes navigation the reader can see, which is the condition
// search engines attach to it. Hrefs arrive locale-less, the way the visible
// trail's `<Link>` takes them, and leave as absolute localised URLs. The
// current page carries no `item` — schema.org allows it, and it is the one
// crumb that is not a link.
export interface JsonLdCrumb {
  label: string;
  /** Locale-less path; omitted for the current page. */
  href?: string;
}

export function BreadcrumbJsonLd({ locale, crumbs }: { locale: string; crumbs: JsonLdCrumb[] }) {
  if (crumbs.length < 2) return null;
  const origin = siteUrl();
  const graph = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: `${origin}${localizedPath(locale, crumb.href)}` } : {}),
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />;
}
