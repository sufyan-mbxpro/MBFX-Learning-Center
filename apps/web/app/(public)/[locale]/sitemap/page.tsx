import type { Metadata } from "next";
import { localizedPath } from "../../../_lib/seo.ts";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink } from "lucide-react";

import { buildMenu } from "@repo/core";
import {
  LEGAL_DOCUMENT_KEYS,
  LEGAL_DOCUMENT_SETTING,
  legalDocumentPath,
  ROUTE_PATHS,
} from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { SitemapBackdrop } from "./_components/sitemap-backdrop.tsx";

// `/sitemap` — the reader's sitemap (changes-33, ADR-110).
//
// Not `sitemap.xml`, which already exists and is for crawlers. The footer row
// the reference carries is for a PERSON who cannot find something, and handing
// them raw XML is a worse answer than no link at all.
//
// **It is built from the footer's own menus, not from a list typed here.**
// That is the whole design: the footer is already a sitemap (Module 08 — three
// seeded menus covering every header destination), so this page reads the same
// `footer.menuColumns` setting and the same `buildMenu`, and inherits every
// rule that comes with them — a feature-flagged section prunes, an empty
// column disappears, an admin's reordering shows up here too. A second
// hand-maintained list is how a sitemap ends up advertising a page that was
// deleted two releases ago.
//
// The one thing it adds that the footer's columns do not carry is the legal
// documents, which are files rather than pages and so have never been menu
// rows.

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sitemap">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "public" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("sitemap.title")),
    description: t("sitemap.lead"),
    alternates: { canonical: localizedPath(locale, ROUTE_PATHS.sitemap) },
    // Deliberately NO `robots` key, not even `{ index: true }`: a present key
    // replaces the root layout's site-wide directive rather than inheriting
    // it (code-style.md #26, ADR-090). This page is indexable, which is what
    // inheriting already gives it.
  };
}

export default async function SitemapPage({ params }: PageProps<"/[locale]/sitemap">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, menuColumns, legalValues] = await Promise.all([
    getTranslations({ locale, namespace: "public" }),
    getSetting("footer.menuColumns"),
    Promise.all(LEGAL_DOCUMENT_KEYS.map((key) => getSetting(LEGAL_DOCUMENT_SETTING[key]))),
  ]);
  const tFooter = await getTranslations({ locale, namespace: "footer" });

  const built = await Promise.all(
    (menuColumns ?? [])
      .toSorted((a, b) => a.order - b.order)
      .map((column) => buildMenu(column.menuKey, locale, null)),
  );
  const columns = built.filter((column) => column.items.length > 0);

  const legalLinks = LEGAL_DOCUMENT_KEYS.flatMap((key, index) =>
    legalValues[index]
      ? [{ key, href: legalDocumentPath(key), label: tFooter(`legalDocument.${key}`) }]
      : [],
  );

  return (
    <main className="flex flex-col">
      <PageHero
        backdrop={<SitemapBackdrop slot="banner" />}
        motif={<AmbientMotif variant="learn" intensity={0.6} />}
        eyebrow={t("sitemap.eyebrow")}
        title={t("sitemap.title")}
        lead={t("sitemap.lead")}
      />

      <Section spacing="lg">
        <Container>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((column, index) => {
              const headingId = `sitemap-${column.key}`;
              return (
                <Reveal key={column.key} variant="up" delay={index * 70}>
                  <nav
                    aria-labelledby={headingId}
                    className="flex h-full flex-col gap-4 rounded-xl border bg-card p-6"
                  >
                    <h2 id={headingId} className="text-base font-semibold text-card-foreground">
                      {column.name ?? ""}
                    </h2>
                    <ul className="flex flex-col gap-1">
                      {column.items.map((item) => (
                        <li key={item.id}>
                          {/* A menu row can be an external URL (Module 08's
                              exactly-one rule), so the two branches are not
                              interchangeable: `Link` would locale-prefix an
                              absolute URL. */}
                          {item.isExternal ? (
                            <a
                              href={item.href}
                              {...(item.openInNewTab
                                ? { target: "_blank", rel: "noopener noreferrer" }
                                : {})}
                              className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground transition-colors duration-(--duration-base) hover:text-foreground"
                            >
                              {item.label}
                              <ExternalLink aria-hidden className="size-3 shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <Link
                              href={item.href}
                              className="block py-1 text-sm text-muted-foreground transition-colors duration-(--duration-base) hover:text-foreground"
                            >
                              {item.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </nav>
                </Reveal>
              );
            })}

            {legalLinks.length > 0 && (
              <Reveal variant="up" delay={columns.length * 70}>
                <nav
                  aria-labelledby="sitemap-legal"
                  className="flex h-full flex-col gap-4 rounded-xl border bg-card p-6"
                >
                  <h2 id="sitemap-legal" className="text-base font-semibold text-card-foreground">
                    {tFooter("legalNavLabel")}
                  </h2>
                  <ul className="flex flex-col gap-1">
                    {legalLinks.map((link) => (
                      <li key={link.key}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground transition-colors duration-(--duration-base) hover:text-foreground"
                        >
                          {link.label}
                          <ExternalLink aria-hidden className="size-3 shrink-0 opacity-70" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </Reveal>
            )}
          </div>
        </Container>
      </Section>
    </main>
  );
}
