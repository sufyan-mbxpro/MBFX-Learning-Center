// The glossary's two browse modes (changes-11 Phase 10, D27).
//
// A real `<nav>` of links, not a client tab strip: A–Z and Browse-by-topic are
// two ROUTES with two sets of URLs, and D26's rule is explicit that a filter
// creating a collection is a route while one narrowing an on-page set is
// client state. The A–Z chips inside `/glossary` are the second kind; these
// are the first.
//
// ─── It IS the section bar now (changes-22) ────────────────────────────────
//
// This used to be a hand-rolled underline strip: a 2px bottom border on the
// current entry and a text-colour change on hover. Against the pinned,
// brand-tinted bar About and both learning schools share (ADR-076 §1) it read
// as a different site's furniture — and the hover, being ink-only, was almost
// invisible next to it (ADR-051 §6 says as much: beside a filled active pill,
// a hover that only changes text colour is no hover at all).
//
// So it delegates to `SectionNav`. What stays here is the one rule that is the
// glossary's own: a strip of ONE entry is not navigation, and it renders
// nothing until at least one topic has published terms — which is what keeps a
// database with no topics looking exactly as it did before Phase 10.
//
// `current` is gone with it: `SectionNav` derives the active entry from the
// pathname by longest prefix, so `/glossary/topics/<topic>` lights up Browse
// by topic without every page having to name itself.
import { ROUTE_PATHS } from "@repo/contracts";
import { SectionNav } from "../../_components/section-nav.tsx";

export interface GlossaryTabItem {
  href: string;
  label: string;
}

export function GlossaryTabs({
  items,
  ariaLabel,
}: {
  items: GlossaryTabItem[];
  ariaLabel: string;
}) {
  if (items.length < 2) return null;
  return <SectionNav items={items} ariaLabel={ariaLabel} />;
}

export const GLOSSARY_PATH = ROUTE_PATHS.glossary;
export const GLOSSARY_TOPICS_PATH = `${ROUTE_PATHS.glossary}/topics`;
