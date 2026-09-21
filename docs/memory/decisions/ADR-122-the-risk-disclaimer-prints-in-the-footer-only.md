# ADR-122: The risk disclaimer prints in the footer, and only there

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 08 (navigation — footer), 12 (public site), 13 (tools, economic calendar)
**Plan:** `docs/changes/changes-38-fixes.md`
**Supersedes:** ADR-119 §1 as it applies to the FOOTER ("the footer no longer
reads `legal.riskDisclaimer`"). ADR-119 §2–§4 stand: the subscribe banner stays
where it is, the article page still prints no disclaimer, and the footer still
shows how to reach a person.
**Superseded by:** —

## Context

ADR-119 took `legal.riskDisclaimer` out of the footer and from under every
article. That missed two places: `RiskDisclaimer` was still a band at the foot
of `/tools`, every `/tools/[tool]` page (through `ToolShell`'s `disclaimer`
slot), and `/economic-calendar`. The owner found it on
`/tools/currency-converter`:

> still showing on the pages … without footer this should remove within the
> site … this should visible in the footer..dynamically

So the ask is narrower than ADR-119's "remove this from all pages". The owner
wants the text off page bodies and on the footer, which every public page
renders. "Dynamically" means from the setting an admin edits, not from copy
in the code.

## Decision

1. **The footer reads `legal.riskDisclaimer` again.** It opens the footer's
   "who we are" band, above the registration number and registered address,
   in the same small secondary ink. A catalog label ("Risk warning:") comes
   first. The text itself is the setting's, never catalog copy. If the
   setting is empty, the paragraph is absent.
2. **No page body prints it.** `RiskDisclaimer` is removed from `/tools`,
   `/tools/[tool]` and `/economic-calendar`. `ToolShell` loses its
   `disclaimer` slot, so a tool page cannot put the band back by passing a
   prop.
3. **The `risk_disclaimer` home band is unchanged.** It is seeded off, and
   its component still reads the setting.

## Consequences

- Every public page shows the disclaimer once, in the same place.
- `home-presentation.test.ts` asserts the new shape: the footer reads the
  setting, and none of the three pages renders `RiskDisclaimer`.
  `tools-area.test.ts` no longer expects a `disclaimer` band in the shell.
- `footer.riskDisclaimerLabel` is re-added as `footer.riskDisclaimerLabel`
  (en only; es/ar/ur are inactive, ADR-091).
