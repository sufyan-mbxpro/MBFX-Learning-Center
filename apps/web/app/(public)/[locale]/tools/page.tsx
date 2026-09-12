import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS, TOOLS, toolPath } from "@repo/contracts";
import { getEnabledTools } from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Section } from "@repo/ui/components/section";
import { ArrowRight } from "lucide-react";
import { TOOL_ICONS } from "./_components/tool-icons.ts";
import { RiskDisclaimer } from "../_sections/risk-disclaimer.tsx";

// `/tools` (changes-25 T6, ADR-086).
//
// This REPLACES the `ComingSoon` render ADR-081 #1 put here. The page is
// indexable now — the `robots: { index: false }` line goes with the
// placeholder, because there is something to index.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tools">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "tools" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("index.title")),
    description: t("index.lead"),
    alternates: { canonical: ROUTE_PATHS.tools },
  };
}

export default async function ToolsPage({ params }: PageProps<"/[locale]/tools">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The flag gates the whole area. A flag-off section 404s rather than
  // rendering an empty shell (changes-11 D25's rule).
  if (!(await isFeatureVisible("calculators", null))) notFound();

  const [t, tools] = await Promise.all([
    getTranslations({ locale, namespace: "tools" }),
    getEnabledTools(locale),
  ]);

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} title={t("index.title")} lead={t("index.lead")} />

      <Section>
        <Container>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => {
              const Icon = TOOL_ICONS[tool.key];
              return (
                <li key={tool.key}>
                  {/* A whole-card stretched link, like QuizCard: everything
                      in the card leads to the same one place, so there is no
                      second target to keep clickable. */}
                  <Card className="relative h-full transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive">
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <Link
                        href={toolPath(tool.key)}
                        className="font-medium after:absolute after:inset-0 hover:underline"
                      >
                        {tool.title}
                      </Link>
                      {tool.tagline && (
                        <p className="text-sm text-muted-foreground">{tool.tagline}</p>
                      )}
                      <span className="mt-auto flex items-center gap-1 pt-2 text-sm text-primary-interactive">
                        {t("index.open")}
                        <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                      </span>
                      {/* What a tool needs, said plainly: five of the eight
                          answer with no market data at all, and a reader on a
                          fresh instance should know which. */}
                      <span className="sr-only">{t(`index.needs.${TOOLS[tool.key].needs}`)}</span>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <RiskDisclaimer />
    </>
  );
}
