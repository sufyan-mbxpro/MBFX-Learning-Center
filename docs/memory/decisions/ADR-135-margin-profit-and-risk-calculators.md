# ADR-135: Margin, profit and risk calculators, and a reviews band

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 13 (market: tools), 12 (public site), 05 (settings)
**Plan:** `docs/changes/changes-41-three-calculators-and-reviews.md`
**Supersedes:** —. Extends ADR-086 #1 (the set of tools is code) from eight
tools to eleven, and ADR-114's band order with one band.
**Superseded by:** —

## Context

The owner asked for the three calculators on their own site
(`mbfx.co/tools/margin-calculator`, `/profit-calculator`, `/risk-calculator`),
with the text seeded, the pages' loading effects and presentation carried over,
and the "Share Your MBFX Experience" Trustpilot block from `/tools/live-rates`.

ADR-086 #1 makes the set of tools code, so a new tool is a registry change and
not an admin action. Two of the three overlap tools we already have, so the
overlap has to be decided rather than left to happen.

## Decision

1. **Three new `TOOLS` members: `margin`, `profit-loss`, `risk-reward`.** Their
   URLs are `/tools/<key>`, which drops the `-calculator` suffix like the eight
   before them. `risk` alone was rejected because it reads as
   `risk-sentiment`. All three are `needs: "rates"`, gated by the
   `calculators` flag. `TOOL_KEYS` order puts them after `pip-value`, which is
   also their seeded `sortOrder`.
2. **The overlaps are kept on purpose.**
   - `profit-loss` is not `gain-loss`. Gain/loss works on an ACCOUNT in
     percentages. Profit/loss works on a POSITION from its open and close
     prices, in pips and money.
   - `risk-reward` is not `position-size`. Position size takes a stop distance
     in pips. Risk/reward takes three PRICES (entry, stop, take profit), reads
     the side from the stop, and adds the reward and the ratio. Its seeded FAQ
     names the position-size tool and says how the two differ.
3. **The maths is pure and lives in `@repo/utils`:** `accountMargin`,
   `tradeProfit`, `riskReward` and `riskLevel`. Each returns the
   account-currency leg as `null` when a rate is missing, never a zero, so each
   tool still answers in the pair's own currency with no provider at all.
   - Margin is measured in the BASE currency (units ÷ leverage). A USD account
     opening USD/JPY therefore needs no rate.
   - Pip distances are rounded to a millionth of a pip. Without that, 1.1 −
     1.097 made a 1 : 2 trade compute as 1.9999…, printed "1 : 2.00", and
     triggered the below-minimum note beside it.
   - A take profit on the losing side is reported, never thrown, and never
     rendered as a negative ratio.
4. **Risk-level thresholds are CONFIG, not code:** `conservativeMaxPercent`,
   `moderateMaxPercent` and `minRecommendedRatio` in the tool's `config`,
   seeded 1 / 2 / 2 to match the reference's "2% rule" and "minimum 1:2". The
   level is always printed as a word. The badge tone repeats the word and
   never replaces it.
5. **Reference copy is seeded verbatim where it exists, with three exceptions:**
   - "Real-Time Results" becomes "Instant Results". ADR-088 #7 keeps
     "real-time" off rate-backed tools, and `e2e/public/tools.spec.ts` now
     scans `/tools/profit-loss` for it.
   - The profit page's "Click calculate" step becomes "See your profit or loss
     update as you type", because the widget has no button.
   - Nothing is carried over from the reference pages' footers: not the "FCA
     firm reference 123456" line, not the FSCS figure, not the restricted
     jurisdiction list. A regulatory claim is a fact about a brokerage (ADR-047
     §2), never starting content for a calculator.
6. **The presentation pass is in `tool-shell.tsx`, so all eleven pages get it:**
   - the widget column enters from the start edge and the explainer from the
     end (`Reveal start`/`end`, which flip under RTL);
   - the highlights stagger (`RevealGroup`, with list semantics kept through
     `role="list"`/`"listitem"` because the group is the grid);
   - a masthead without a Cover photo carries the chart `AmbientMotif`, our
     version of the reference's textured hero;
   - `tools/[tool]/loading.tsx` holds the first two bands' shape.

   None of it adds client JS: `Reveal` is a server component and the observer
   island is the root layout's. The reference's `rounded-2xl`/`shadow-xl` are
   not copied (ADR-107).

7. **"Share Your MBFX Experience" is a LINK, not Trustpilot's widget.** The
   widget is a third-party script. It would need a public CSP `script-src`
   exception (security.md #14), set cookies, and add weight to every tool page
   for a row of stars.
   - `ReviewsBand` renders a plain anchor styled with `buttonVariants`, opening
     in a new tab with `rel="noopener noreferrer"`. It is not
     `Button render={<a>}`, which stamps `role="button"` on a link that leaves
     the site.
   - Its placement is on every tool page (between highlights and related) and
     at the foot of `/support`.
   - Adding the star widget later needs its own ADR.
8. **The destination is a setting:** `site.reviewsUrl` (group `general`,
   public, `https://` only), seeded to `https://www.trustpilot.com/review/mbfx.co`.
   If it is empty, the band is ABSENT, which follows ADR-047 §2 and
   code-style.md #28. The heading, lead and button label are catalog keys
   (`public.reviews.*`).

## Consequences

- An existing database gets the three tools, their menu and footer rows, and
  the setting from `pnpm db:seed`, because all of them are create-only. The
  existing eight `Tool` rows keep their stored `sortOrder`, so on an old install
  the new three can tie with pivot points, market hours and currency converter.
  An admin reorders them in `/admin/tools`.
- The header's Tools panel "position" column grows from three rows to six. If
  it reads unbalanced beside the other two columns, splitting it is a code
  change to `MEGA_MENU_PANELS`.
- The footer sitemap guard counts eleven tools.
