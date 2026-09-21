# changes-41 — Margin, Profit and Risk calculators + "Share your experience" band

Status: **SHIPPED** (2026-09-17, ADR-135). The keys `margin` / `profit-loss` /
`risk-reward`, the link-not-widget reviews band and its placement (tool pages +
`/support`) went with the recommendations below. Two things differ from the plan:
the hero pattern became the existing chart `AmbientMotif` rather than a new
`--pattern-grid` token, and the risk-level thresholds are named
`conservativeMaxPercent` / `moderateMaxPercent`. Source request: `changes-40-fixeing.md` (calculator
and Trustpilot items). Module 13 (tools) + Module 12 (public site). Read before
building: `.claude/skills/market/SKILL.md`, ADR-086, ADR-088, ADR-107, ADR-111,
ADR-114, ADR-047 §2.

References studied (raw HTML pulled 2026-09-17):

- https://mbfx.co/tools/margin-calculator
- https://mbfx.co/tools/profit-calculator
- https://mbfx.co/tools/risk-calculator
- https://mbfx.co/tools/live-rates (feedback band only)

---

## 1. What the references actually contain

### Margin Calculator

- **Title / tagline:** "Margin Calculator" — "Calculate the required margin for
  your trades based on instrument, trade size, and leverage. Essential for
  proper risk management and position sizing."
- **Inputs:** account currency (USD/EUR/GBP/JPY) · instrument (8 majors, with
  hard-coded prices) · trade size (units) · leverage (1:50, 1:100, 1:200,
  1:400, 1:500) · account balance.
- **Outputs:** required margin, free margin, margin level.
- **Explainer "Understanding Margin":** Required Margin: the amount needed to
  open a position · Free Margin: available funds for new positions · Margin
  Level: (Equity / Used Margin) × 100 · Margin Call: usually occurs at 100%
  margin level.

### Profit Calculator

- **Title / tagline:** "Profit Calculator" — "Calculate potential profit and
  loss for your forex trades before you enter the market. Essential tool for
  trade planning and risk management."
- **Inputs:** account currency (8) · pair (12, including JPY crosses) · trade
  type Buy (Long) / Sell (Short) · lot size · open price · close price.
