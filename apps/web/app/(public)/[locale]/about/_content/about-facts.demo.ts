// PLACEHOLDER About-section data (ADR-051).
//
// ============================================================================
// EVERY VALUE IN THIS FILE IS INVENTED. None of it has been checked against
// anything. It exists so the five About pages can be judged as a finished
// design before the owner has supplied real figures — ADR-051 §1.
//
// It renders only while ABOUT_CONTENT_MODE is "demo". Setting the variable to
// "real" swaps in REAL_ABOUT_FACTS and ADR-047 §2's empty rule takes back
// over, hiding every section this data fills.
//
// TODO(owner): move what you can vouch for into REAL_ABOUT_FACTS in
// `about-facts.ts`, set ABOUT_CONTENT_MODE=real, then DELETE this file and
// its catalog keys (`about.overview.timeline.entries.*`,
// `about.overview.awards.items.*`, `about.security.jurisdictions.places.*`,
// `about.overview.stats.{learners,countries,lessons}`).
// ============================================================================
//
// One rule constrains the invention, and it is ADR-051 §4: figures, dates and
// history are made up freely, but **no real outside organisation is named**.
// Award issuers below are fictional bodies, and the map is presented as where
// MBX's own teams and learners are — never as a list of regulators MBX
// answers to. A placeholder that leaks says something false about MBX; it
// must never say something false about somebody else.
//
// Map coordinates are percentages of the artwork's box under the same
// equirectangular crop `generate-about-art.mjs` draws: longitude -180..180
// across, latitude 84..-56 down. So x = (lon + 180) / 360, y = (84 - lat) / 140.

import type { AboutFacts } from "./about-facts.ts";

