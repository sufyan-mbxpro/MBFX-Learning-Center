// Which home dataset renders (ADR-103 §4) — the About section's switch
// (ADR-051 §1), second instance.
//
// TWO states, never a mixture:
//
//   "demo" — the DEMO_* datasets: invented figures, quotes and partner
//            wordmarks, so the three new bands can be judged as a finished
//            design. Every one of those values is placeholder content.
//   "real" — the REAL_* datasets: what the owner has actually supplied. Empty
//            today, so ADR-103 §3's rule takes over and the bands do not
//            render at all.
//
// TODO(owner): before production, move the values you can vouch for into the
// REAL_* constants in `home-facts.ts`, set HOME_CONTENT_MODE=real, and delete
// the demo file. That sequence IS the checklist — there is no per-field
// override, deliberately: a half-real band, where nobody can tell which figure
// was checked, is worse than either pure state.
//
// The demo partner wordmarks are drawn by us and name no real company. An
// invented FIGURE is a placeholder; an invented PARTNER is a false statement
// about someone who exists, and those are not the same risk (ADR-103 §4).
//
// Read from the environment rather than hardcoded so a production build can
// force the honest state without a code change. Not NEXT_PUBLIC_*: this is
// read on the server while rendering, never in the browser.

export type HomeContentMode = "demo" | "real";

const OVERRIDE = process.env.HOME_CONTENT_MODE;

export const HOME_CONTENT_MODE: HomeContentMode = OVERRIDE === "real" ? "real" : "demo";

/** True while placeholder content is rendering. */
export const IS_DEMO_HOME_CONTENT = HOME_CONTENT_MODE === "demo";
