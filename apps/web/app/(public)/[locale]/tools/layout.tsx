import { setRequestLocale } from "next-intl/server";

// The tools area's shell (changes-25 T6, ADR-086 #9 — reduced to a landmark
// by changes-33, ADR-112).
//
// **There is no section bar here any more.** It pinned under the header and
// listed all eight tools, which on a 1440px screen was a horizontally
// SCROLLING strip: opening one calculator put a second, wider navigation bar
// across the page, and the tool the reader had just chosen was the only thing
// it could tell them. The eight are already listed twice — in the Tools mega
// panel, grouped by what a reader is trying to do, and on `/tools` itself —
// and `RelatedStrip` at the foot of each tool page offers the neighbours in
// context. A third list, permanently on screen, was the one that had to go.
//
// ADR-076 §1's "one section bar" rule is not repealed: the learn area and the
// glossary still have theirs, and for the reason that rule gives — their
// surfaces are DIFFERENT KINDS of thing (courses, videos, quizzes, a
// glossary) and a reader moves between them while studying. Eight
// calculators are the same kind of thing, used one at a time.
//
// The layout itself stays, because the `<main>` landmark is why it exists:
// the eight tool pages and the index open no landmark of their own, which
// axe reports as a moderate `region` violation — under the serious/critical
// gate the suite runs, so it would slip past silently.
export default async function ToolsLayout({ children, params }: LayoutProps<"/[locale]/tools">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <main className="flex flex-col">{children}</main>;
}