export const DEMO_ABOUT_FACTS: AboutFacts = {
  foundedYear: 2016,

  stats: [
    { value: 48000, suffix: "+", labelKey: "overview.stats.learners" },
    { value: 30, suffix: "", labelKey: "overview.stats.countries" },
    { value: 1200, suffix: "+", labelKey: "overview.stats.lessons" },
  ],

  // Twelve nodes: Timeline shows the first six and puts the rest behind its
  // native <details> toggle.
  timeline: [
    {
      year: 2016,
      titleKey: "overview.timeline.entries.founded.title",
      bodyKey: "overview.timeline.entries.founded.body",
    },
    {
      year: 2017,
      titleKey: "overview.timeline.entries.curriculum.title",
      bodyKey: "overview.timeline.entries.curriculum.body",
    },
    {
      year: 2018,
      titleKey: "overview.timeline.entries.glossary.title",
      bodyKey: "overview.timeline.entries.glossary.body",
    },
    {
      year: 2019,
      titleKey: "overview.timeline.entries.languages.title",
      bodyKey: "overview.timeline.entries.languages.body",
    },
    {
      year: 2020,
      titleKey: "overview.timeline.entries.surge.title",
      bodyKey: "overview.timeline.entries.surge.body",
    },
    {
      year: 2021,
      titleKey: "overview.timeline.entries.analysis.title",
      bodyKey: "overview.timeline.entries.analysis.body",
    },
    {
      year: 2022,
      titleKey: "overview.timeline.entries.mentors.title",
      bodyKey: "overview.timeline.entries.mentors.body",
    },
    {
      year: 2023,
      titleKey: "overview.timeline.entries.calendar.title",
      bodyKey: "overview.timeline.entries.calendar.body",
    },
    {
      year: 2024,
      titleKey: "overview.timeline.entries.recognition.title",
      bodyKey: "overview.timeline.entries.recognition.body",
    },
    {
      year: 2024,
      titleKey: "overview.timeline.entries.accessibility.title",
      bodyKey: "overview.timeline.entries.accessibility.body",
    },
    {
      year: 2025,
      titleKey: "overview.timeline.entries.platform.title",
      bodyKey: "overview.timeline.entries.platform.body",
    },
    {
      year: 2026,
      titleKey: "overview.timeline.entries.today.title",
      bodyKey: "overview.timeline.entries.today.body",
    },
  ],

  // FICTIONAL awarding bodies (ADR-051 §4). Do not swap these for real ones
  // without an award MBX can evidence.
  awards: [
    {
      titleKey: "overview.awards.items.bestEducation",
      issuer: "Global Finance Education Awards",
      year: 2025,
    },
    {
      titleKey: "overview.awards.items.editorsChoice",
      issuer: "International Trading Media Group",
      year: 2025,
    },
    {
      titleKey: "overview.awards.items.interactive",
      issuer: "Digital Learning Excellence Awards",
      year: 2025,
    },
    {
      titleKey: "overview.awards.items.regional",
      issuer: "MENA FinTech Review",
      year: 2025,
    },
    {
      titleKey: "overview.awards.items.beginner",
      issuer: "Global Finance Education Awards",
      year: 2024,
    },
    {
      titleKey: "overview.awards.items.trusted",
      issuer: "Retail Trader Choice Awards",
      year: 2024,
    },
    {
      titleKey: "overview.awards.items.analysis",
      issuer: "International Trading Media Group",
      year: 2024,
    },
    {
      titleKey: "overview.awards.items.accessibility",
      issuer: "Inclusive Web Recognition Programme",
      year: 2024,
    },
    {
      titleKey: "overview.awards.items.rising",
      issuer: "Digital Learning Excellence Awards",
      year: 2023,
    },
    {
      titleKey: "overview.awards.items.glossary",
      issuer: "Retail Trader Choice Awards",
      year: 2023,
    },
    {
      titleKey: "overview.awards.items.literacy",
      issuer: "MENA FinTech Review",
      year: 2023,
    },
    {
      titleKey: "overview.awards.items.courseDesign",
      issuer: "Global Finance Education Awards",
      year: 2023,
    },
  ],

  // Where MBX's own people are — NOT regulators (ADR-051 §4). `bodies` holds
  // the teams at each location, which is what the legend renders.
  jurisdictions: [
    {
      code: "GB",
      nameKey: "security.jurisdictions.places.london",
      bodies: ["Curriculum", "Editorial"],
      x: 49.96,
      y: 23.21,
    },
    {
      code: "US",
      nameKey: "security.jurisdictions.places.newYork",
      bodies: ["Market analysis"],
      x: 29.44,
      y: 30.93,
    },
    {
      code: "BR",
      nameKey: "security.jurisdictions.places.saoPaulo",
      bodies: ["Portuguese localisation"],
      x: 37.06,
      y: 76.79,
    },
    {
      code: "NG",
      nameKey: "security.jurisdictions.places.lagos",
      bodies: ["Learner support"],
      x: 50.94,
      y: 55.36,
    },
    {
      code: "TR",
      nameKey: "security.jurisdictions.places.istanbul",
      bodies: ["Learner support", "Community"],
      x: 58.06,
      y: 30.71,
    },
    {
      code: "PK",
      nameKey: "security.jurisdictions.places.karachi",
      bodies: ["Engineering", "Design"],
      x: 68.61,
      y: 42.21,
    },
    {
      code: "SG",
      nameKey: "security.jurisdictions.places.singapore",
      bodies: ["Asia-Pacific editorial"],
      x: 78.83,
      y: 59.04,
    },
    {
      code: "AU",
      nameKey: "security.jurisdictions.places.sydney",
      bodies: ["Community"],
      x: 92.0,
      y: 84.21,
    },
  ],

  // Contact values are facts, not catalog strings, so they live here as
  // literal text. The phone numbers are from the ranges reserved for fiction
  // (UK Ofcom drama numbers) so a placeholder that leaks cannot ring a real
  // person's phone.
  support: {
    channels: [
      { kind: "hours", value: "Sunday 22:00 – Friday 21:00 UTC" },
      { kind: "email", value: "support@mbx.co" },
      { kind: "phone", value: "+44 20 7946 0321" },
      { kind: "whatsapp", value: "+44 7700 900321" },
    ],
  },

  payments: [
    "Visa",
    "Mastercard",
    "American Express",
    "PayPal",
    "Apple Pay",
    "Google Pay",
    "Bank transfer",
    "Skrill",
  ],
};
