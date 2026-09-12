import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { getSetting } from "@repo/settings";
import { ComingSoon } from "../_components/coming-soon.tsx";

// `/markets` (changes-22). A real route for a destination the header, the footer
// and the homepage carousel all name — it used to fall through the
// `[...slug]` catch-all onto the site's 404.
//
// `noindex, follow`: there is nothing here to index yet, but the four links
// out of it go to pages there certainly are.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/markets">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "public" }),
    getSetting("seo.titleTemplate"),
  ]);
  const section = t("marketsTitle");
  return {
    title: (template ?? "%s").replace("%s", section),
    description: t("comingSoonLead"),
    robots: { index: false, follow: true },
    alternates: { canonical: ROUTE_PATHS.markets },
  };
}

export default async function MarketsPage({ params }: PageProps<"/[locale]/markets">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComingSoon section="markets" />;
}
