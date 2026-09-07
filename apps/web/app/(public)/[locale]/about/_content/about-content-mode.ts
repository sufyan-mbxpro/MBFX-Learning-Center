// Which About dataset renders (ADR-051 §1).
//
// TWO states, never a mixture:
//
//   "demo" — DEMO_ABOUT_FACTS: invented figures, history, awards, locations
//            and channels, so the section can be judged as a finished design.
//            Every one of those values is placeholder text.
//   "real" — REAL_ABOUT_FACTS: what the owner has actually supplied. Empty
//            today, so ADR-047 §2's rule takes over and the gated sections
//            do not render at all.
//
// TODO(owner): before production, move the values you can vouch for from
// `about-facts.demo.ts` into REAL_ABOUT_FACTS, set ABOUT_CONTENT_MODE=real,
// and delete the demo file. That sequence IS the checklist — there is no
// per-field override, deliberately: a half-real About section, where nobody
// can tell which number was checked, is worse than either pure state.
//
// Read from the environment rather than hardcoded so a production build can
// force the honest state without a code change. Not NEXT_PUBLIC_*: this is
// read on the server while rendering, never in the browser.

export type AboutContentMode = "demo" | "real";

const OVERRIDE = process.env.ABOUT_CONTENT_MODE;

export const ABOUT_CONTENT_MODE: AboutContentMode = OVERRIDE === "real" ? "real" : "demo";

/** True while placeholder content is rendering. Drives `data-about-content` on the section root. */
export const IS_DEMO_CONTENT = ABOUT_CONTENT_MODE === "demo";
