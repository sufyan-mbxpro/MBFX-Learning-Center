// PLACEHOLDER CONTENT (ADR-103 §4, following ADR-051 §1).
//
// Every value in this file is INVENTED. It exists so the three bands ADR-103
// adds can be judged as a finished design before the owner has supplied
// anything, and it renders only while HOME_CONTENT_MODE is "demo".
//
// Delete this file when the real values land in `REAL_HOME_FACTS`.
//
// Two things it deliberately does NOT do:
//
//   - **It names no real company.** The partner marks are generic descriptors
//     of the KIND of relationship a learning site has, drawn as wordmarks from
//     their own names. An invented figure is a placeholder; an invented
//     partner is a false statement about an organisation that exists, and a
//     reader cannot tell the difference between a placeholder logo and a
//     claimed one.
//   - **It attributes no quote to a real person.** The names are obviously
//     generic and the roles are descriptions, not job titles at named firms.
import type { HomeFacts } from "./home-facts.ts";

export const DEMO_HOME_FACTS: HomeFacts = {
  facts: [
    { key: "learners", value: 60, suffix: "K+", labelKey: "factLearners" },
    { key: "lessons", value: 400, suffix: "+", labelKey: "factLessons" },
    { key: "languages", value: 4, labelKey: "factLanguages" },
    { key: "years", value: 12, suffix: "+", labelKey: "factYears" },
  ],

  partners: [
    { key: "academy", name: "Market Academy", logo: null, href: null },
    { key: "institute", name: "Institute of Trading", logo: null, href: null },
    { key: "review", name: "Currency Review", logo: null, href: null },
    { key: "council", name: "Education Council", logo: null, href: null },
    { key: "quarterly", name: "FX Quarterly", logo: null, href: null },
  ],

  testimonials: [
    {
      key: "one",
      quote:
        "I had read about risk for a year and never actually sized a position. The worked examples were the first time it clicked — I stopped guessing and started writing the number down before I opened anything.",
      name: "A. Demo",
      role: "Learner, first year",
      avatar: null,
    },
    {
      key: "two",
      quote:
        "What I value is what it does not do. Nothing here promises a return, nothing pushes a broker, and every lesson says plainly when something can lose you money.",
      name: "B. Demo",
      role: "Learner, second year",
      avatar: null,
    },
    {
      key: "three",
      quote:
        "The glossary is the part I still use weekly. Plain language first, the technical definition second — that order is the whole reason I kept reading.",
      name: "C. Demo",
      role: "Learner, part-time",
      avatar: null,
    },
  ],
};