- **"How to Use"** (5 steps) and **"Trading Tips"** (4 bullets).
- **"Why Use Our Profit Calculator?"**: Accurate Calculations · Multiple Trade
  Types · Real-Time Results · Risk Assessment, each with one line. This is exactly
  the shape of our highlights band (ADR-114 #3).

### Risk Calculator

- **Title / tagline:** "Risk Calculator" — "Calculate your trading risk,
  position size, and risk-reward ratio. Essential for proper risk management
  and consistent trading results."
- **Inputs:** balance · risk % (with a live "Risk Level: Moderate" label) ·
  instrument · entry · stop loss · take profit.
- **Outputs:** risk profile, "2% of account balance at risk", plus the amount
  at risk, the reward, the R:R ratio and the position size.
- **"Risk Management Tips":** 2% Rule · Risk:Reward (minimum 1:2) · Position
  Size (adjust to stop distance) · Consistency (same risk % every trade).

### Presentation and loading effects (all three pages share them)

| Band                           | Reference effect                   | Our equivalent                                                            |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------- |
| Hero heading + lead            | fade-up 30px                       | `PageHero` already wraps its copy in `<Reveal variant="up">`              |
| Calculator card (left)         | fade + slide from start (−30px)    | `<Reveal variant="start">` around the widget column                       |
| Explainer card (right)         | fade + slide from end (+30px)      | `<Reveal variant="end">` around the `aside`                               |
| "Why use" cards                | fade-up, staggered                 | `RevealGroup` over the highlights `<ul>`                                  |
| Closing CTA / feedback         | fade-up 40px                       | `<Reveal variant="up">`                                                   |
| Hero background                | faint 32px grid-line SVG pattern   | `tools-backdrop.tsx` already exists; add the pattern as a CSS token there |
| Live-rates table while loading | spinner + "Loading market data..." | route `loading.tsx` skeleton in the shell's layout, NOT a spinner         |

What we do not copy: `rounded-2xl` / `shadow-xl` (ADR-107: one radius scale),
raw `bg-gray-*` / hex values (code-style #1), physical `translateX` (the
`start`/`end` variants already flip under RTL). Replay-on-scroll and
`prefers-reduced-motion` come free from ADR-111's observer.

### What we must NOT seed from the reference

- The footer's "FCA regulated, firm reference number 123456" and "£85,000 FSCS"
  claims. They are placeholder regulatory statements. A regulatory claim is a
  fact about the brokerage (ADR-047 §2) and is never seeded from a scrape.
- The hard-coded instrument prices (`EUR/USD (1.085)`). Prices come from the
  rate snapshot (ADR-087 #7) and every figure prints its "as of".
- "Real-Time Results". ADR-088 forbids "real-time"/"live" wording on
  rate-backed tools. Seed it as **"Instant Results"**.
- The Trustpilot JavaScript widget (see §3).

---

## 2. Three new tools

### 2.1 Decisions to confirm before PR 1

1. **Keys and URLs.** Our tools drop the `-calculator` suffix (`position-size`,
   `pip-value`). Proposed: **`margin`**, **`profit-loss`**, **`risk-reward`**, giving
   `/tools/margin`, `/tools/profit-loss`, `/tools/risk-reward`. (`risk` alone
   would be confused with `risk-sentiment`.) If the owner wants the mbfx.co
   slugs, add three `Redirect` rows `/tools/margin-calculator → /tools/margin`
   etc. and keep the keys.
2. **Overlap is a real question, not a blocker.**
   - `profit-loss` ≠ `gain-loss`. Gain-loss is account-level percentages and
     break-even recovery. Profit-loss is one trade's P/L from open/close prices.
     Both stay.
   - `risk-reward` overlaps `position-size` (both take balance, risk % and
     stop). The difference is that risk-reward is price-based (entry/SL/TP),
     outputs the **R:R ratio, reward and a risk level**, and works
     out the stop distance itself. Position-size is pip-based. Both stay. The
     explainers cross-link each other through the related strip.
3. **An ADR before code (Part F #10):** `ADR-135 — eleven tools`. It records
   the three keys, the overlap reasoning above, the "Instant, not real-time"
   copy rule, and that risk-level thresholds are CONFIG (data), not code.

### 2.2 Math (pure, in `@repo/utils/calculators.ts`, 90% coverage floor)

- **Margin:** `marginRequired({ lots, price, leverage })` already exists.
  It gives margin in the pair's QUOTE currency. Add `accountMargin()`: base
  notional = units; required margin in base = units / leverage; convert base →
  account through `crossRate()`. Also `freeMargin = balance − margin` and
  `marginLevel = balance / margin × 100` (equity = balance, since no open P/L,
  stated in the explainer). Result is `null` when a rate is missing, never 0.
- **Profit/loss:** `tradeProfit({ pair, direction, lots, open, close,
accountCurrency, rates })`. pips = (close − open) / pipSize × (buy ? 1 : −1);
  quote P/L = (close − open) × units × sign; convert quote → account with
  `crossRate()`. Returns `{ pips, quote, account | null }`. Uses the
  `pipSize()` JPY rule already there.
- **Risk/reward:** `riskReward({ balance, riskPercent, pair, entry, stop,
target?, accountCurrency, rates })`. The side is inferred from stop < entry
  (long) or stop > entry (short). A stop on the wrong side of a target is a
  labelled error, not a negative ratio. Outputs: amountAtRisk, stopPips,
  targetPips, ratio (1 : x), rewardAmount, units/lots (reuses `positionSize` +
  `accountPipValue`), and `riskLevel` from config thresholds.

Property tests (fast-check): P/L flips sign with direction; margin scales
linearly with lots and inversely with leverage; `ratio × risk === reward`.

### 2.3 Contracts (`packages/contracts/src/tools.ts`)

- `TOOL_KEYS` + `TOOLS`: all three `needs: "rates"`, `flag: "calculators"`,
  icons `scale` (margin), `trending-up` (profit-loss), `shield` (risk-reward).
- `ROUTE_PATHS` in `navigation.ts`: `tool-margin`, `tool-profit-loss`,
  `tool-risk-reward`.
- Config schemas:
  - `marginConfigSchema`: `defaultAccountCurrency`, `defaultPairId`,
    `defaultUnits`, `leverageOptions: int[] (min 1)`, `defaultLeverage` (refined
    ∈ options), `pairIds`, `accountCurrencyIds`.
  - `profitLossConfigSchema`: `defaultAccountCurrency`, `defaultPairId`,
    `defaultLots`, `pairIds`, `accountCurrencyIds`.
  - `riskRewardConfigSchema`: `defaultAccountCurrency`, `defaultPairId`,
    `defaultRiskPercent`, `min/maxRiskPercent`, `levels: { conservativeMax,
moderateMax }` (seeded 1 and 2, refined ordered), `minRecommendedRatio`
    (seeded 2), `pairIds`, `accountCurrencyIds`.
- Comments and tests that say "eight" are updated to name the registry instead
  of a number, so the next tool does not need that edit again.

### 2.4 Seed (`packages/db/prisma/seed.ts` + `seed-tool-highlights.ts`)

`Tool` / `ToolTranslation` upserts are create-only. Re-running `pnpm db:seed`
adds the three rows to an existing database without touching admin edits. No
SQL migration: the config holds instrument cuids that only the seed can
resolve. Sort order 3/4/5 (with the calculators); the later tools shift down.
Existing rows keep their own `sortOrder` (create-only), which is acceptable.
Admins reorder in `/admin/tools`.

Text per tool. Reference wording is used **verbatim where it exists**, and the
gaps are written in the house voice of the existing eight:

| Field        | Margin                                                                                  | Profit / loss                                                          | Risk / reward                                                                |
| ------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `title`      | Margin Calculator                                                                       | Profit Calculator                                                      | Risk Calculator                                                              |
| `tagline`    | reference lead (≤220 chars; fits)                                                       | reference lead                                                         | reference lead                                                               |
| `intro`      | 1 paragraph: what margin is, and that leverage changes the deposit, not the risk        | 1 paragraph + the reference's 5 "How to Use" steps as an `<ol>`        | 1 paragraph: risk before reward                                              |
| `body`       | `<h2>Understanding Margin</h2>` + the reference's 4 bullets + formula note              | `<h2>Trading Tips</h2>` + the reference's 4 bullets + pips/P/L formula | `<h2>Risk Management Tips</h2>` + the reference's 4 bullets + R:R formula    |
| `faq`        | 4: margin vs. leverage · what a margin call is · why the currency matters · free margin | 4: pips vs. money · spread cost · JPY pairs · sell trades              | 4: the 2% rule · what 1:2 means · stop on the wrong side · vs. position size |
| `highlights` | 4 cards written to match                                                                | the reference's 4 cards ("Real-Time" becomes "Instant Results")        | the reference's 4 tips as cards (icons from `TOOL_HIGHLIGHT_ICONS`)          |
| SEO          | title ≤70, description ≤180, focus keyword                                              | same                                                                   | same                                                                         |

All highlight text is plain (guarded by `tools-highlights.test.ts`). All
intro/body HTML stays inside the sanitizer's allow-list.

**Nav rows, in the same PR as the tools (ADR-047 §2):**

- main-menu Tools children: three new rows (label + one-line `title` + icon),
  `requiresFeature: "calculators"`;
- `footer_tools`: three rows. `footer-sitemap.test.ts` count goes 25 → 28;
- mega menu `tools.columns[position].routeKeys`: 3 → 6 items. The other two
  columns are unchanged. Update `mega-menu.test.ts`.

### 2.5 App

- `_widgets/margin.tsx`, `_widgets/profit-loss.tsx`, `_widgets/risk-reward.tsx`:
  client islands built on `WidgetLayout` + `ToolCombobox` + `Field`, modelled
  on `position-size.tsx`. Labels live under the `tools.margin.*`,
  `tools.profitLoss.*` and `tools.riskReward.*` catalog keys (en only, ADR-091).
  The Buy/Sell toggle is a two-button `ToggleGroup`, not a Select. The risk
  level renders as a `Badge` using the success/warning/destructive-interactive
  tones, and the label is always printed next to the colour.
- `tool-widget.tsx`: three new `case`s, still one island per page.
- `tool-icons.ts` + `mega-menu.ts` `ROUTE_ICONS`: three entries.
- Admin `config-panel.tsx`: three new cases. Leverage options are an
  editable list of integers.
- Search (`searchPublicContent`) and the homepage `popular-tools` band read
  rows, so they pick the new tools up automatically. Verify, don't edit.

### 2.6 Loading and presentation pass (applies to ALL tool pages, not just the new three)

In `tool-shell.tsx` only, so eleven pages stay one layout:

1. Wrap the widget column in `<Reveal variant="start">` and the `aside` in
   `<Reveal variant="end">`.
2. Highlights `<ul>` becomes `RevealGroup` (stagger, capped per ADR-111).
3. Hero backdrop: the grid-line pattern as a `--pattern-grid` token in
   `@repo/ui` globals (no hex: stroke from `--foreground` at low alpha), used by
   `tools-backdrop.tsx` when a tool has no uploaded cover.
4. Add `tools/[tool]/loading.tsx`: masthead skeleton + two-column skeleton
   in the shell's own grid (`--grid-3-2`), tone-matched per ADR-095.
5. Budget check: `e2e/public/tools-budget.spec.ts` still passes. `Reveal` is a
   server component, so it adds no client JS.

---

## 3. "Share Your MBFX Experience" band (Trustpilot)

Reference copy: heading **"Share Your MBFX Experience"**. Lead: **"Your
feedback helps us improve and helps other traders make informed decisions. It
only takes a minute."** Link: `https://www.trustpilot.com/review/mbfx.co`
(`target="_blank" rel="noopener noreferrer"`). The reference places it on a
`muted` band directly before the closing CTA.

### Decisions

1. **Where it appears. Your sentence in changes-40 is cut off ("should be added
   in the…").** Recommended: every tool page (after highlights, before
   related), matching live-rates, **plus** `/support` above the contact form.
   It is one component, so adding more placements later is cheap.
2. **A link button, not the Trustpilot JS widget.** The widget loads a
   third-party script (`widget.trustpilot.com`). That needs a public CSP
   `script-src` exception (security.md #14), sets third-party cookies, and
   adds client weight to every tool page. A button labelled "Review us on
   Trustpilot" with a lucide `Star` glyph (code-style #22) delivers the same
   action. If the owner insists on the star widget, that is its own ADR.
3. **The URL is data.** New setting `reviews.trustpilotUrl` (group `general`,
   `STRING`, public, seeded to the URL above). It is validated as `https:`, and
   an empty value means the band is ABSENT (ADR-047 §2, code-style #28: it is
   read by the band, so it ships wired). Heading, lead and button label are
   interface text: `public.reviews.{title,lead,cta}` in `en.json`.

### Build

- `apps/web/app/(public)/[locale]/_components/reviews-band.tsx`: server
  component, `Section tone="muted"`, `Reveal variant="up"`, `Button
variant="default"` as an anchor. It reads the setting through the public
  settings cache.
- `ToolShell` takes an optional `reviews` slot, which keeps the band order in the
  shell (ADR-114). `/support` renders the same component.
- Test: `reviews-band.test.tsx` covers absent when the URL is empty, and
  `rel`/`target` on the link. An e2e assertion goes on one tool page.

---

## 4. PR sequence

| PR  | Scope                                                                                                            | Gate                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 0   | ADR-135 (keys, overlap, copy rule, reviews band as link + setting). Confirm §2.1 and §3 decisions                | governance:check                                           |
| 1   | `@repo/utils` math + property tests; contracts registry, routes, schemas; update registry tests                  | utils ≥90%, `tools.test.ts` both directions                |
| 2   | Seed: three tools (text, FAQ, highlights, SEO, config) + nav/footer/mega rows                                    | `footer-sitemap`, `tools-highlights`, `mega-menu` tests    |
| 3   | Three widget islands + `tool-widget` cases + icons + catalog keys + admin config panels                          | typecheck, lint (no arbitrary values, logical props), unit |
| 4   | Presentation pass in `tool-shell` + `loading.tsx` + grid pattern token                                           | `tools-area.test.ts`, budget spec, axe on 3 new pages      |
| 5   | Reviews band + setting + placements                                                                              | band test, catalog completeness, no CSP change             |
| 6   | e2e `tools.spec.ts` (new pages render, a calculation happens, flag-off 404s); skill, CLAUDE.md row 13 and DEVLOG | full CI order: lint → typecheck → test → build → e2e       |

Out of scope here (remaining changes-40 items, tracked there): the pip-value
text from mbfx.co, the "Rates as of … out of date" message, the glossary
sidebar, banners, and the editor font family. The pip-value copy can ride along
in PR 2 if wanted, because it is the same seed block.

## 5. Risks

- **Stale snapshot.** All three new tools need rates. Every result must render
  an honest empty state when a cross rate is missing (the MANUAL provider on a
  fresh clone). This interacts with the changes-40 request to hide the "out of
  date" note, so decide that one first.
- **Copying a competitor-looking page.** The seeded text is short instructional
  copy the owner supplied as their own site (mbfx.co). No brand claims, prices
  or regulatory statements come across.
- **Mega menu width.** Six rows in one column is taller than the other two
  columns. If it looks unbalanced, split into "Size a trade" (position, margin,
  risk) and "Measure a trade" (pip, profit, gain-loss) as a 4-column panel.
  Decide at PR 3 review with a screenshot.
