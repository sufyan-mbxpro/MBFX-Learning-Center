import { getTranslations, setRequestLocale } from "next-intl/server";
import { getEnabledTools } from "@repo/core";
import { toolPath } from "@repo/contracts";
import { SectionNav, type SectionNavItem } from "../_components/section-nav.tsx";

// The tools area's shell (changes-25 T6, ADR-086 #9).
//
// **The one section bar** (ADR-076 §1, extended to the glossary by ADR-081 #4
// and to tools here): `SectionNav`, not a second strip of the reference's own
// shape. It pins at `top-(--header-offset)`, a live measurement
// `StickyHeaderShell` publishes — `top-16` is wrong the moment the
// announcement bar is on.
//
// **A disabled tool is ABSENT from the bar, not disabled in it** (ADR-086 #5).
// Its route already 404s, and a tab that leads to a 404 is worse than no tab —
// the learn area's rule (changes-11 D25) verbatim.
export default async function ToolsLayout({ children, params }: LayoutProps<"/[locale]/tools">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tools] = await Promise.all([
    getTranslations({ locale, namespace: "tools" }),
    getEnabledTools(locale),
  ]);

  const items: SectionNavItem[] = tools.map((tool) => ({
    href: toolPath(tool.key),
    label: tool.title,
  }));

  return (
    <>
      {/* A row of one tab is chrome that tells the reader nothing — the same
          rule the learn bar and GlossaryTabs already follow. */}
      {items.length > 1 && <SectionNav items={items} ariaLabel={t("nav.sectionLabel")} />}
      {children}
    </>
  );
}
