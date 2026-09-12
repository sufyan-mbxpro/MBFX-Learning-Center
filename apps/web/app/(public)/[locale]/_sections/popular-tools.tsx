import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { toolPath } from "@repo/contracts";
import { getEnabledTools } from "@repo/core";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { TOOL_ICONS } from "../tools/_components/tool-icons.ts";
import type { SectionProps } from "./registry.ts";

// The homepage's tools band (changes-25 T9).
//
// **It reads the same `getEnabledTools` the section bar and the index do**, in
// the same `sortOrder`, so an admin who reorders the tools reorders this band
// too — from one edit, in one place.
//
// **Nothing renders when the flag is off or no tool is live.** A heading over
// an empty grid is worse than the section not being there, which is the rule
// every other homepage band already follows.
export async function PopularTools({ locale, limit }: SectionProps) {
  if (!(await isFeatureVisible("calculators", null))) return null;

  const [t, tools] = await Promise.all([
    getTranslations({ locale, namespace: "tools" }),
    getEnabledTools(locale),
  ]);

  const shown = tools.slice(0, limit ?? 4);
  if (shown.length === 0) return null;

  return (
    <Section tone="muted">
      <Container>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("home.title")}
          lead={t("home.lead")}
        />
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((tool) => {
            const Icon = TOOL_ICONS[tool.key];
            return (
              <li key={tool.key}>
                {/* A whole-card stretched link: everything in it leads to the
                    same one place, so there is no second target to protect. */}
                <Card className="relative h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive">
                      <Icon aria-hidden className="size-4.5" />
                    </span>
                    <Link
                      href={toolPath(tool.key)}
                      className="font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {tool.title}
                    </Link>
                    {tool.tagline && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{tool.tagline}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex justify-center">
          <Button variant="outline" render={<Link href="/tools" />}>
            {t("home.viewAll")}
            <ArrowRight aria-hidden data-icon="inline-end" className="rtl:rotate-180" />
          </Button>
        </div>
      </Container>
    </Section>
  );
}
