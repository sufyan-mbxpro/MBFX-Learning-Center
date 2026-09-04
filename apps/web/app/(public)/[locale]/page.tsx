import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { SECTION_COMPONENTS } from "./_sections/registry.ts";

// Homepage assembled from the admin-configured section registry
// (home.sections setting): order, visibility, layout VARIANT and item COUNT
// are all DATA — an admin reorders, disables or re-styles a section without
// a deploy (changes-03-plan.md §5.1, Phase A).
//
// The switch this used to carry is now `_sections/registry.ts`; sections
// whose feature verticals haven't landed still render as named stubs, so
// the assembly stays honest about what's driven by config.
async function SectionStub({ sectionKey }: { sectionKey: string }) {
  const t = await getTranslations("home");
  return (
    <Section spacing="sm">
      <Container>
        <div className="flex items-center justify-between rounded-lg border border-dashed p-6 text-muted-foreground">
          <span className="text-sm font-medium capitalize">
            {sectionKey.replaceAll("_", " ")}
          </span>
          <span className="text-xs">{t("sectionStub")}</span>
        </div>
      </Container>
    </Section>
  );
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sections = (await getSetting("home.sections")) ?? [];
  const enabled = sections.filter((s) => s.enabled).toSorted((a, b) => a.order - b.order);

  return (
    <main className="flex flex-col">
      {enabled.map((section) => {
        const Component = SECTION_COMPONENTS[section.key];
        if (!Component) return <SectionStub key={section.key} sectionKey={section.key} />;
        return (
          <Component
            key={section.key}
            locale={locale}
            variant={section.variant}
            limit={section.limit}
          />
        );
      })}
    </main>
  );
}
