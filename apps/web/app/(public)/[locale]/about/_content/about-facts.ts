// The About section's facts (ADR-047 §2, amended by ADR-051 §1).
//
// ADR-051 added a SECOND dataset — `about-facts.demo.ts`, all of it invented —
// and one switch that picks between them. What follows describes the real one,
// which is what ships the moment ABOUT_CONTENT_MODE is "real".
//
// ONE module holds every claim of fact the five About pages can make —
// counts, dates, regulators, awards, support channels, payment methods. Two
// rules govern it, and they are the whole point of the file:
//
//   1. An EMPTY collection renders NOTHING. Not a placeholder, not a zero,
//      not a heading over an empty grid. A section whose data is missing is
//      absent from the page. The pages start shorter than their reference
//      and grow as the owner fills this in.
//   2. Nothing quantitative or regulatory lives in the message catalogs.
//      Catalog strings describe how MBFX works — qualitative, checkable
//      against the product. Numbers and named authorities come from here,
//      where they are visibly the owner's to supply.
//
// No I/O, no imports from @repo/db or @repo/settings: this is data the
// pages read at build time, so it stays a plain module (architecture.md #1
// — logic that would need rewriting for a native screen doesn't belong in
// the app, and this isn't logic at all).

import type { MessageKey } from "@repo/i18n";
import { ABOUT_CONTENT_MODE } from "./about-content-mode.ts";
import { DEMO_ABOUT_FACTS } from "./about-facts.demo.ts";

/**
 * A key in the `about` namespace, in the shape `getTranslations("about")`
 * takes it. Derived from the English catalog by `@repo/i18n`, so a renamed
 * or deleted key is a compile error here rather than a blank line on the
 * page.
 */
export type AboutKey = MessageKey<"about">;

/** One animated figure in a stat band. `value` stays a number so `Counter` can count to it. */
export interface AboutStat {
  value: number;
  /** Rendered after the number, unlocalized: "+", "K+", "%". */
  suffix?: string;
  labelKey: AboutKey;
}

/** One node on the company timeline. */
export interface TimelineEntry {
  year: number;
  titleKey: AboutKey;
  bodyKey: AboutKey;
}

/** One industry award. `issuer` and `year` are facts, so they are NOT catalog strings. */
export interface Award {
  titleKey: AboutKey;
  issuer: string;
  year: number;
}

/**
 * One jurisdiction MBFX operates in, and the authorities there. `x`/`y` are
 * percentages of the map's box, so the pin math is resolution-independent.
 */
export interface Jurisdiction {
  /** ISO 3166-1 alpha-2, used as the React key and the pin's label. */
  code: string;
  nameKey: AboutKey;
  bodies: string[];
  x: number;
  y: number;
}

/**
 * A way to reach support. `value` is a real address/number/handle — a fact,
 * not a translatable string; `hours` carries its own human text because
 * opening hours are a fact too, and a wrong translation of them is worse
 * than an untranslated one.
 */
export interface SupportChannel {
  kind: "email" | "phone" | "whatsapp" | "hours";
  value: string;
}

export interface AboutFacts {
  /** Null until the owner supplies it — the "since YYYY" line is omitted while it is. */
  foundedYear: number | null;
  stats: AboutStat[];
  timeline: TimelineEntry[];
  awards: Award[];
  jurisdictions: Jurisdiction[];
  support: { channels: SupportChannel[] };
  /** Payment-method names, matched to glyphs by the payments strip. */
  payments: string[];
}

/**
 * What the OWNER has actually supplied. Still empty, still governed by every
 * word of ADR-047 §2: an empty collection renders nothing. ADR-051 did not
 * repeal that rule — it added a second dataset beside this one, and this is
 * what renders again the moment ABOUT_CONTENT_MODE is "real".
 */
export const REAL_ABOUT_FACTS: AboutFacts = {
  // TODO(owner): the year MBFX Learning Center started operating.
  foundedYear: null,

  // TODO(owner): headline figures. Each needs a matching `about.overview.stats.*`
  // catalog key for its label. Empty ⇒ no stat band renders.
  stats: [],

  // TODO(owner): company milestones, oldest first. Each entry needs
  // `about.overview.timeline.*` title and body keys. Empty ⇒ no timeline.
  timeline: [],

  // TODO(owner): awards actually received. Empty ⇒ no awards grid. Never
  // populate this speculatively — an unearned award is the worst possible
  // thing to render.
  awards: [],

  // TODO(owner): the places MBFX has people, and the teams there. NOT a list
  // of regulators (ADR-051 §4) — naming an authority MBFX does not answer to
  // is a misrepresentation of that authority, not just of MBFX. Empty ⇒ no
  // map and no legend on /about/security.
  jurisdictions: [],

  // TODO(owner): support hours and contact channels. Empty ⇒ /about/support
  // renders its tiles without a channel list.
  support: { channels: [] },

  // TODO(owner): accepted payment methods. Empty ⇒ no payments strip.
  payments: [],
};

/**
 * The dataset the pages read (ADR-051 §1).
 *
 * One switch, no per-field merge. A build renders all placeholder facts or
 * none of them, because a half-real About section — where nobody can tell
 * which number was ever checked — is worse than either pure state.
 */
export const ABOUT_FACTS: AboutFacts =
  ABOUT_CONTENT_MODE === "demo" ? DEMO_ABOUT_FACTS : REAL_ABOUT_FACTS;

/** True when a section's data is present. Reads better at the call site than `.length > 0`. */
export function hasFacts<T>(collection: readonly T[]): boolean {
  return collection.length > 0;
}
