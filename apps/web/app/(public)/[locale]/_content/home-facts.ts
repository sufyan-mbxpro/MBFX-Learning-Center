// The three owner-supplied home bands (ADR-103) — the About section's content
// module (ADR-047 §3) applied to the home page, and the second instance of
// ADR-051 §1's two-state switch.
//
// Three rules govern this file, and they are the whole point of it:
//
//   1. An EMPTY collection renders NOTHING. Not a placeholder, not a heading
//      over an empty grid, not a zero — a zero is a claim about the data.
//      A band whose data is missing is absent from the page.
//   2. A FIGURE here is a FACT, never a COUNT. ADR-076 banned counted totals
//      of courses, lessons and terms from public pages because those are an
//      operator's numbers: they move when an editor saves, they measure us
//      rather than telling the reader anything, and a low one argues against
//      the page it sits on. What belongs here is what the owner vouches for.
//   3. Nothing here reads the database. No I/O, no @repo/db, no
//      @repo/settings — these are plain modules the pages read at build time.
//
// Qualitative wording still lives in the catalogs (`home.*`); what lives here
// is what is visibly the OWNER's to supply.
import type { MessageKey } from "@repo/i18n";
import { HOME_CONTENT_MODE } from "./home-content-mode.ts";
import { DEMO_HOME_FACTS } from "./home-facts.demo.ts";

/**
 * A key in the `home` namespace, in the shape `getTranslations("home")` takes
 * it. Derived from the English catalog by `@repo/i18n`, so a renamed or
 * deleted key is a compile error here rather than a blank line on the page.
 */
export type HomeKey = MessageKey<"home">;

/** One figure in the facts band. `value` stays a number so `Counter` can count to it. */
export interface HomeFact {
  /** Stable id — the React key, and what an icon is matched on. */
  key: string;
  value: number;
  /** Rendered after the number, unlocalized: "+", "K+", "%". */
  suffix?: string;
  /** Rendered before it: a currency mark. */
  prefix?: string;
  labelKey: HomeKey;
}

/**
 * One partner, accreditation or publication in the trust strip.
 *
 * `name` is a real organisation's name, so it is NOT a catalog string — a
 * translated company name is a different company. `logo` is a path under
 * `public/`; a null one renders the name as a wordmark instead, which is a
 * legitimate finished state rather than a missing image.
 */
export interface HomePartner {
  key: string;
  name: string;
  logo: string | null;
  /** Where the claim can be checked. Null renders the mark unlinked. */
  href: string | null;
}

/**
 * One testimonial. `quote` is a real person's words, `name` and `role` are
 * facts about them — none of the three is a catalog string, for the same
 * reason a company name is not. A translated testimonial is a testimonial
 * nobody gave.
 */
export interface HomeTestimonial {
  key: string;
  quote: string;
  name: string;
  role: string;
  /** A path under `public/`. Null renders the initial instead of a portrait. */
  avatar: string | null;
}

export interface HomeFacts {
  facts: HomeFact[];
  partners: HomePartner[];
  testimonials: HomeTestimonial[];
}

/**
 * What the OWNER has actually supplied. Empty, and governed by every word of
 * ADR-103 §3: an empty collection renders nothing. This is what renders the
 * moment HOME_CONTENT_MODE is "real".
 */
export const REAL_HOME_FACTS: HomeFacts = {
  // TODO(owner): headline facts about MBX — learners taught, years running,
  // languages served, hours of material. Each needs a matching `home.fact*`
  // catalog key for its label. NEVER a row count (ADR-103 §1). Empty ⇒ no
  // facts band renders.
  facts: [],

  // TODO(owner): partners, accreditations or publications MBX genuinely has a
  // relationship with, and a URL where each can be checked. Empty ⇒ no trust
  // strip. Never populate this speculatively — a logo is a claim about
  // someone else, and an unearned one misrepresents THEM, not just us.
  partners: [],

  // TODO(owner): testimonials actually given, with permission to publish, in
  // the words the person used. Empty ⇒ no testimonials band.
  testimonials: [],
};

/**
 * The dataset the sections read (ADR-051 §1, ADR-103 §4).
 *
 * One switch, no per-field merge. A build renders all placeholder content or
 * none of it, because a half-real home page — where nobody can tell which
 * figure was ever checked — is worse than either pure state.
 */
export const HOME_FACTS: HomeFacts =
  HOME_CONTENT_MODE === "demo" ? DEMO_HOME_FACTS : REAL_HOME_FACTS;
