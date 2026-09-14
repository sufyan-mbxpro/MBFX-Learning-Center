# changes-25 (tools) — eight trading tools, and the market data platform under them

**Brief:** `changes-25-tools.md` (owner, 2026-09-12) + `image-42.png` (the
reference's tool strip and calculator) and `image-43.png` ("What to Read
Next…").
**Reference:** babypips.com/tools — all eight pages read in full on 2026-09-12.
**ADRs to write first (PR T0):** ADR-084 (the tools platform), ADR-085 (the
market data platform + the second sealed-secret exception), ADR-086 (what our
correlation and risk-sentiment numbers MEAN).
**Modules:** 13 (market layer — this is its real build-out), 12 (public site),
09 (admin shell), 05 (settings), 03/10 (a fourteenth permission group), 01 (db),
07 (ui), 11 (content, for related items).
**Date:** 2026-09-12 · **Status:** PLAN — no code, no migration, no ADR yet.

PRs are numbered **T0–T10** so they never collide with changes-21's F-track or
changes-20's phases.

---

## 1. The brief, line by line

| #   | Owner's line                                                     | Where it lands                                                       |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| B1  | Add all eight tools, following the reference's presentation flow | T6 (five), T7 (two), T8 (two)                                        |
| B2  | Review whether each is public-only or can be admin-controlled    | §4 — the control inventory                                           |
| B3  | API keys / widgets belong in settings                            | T3 (provider row), T4 (screen)                                       |
| B4  | Things like currency pairs must be admin-controlled              | T3 (schema), T4 (screen)                                             |
| B5  | Decide: are related topics admin-managed or static?              | §3.2 #6 — **admin, curated + auto top-up**; T5 (editor), T6 (render) |
| B6  | Maximum possible control from the admin side                     | §4, and it is the plan's organising rule                             |
| B7  | Work out how the calculators themselves get built                | T2 — pure functions in `@repo/utils`, islands in the app             |

---

## 2. The reference, page by page

Every page has the **same six-band flow**. That is the thing to copy, not the
styling:

1. a strip of all eight tools, pinned under the header (image-42);
2. a masthead — title, one-line tagline, 2–3 sentences of intro prose with
   inline links into lessons, and a "Give it a try!" CTA;
3. **the widget** — inputs on one side, results on the other, one action;
4. an explainer under it ("About the Pip Value Calculator", "About Pivot
   Points" — formulas and all);
5. **"More About <topic>"** — 8–12 related cards pointing at lessons, articles
   and news;
6. a latest-content carousel ("What to Read Next…", image-43), then partners
   and footer.

What each widget actually takes and returns, read off the live pages:

| Tool                     | Inputs                                                                         | Outputs                                                                | Needs data?                                                 |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Position size            | account currency, balance, risk %, stop loss (pips), pair                      | amount at risk, position size (units), standard / mini / micro lots    | a rate, when the account currency is not the quote currency |
| Pip value                | pair, ask price, position size (units), account currency                       | pip value                                                              | a rate for the account-currency leg                         |
| Gain & loss %            | start balance, gain-or-loss, then **one of** amount / percent / ending balance | the other two, plus the % needed to get back to breakeven              | no                                                          |
| Pivot point              | interval (1D/1W/1M/1Y), symbol, autofill-or-manual OHLC                        | five methods × R4…S4 — Floor, Woodie, Camarilla, DeMark, Fibonacci     | OHLC, in autofill mode                                      |
| Forex market hours       | timezone, 12/24-hour                                                           | four sessions with local open/close, open-or-closed, a volume band     | no — clock maths                                            |
| Currency converter       | amount, from, to                                                               | converted amount, the rate used, "as of"                               | a rate                                                      |
| Currency correlation     | window (5d/10d/30d/60d/90d/180d/250d)                                          | for each of ~9 bases, its correlation to the others, −1…+1             | 250 daily bars per instrument (the close only)              |
| Risk-on / risk-off meter | none                                                                           | a 0–100 score with a band, a 60-day history, and a gauge per component | the same daily bars, likewise close-only                    |

**Three things we deliberately do not copy.** The partner/broker ad rails (we
sell nothing); the reference's per-page "More About" list, which is visibly
automatic and lands a Canada jobs headline under a gain/loss calculator — ours
is curated first (§3.2 #6); and its proprietary risk-sentiment formula, which is
undisclosed, so ADR-086 states ours instead of pretending to reproduce theirs.

---

## 3. Decisions

### 3.1 Taken by the owner (2026-09-12, this session)

| #   | Question                                   | Answer                                                                                                                                                                                                       |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | How are the three data-backed tools built? | **All three ourselves.** Wire the `MarketDataProvider` seam, store daily OHLC bars, compute correlation and the risk meter from an admin-configured basket. No vendor iframe.                                |
| D2  | Where does the market data API key live?   | **Sealed in the database, admin-managed** — the `EmailTransport` pattern exactly, gated on the already-seeded `market.providers.manage`. ADR-085 records the second (and last) exception to security.md #10. |

### 3.2 Taken in this plan (reversible; flagged for the owner)

1. **The set of tools is code; everything a tool SAYS is data.** `TOOLS` in
   `@repo/contracts` decides which eight exist, what each one's URL segment is,
   which inputs it has and what maths it runs. A `Tool` row decides its title,
   tagline, intro, explainer prose, FAQ, SEO, defaults, related items and
   whether it is live. This is ADR-042's split applied one level down, and the
   same shape ADR-078 #5 chose for email templates: a code registry with data
   content. A calculator is not composable from admin fields, and pretending
   otherwise is how Module 16 ended.
2. **No per-tool table.** One `Tool` + `ToolTranslation` pair, plus a `config`
   JSON column validated by the registry's per-tool Zod schema
   (`TOOL_CONFIG_SCHEMAS`). Eight tables for eight tools would make adding the
   ninth a migration.
3. **The URL segment is code, not an editable slug.** `/tools/pip-value` is the
   registry key; there is no slug column and no redirect machinery, the same
   call ADR-065 made for a track. A renamed tool is a code change with a
   redirect beside it.
4. **A new `@repo/secrets` package** (≈60 lines, no dependencies) holding the
   AES-256-GCM seal that `packages/email/src/secret.ts` has today, parameterised
   by env-var name. `@repo/email` keeps `EMAIL_SECRET_KEY` and its own error type
   and delegates; `@repo/core` seals the provider key under `MARKET_SECRET_KEY`.
   The alternative — `@repo/core` importing `@repo/email/secret`, which
   architecture.md #8 already permits — was rejected because "the email package
   holds the market key's cipher" is a sentence nobody should have to read
   twice. Duplicating a crypto primitive was rejected outright.
5. **Instruments are one table, not two.** `MarketInstrument` carries a `kind`
   (`CURRENCY | PAIR | CRYPTO | METAL | INDEX | COMMODITY`). The converter reads
   `CURRENCY` rows, correlation and the meter read the rest, and the pip and
   position calculators read `PAIR` rows. A second `MarketCurrency` table would
   need its own admin screen to say the same thing. Whatever an instrument's
   `kind`, everything on this line reads a bar's `close` and only its `close`;
   `open`, `high` and `low` are stored for the pivot calculator alone (T3).
6. **Related items are curated in admin, topped up automatically.** Exactly
   `resolveRecommendations`'s pattern (ADR-055): the editor picks an ordered
   list; if it is short of the configured count, the rest is filled by track and
   tag; the strip never renders empty. Unlike courses, a tool's list is
   **mixed-type** — lessons, articles, glossary terms, videos — which
   `ContentRelation` already stores (each row carries its own `targetType`); only
   the helper is per-type, so T5 adds `replaceMixedRelations` /
   `loadMixedRelationTargets` beside the existing pair. No new table.
7. **One rate snapshot per page, not an endpoint per keystroke.** The server
   reads every active instrument's latest rate once (cached 5 minutes, tagged
   `market`), passes it to the island, and conversion is client-side arithmetic
   against a USD base with cross-rates. The reference posts back on every
   "Calculate"; we do not need to, and it keeps the widgets working while the
   provider is down. The snapshot carries latest rates, never bars — the
   converter's rate-type markups (T7) are arithmetic on the same numbers, so
   estimating what a bank or a kiosk would give you costs no second request and
   stores no second figure.
8. **A stale rate is labelled, never hidden.** `getRate` already degrades to the
   last good value; every surface showing a number derived from a rate shows its
   "as of" time, and a stale snapshot says so in words.
9. **`tools` is the fourteenth permission group** (ADR-083's escape hatch, used
   for the first time). `/admin/tools` is its own screen, so its keys are its
   own: `tools.view`, `tools.update`, `tools.publish`. Instruments and the
   provider are **not** new keys — `market.view`, `market.instruments.manage` and
   `market.providers.manage` have been seeded since Module 01 and have governed
   nothing; this is the fourth time this repo declines to add keys.
10. **A disabled tool 404s, and its strip entry is absent.** The learn area's
    rule (changes-11 D25) verbatim: a tab that leads nowhere is worse than no
    tab. The `calculators` and `currency_converter` flags are already seeded.

### 3.3 What stays static, and why

Layout, the band order, the widget forms themselves, the tool strip's
composition and every icon are code (ADR-042). An admin who wants the pivot
calculator to offer a sixth method files a change, not a form.

---

## 4. The control inventory (answers B2, B4, B6)

**Nothing here is public-only.** Read as: what an admin can change without a
deploy.

| Surface                               | Admin-controlled                                                                                                  | Code                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Which tools are live, and their order | `Tool.isEnabled`, `Tool.sortOrder`, plus the `calculators` / `currency_converter` flags                           | which eight exist                   |
| Every word on a tool page             | `ToolTranslation`: title, tagline, intro, explainer body (rich text), FAQ, SEO title/description/keyword          | field and result labels (catalogs)  |
| Tool defaults and limits              | `Tool.config`: default pair, default account currency, default risk %, min/max risk, decimals, lot sizes, windows | input types, validation shape       |
| **Currency pairs and instruments**    | `/admin/market` — add, rename, re-symbol, reorder, activate, set pip size and provider symbol                     | the `kind` enum                     |
| Which pairs appear in which tool      | per-tool `config` lists instrument ids (converter currencies, correlation set, pivot symbols, meter basket)       | —                                   |
| **The data provider and its API key** | `/admin/market/provider` — driver, key (write-only, sealed), base URL, refresh interval, stale window, on/off     | the driver implementations          |
| Risk meter methodology inputs         | basket membership, per-component weight and direction, the lookback, the two band thresholds                      | the formula (ADR-086)               |
| Correlation windows offered           | the window list, the instrument set, and which window opens by default (seeded `30d`)                             | Pearson over log returns            |
| **Converter rate-type markups**       | the bank / ATM / card / kiosk percentages in the converter's `config`, and whether each choice is offered at all  | that they are estimates, not quotes |
| Session times for market hours        | session name, city, IANA zone, local open/close, the volume bands                                                 | DST maths                           |
| **Related items per tool**            | an ordered mixed picker, plus a count and an on/off                                                               | the auto top-up rule                |
| Tool artwork                          | cover per tool via the media picker; generated art is the fallback                                                | the generator                       |
| Where tools appear in navigation      | menu rows and labels (seeded, editable)                                                                           | the mega panel's column shape       |
| The risk disclaimer under every tool  | `legal.riskDisclaimer` (already)                                                                                  | that it renders                     |

---

## 5. What exists today (verified against the tree, 2026-09-12)

| Thing                                                          | State                                                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(public)/[locale]/tools/page.tsx`                | Renders `ComingSoon` (ADR-081 #1). `noindex, follow`. Replaced in T6.                                                                                     |
| `tools` in `RESERVED_PATHS`, `ROUTE_PATHS.tools`               | Present. Per-tool keys are not.                                                                                                                           |
| `packages/utils/src/calculators.ts`                            | `pipSize`, `pipValue`, `positionSize`, `marginRequired` — pure, tested, **and called by nothing**.                                                        |
| `packages/core/src/market.ts`                                  | `MarketDataProvider`, an AlphaVantage implementation, a cache seam, degrade-to-stale, `resolveProvider(env)` — **no consumers, no models, key from env**. |
| Market permission keys                                         | `market.view`, `market.providers.manage`, `market.instruments.manage` seeded and granted to roles; **used by nothing**.                                   |
| Feature flags                                                  | `tools/calculators`, `tools/currency_converter`, `market/market_data`, `market/currency_strength` all seeded.                                             |
| Seeded nav                                                     | A header row (`routeKey: tools`, icon `calculator`, `requiresFeature: calculators`) and a footer row under "Markets & Tools". No children, no panel.      |
| `EXPLORE_DESTINATIONS`                                         | `tools` is `status: "soon"`, and `explore-destinations.test.ts` asserts `soon` ⟺ the route renders `<ComingSoon `. T9 flips both.                         |
| Home sections                                                  | `popular_tools`, `forex_rates`, `trading_sessions`, `market_sentiment` are seeded `enabled: false` stubs. T9 lights up `popular_tools` only.              |
| `SectionNav` (`_components/section-nav.tsx`)                   | The one section bar (ADR-076 §1, ADR-081 #4). Tools reuse it; no second strip.                                                                            |
| `ContentRelation` + `replaceRelations` / `loadRelationTargets` | Generic, ordered, per-`targetType`. Mixed-type ordering needs the two new helpers in §3.2 #6.                                                             |
| `resolveRecommendations` (`public-courses.ts`)                 | Curated-then-top-up, order-restoring. The model T6 copies.                                                                                                |
| `packages/email/src/secret.ts`                                 | AES-256-GCM `v1:` seal under `EMAIL_SECRET_KEY`, with tests. Moves to `@repo/secrets` in T3.                                                              |
| `apps/web/app/api/cron/publish-due/route.ts`                   | `CRON_SECRET`, `timingSafeEqual`, fails closed, audits with `userId: null`. The market sweep copies it exactly.                                           |
| `PERMISSION_GROUPS` (`packages/db/src/permission-groups.ts`)   | 13 entries, ordered like the sidebar; `permission-groups.test.ts` fails in both directions.                                                               |
| Generated art                                                  | `apps/web/scripts/lib/art.mjs` + four generators; `_content/*-media.ts` is the pattern (ADR-047 §3).                                                      |
| Redis                                                          | `ioredis` is a real dependency of `@repo/auth` (sessions, rate limits). Available for the rate cache.                                                     |

---

## 6. PR order and dependencies

```
T0 ADRs/rules/skill ─┬─> T1 contracts+registry ─┬─> T2 maths (utils) ─────────┬─> T6 public: index + 5 pure tools ─┐
                     │                          │                             │                                    │
                     └─> T3 schema+market core ─┼─> T4 admin: instruments+key │                                    ├─> T9 nav/sitemap/home
                                                └─> T5 schema+admin: tools ───┘                                    │
                                                                    T7 rates: converter, autofill, conversion ─────┤
                                                                    T8 history: correlation + risk meter ──────────┴─> T10 gate + DEVLOG
```

T2 needs only T1. T4 and T5 can run in parallel once T3 lands. T7 and T8 both
need T3's sweep to have run at least once against a real provider.

---

### PR T0 — ADRs, rules, skill, docs (docs only)

| File                                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/memory/decisions/ADR-084-the-tools-platform.md`           | NEW. The code-registry / data-content split (§3.2 #1) and why a calculator is not admin-composable. One `Tool` + `ToolTranslation` + a validated `config` JSON, never a table per tool. The URL segment is the registry key. The six-band page flow. Related items are curated-then-topped-up and mixed-type. A disabled tool 404s and leaves the strip. The fourteenth permission group, and the fourth refusal to add keys for instruments.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/memory/decisions/ADR-085-the-market-data-platform.md`     | NEW. `MarketProvider` / `MarketInstrument` / `MarketDailyBar` — **bars, not closes**: a high and a low cannot be derived from closing prices, so a weekly range assembled out of daily closes understates the real one and every pivot level computed from it is wrong; the provider returns all four values in the same response, so storing them costs no extra request. **The second security.md #10 exception**, and why it is narrower than ADR-078's: a read-only quote key captures nothing and nothing is delivered TO a user through this host, so it is gated on `market.providers.manage` rather than super_admin. Write-only field, one reader, `MARKET_SECRET_KEY` in env. `@repo/secrets`. The rate snapshot (§3.2 #7). Degrade-to-stale and its labelling. **The new frozen cache tag `market`.** The nightly sweep: ordered by **staleness** (oldest stored bar first, never-synced instruments ahead of everything) rather than by `sortOrder`, so resumption is implicit and no cursor column exists to drift; **full history on an instrument's first sync**, the tail thereafter, because correlation at 250d and the meter's percentile ranks need ~250 bars and an incremental-only sweep would leave both rendering "—" for months. And why nothing depends on the sweep running. |
| `docs/memory/decisions/ADR-086-what-our-market-numbers-mean.md` | NEW. Correlation = Pearson over **log returns** of daily closes (not of prices — price-level correlation reports two trending series as correlated when their moves are unrelated), the window list, and the minimum sample below which a cell renders "—" rather than a number. The risk-sentiment score: per-component percentile rank over the lookback, signed by direction, weighted mean, bands at 35/65. What it is not: not a forecast, not the reference's formula, not a recommendation — and **not real-time**: the reference recalculates continuously while markets are open, ours moves once per daily sweep, so no copy on either page may say "real-time" or "live", and the "as of" line plus the methodology panel carry the cadence honestly. The disclaimer this obliges.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `.claude/rules/security.md`                                     | #10 gains the second exception, one line, pointing at ADR-085 and naming the narrower gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.claude/rules/architecture.md`                                 | #8 gains `core → secrets`, `email → secrets`. #12's frozen tag list gains `market`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `.claude/skills/market/SKILL.md`                                | Rewritten: Module 13 is now the market **platform** — provider, instruments, daily bars, the sweep — plus the eight tools. How to add a tool (registry entry, config schema, seed row, island, test). How to add an instrument (a row; no code). Invariants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `CLAUDE.md`                                                     | Module 13 row rewritten; Module 12 row gains `/tools/**`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `docs/memory/stack.md`                                          | No new runtime dependency. Records that the sweep and the rate cache reuse `ioredis`, already pinned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `.env.example`                                                  | `MARKET_SECRET_KEY` (names only, per security.md #10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**Exit:** `pnpm governance:check` green; every later PR cites one of these three.

---

### PR T1 — the registry and the routes (no UI)

| File                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/tools.ts`      | NEW. `TOOL_KEYS = ["position-size","pip-value","gain-loss","pivot-points","market-hours","currency-converter","correlation","risk-sentiment"] as const`. `TOOLS: Record<ToolKey, ToolSpec>` where `ToolSpec = { key, routeKey: RouteKey, needs: "none" \| "rates" \| "history", icon: string, defaultRelatedCount: number }`. `TOOL_CONFIG_SCHEMAS: Record<ToolKey, z.ZodType>` — one schema per tool; `toolConfigSchema(key)`; `ToolConfig<K>`; `toolPath(key)`. |
| `packages/contracts/src/navigation.ts` | Eight literal `ROUTE_PATHS` entries (`"tool-position-size": "/tools/position-size"`, …) — spelled out for the reason `LEARN_TRACK_ROUTE_KEYS` spells its own out: a computed key widens `RouteKey` to `string` and takes the menu row's compile-time check with it. `TOOL_ROUTE_KEYS: Record<ToolKey, RouteKey>` binds the two.                                                                                                                                   |
| `packages/contracts/src/tools.test.ts` | NEW drift guard in `learn.test.ts`'s shape, failing in both directions: every `TOOL_KEYS` entry has a route key, a config schema and an icon; every `tool-*` route path is `/tools/<key>`; no `ROUTE_PATHS` key starting `tool-` is missing from the registry.                                                                                                                                                                                                    |
| `packages/contracts/src/index.ts`      | Re-export.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `scripts/check-reserved-paths.mjs`     | No change — `tools` is already reserved and covers the children. Asserted by its existing test.                                                                                                                                                                                                                                                                                                                                                                   |

**Three config schemas the reference pins down**, and they are pinned here so T5
seeds and T7 renders the same thing:

- `pivot-points` — `intervals`, offering **`1D/1W/1M/1Y`**. 1Y folds daily bars
  exactly as 1W and 1M do, so it needs nothing intraday would need; the
  reference's 1m…4h intervals stay out of scope (§8).
- `currency-converter` — `rateMarkups: { bank, atm, card, kiosk }`, percentages
  applied to the mid-market rate so the widget can estimate what each of those
  would really give you. Admin-editable, seeded in T5.
- `correlation` — `windows` and `defaultWindow`, seeded **`"30d"`**, which is the
  view the reference opens on. The window list itself is unchanged.

---

### PR T2 — the maths (`@repo/utils`, 90% floor)

All pure, no I/O, no rate fetching — the file header's existing contract.

| File                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/utils/src/calculators.ts`  | Extends. `gainLoss({ startBalance, direction, known })` → `{ amount, percent, endingBalance, breakevenPercent }`, solving from whichever one of the three is given (the reference's "tell us one of these and we'll tell you the other two"). `pivotPoints({ open, high, low, close, method })` for `floor \| woodie \| camarilla \| demark \| fibonacci`, returning `R4…S4` with absent levels `null` — the five formula sets verbatim from the reference's own "About Pivot Points" section, cited in a comment. `accountPipValue({ pair, units, price, accountCurrency, rates })` — the account-currency leg the existing `pipValue` deliberately left to its caller. `crossRate(from, to, usdRates)` and `convertAmount`. |
| `packages/utils/src/market-hours.ts` | NEW. `sessionState(sessions, at, timezone)` → per session `{ isOpen, opensAt, closesAt, localLabel }` and an overall `volumeBand` (`low \| medium \| high`) from how many sessions overlap. IANA zones via `Intl.DateTimeFormat` — DST is the provider of truth, never a stored UTC offset. The weekend gap is explicit: the market closes at the New York Friday close and reopens at the Sydney Sunday open.                                                                                                                                                                                                                                                                                                                |
| `packages/utils/src/statistics.ts`   | NEW. `logReturns(closes)`, `pearson(a, b)`, `correlationMatrix(series, window)`, `percentileRank(value, window)`, `riskSentimentScore(components, { lookback, bands })` → `{ score, band, contributions, reporting }`. Every function returns `null` rather than a number when the sample is below its minimum.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `*.test.ts` beside each              | Unit plus **property tests** (fast-check, testing.md): Pearson is symmetric, self-correlation is 1, output stays in [−1, 1] for any input; Floor pivots always satisfy S3 < S2 < S1 < PP < R1 < R2 < R3; `gainLoss` round-trips from each of its three entry points; `riskSentimentScore` is monotone in a component's rank and unchanged by scaling all weights.                                                                                                                                                                                                                                                                                                                                                             |

---

### PR T3 — schema, `@repo/secrets`, and the market platform

**`packages/secrets/`** — NEW package. `sealSecret(plaintext, envVar)`,
`openSecret(cipher, envVar)`, `SecretKeyMissingError`, the `v1:` prefix and the
rotation note, lifted from `packages/email/src/secret.ts`. `@repo/email`'s
`secret.ts` becomes a four-line delegation keeping `EMAIL_SECRET_KEY_ENV` and
`EmailSecretKeyMissingError`; its existing `secret.test.ts` passes untouched,
which is the proof the move is behaviour-preserving.

**Schema** (`packages/db/prisma/schema.prisma`), additive — `migrate dev`:

```prisma
enum MarketDriver         { ALPHAVANTAGE MANUAL }
enum MarketInstrumentKind { CURRENCY PAIR CRYPTO METAL INDEX COMMODITY }

model MarketProvider {                    // singleton, id = "default"
  id             String       @id @default("default")
  driver         MarketDriver @default(MANUAL)
  baseUrl        String?      @db.VarChar(255)
  apiKeyCipher   String?      @db.Text    // ADR-085 — sealed, write-only, one reader
  refreshSeconds Int          @default(300)
  staleSeconds   Int          @default(86400)
  isEnabled      Boolean      @default(false)
  lastSyncAt     DateTime?
  lastSyncError  String?      @db.Text
  updatedAt      DateTime     @updatedAt
  @@map("market_providers")
}

model MarketInstrument {
  id             String               @id @default(cuid())
  kind           MarketInstrumentKind
  symbol         String               @db.VarChar(20)     // "EUR/USD", "EUR", "XAU/USD"
  displayName    String               @db.VarChar(80)
  base           String?              @db.VarChar(10)
  quote          String?              @db.VarChar(10)
  providerSymbol String?              @db.VarChar(40)     // what the driver calls it
  pipSize        Decimal?             @db.Decimal(18, 10) // null → derived from the quote currency
  decimals       Int                  @default(5)
  isActive       Boolean              @default(true)
  sortOrder      Int                  @default(0)
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  bars           MarketDailyBar[]
  @@unique([symbol])
  @@index([kind, isActive, sortOrder])
  @@map("market_instruments")
}

model MarketDailyBar {
  id           String   @id @default(cuid())
  instrumentId String
  date         DateTime @db.Date
  open         Decimal  @db.Decimal(24, 10)
  high         Decimal  @db.Decimal(24, 10)
  low          Decimal  @db.Decimal(24, 10)
  close        Decimal  @db.Decimal(24, 10)
  createdAt    DateTime @default(now())
  instrument   MarketInstrument @relation(fields: [instrumentId], references: [id], onDelete: Cascade)
  @@unique([instrumentId, date])
  @@index([instrumentId, date(sort: Desc)])
  @@map("market_daily_bars")
}
```

**Why `Decimal`, not `Float`.** A close is money-shaped and gets subtracted from
its neighbour to make a return; binary floating point is the wrong store for a
value a human will reconcile against a broker statement.

**Why a bar, not a close.** `getOhlc` has to answer "what was the week's high?",
and a high cannot be derived from closing prices — the week's true high almost
never lands on a close, so a range assembled out of closes understates it and
every pivot level computed from that range is wrong by the same amount.
AlphaVantage's `FX_DAILY` returns open, high, low and close in one response, so
storing four columns costs no extra request and no extra call. Nothing but the
pivot calculator reads them: correlation, the risk meter, §3.2 #5's instrument
reads and §3.2 #7's snapshot all read `close` and only `close`.

**The aggregation rule, stated once.** An interval bar is the **first day's
`open`, the maximum of the days' `high`, the minimum of the days' `low`, and the
last day's `close`.** 1W, 1M and 1Y each fold daily bars that way; 1D is the
stored bar itself.

| File                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/market.ts`                | Grows, keeping the existing provider seam untouched. `loadProviderDriver()` — **the only reader of `apiKeyCipher`**, mirroring `loadTransportDriver()`. `MarketProviderView` has no key property at all (not omitted: absent). `fetchDailySeries(symbol, days)` joins the `MarketDataProvider` interface; the AlphaVantage implementation gains `FX_DAILY` / `DIGITAL_CURRENCY_DAILY`, with the same "200 + Note means rate-limited" trap the live path already handles. `syncDailyBars()` upserts all four values per instrument and records `lastSyncAt` / `lastSyncError`. It walks instruments **oldest-stored-bar first**, never-synced ones ahead of everything, so a run that exhausts the request budget leaves the rest for the next one — resumption is implicit and there is no cursor column to keep honest. An instrument with no stored bars is fetched `outputsize=full` and backfilled in one go; one that has bars is fetched compact and only the tail is upserted. Backfill is still one request per instrument, so a first run fits the same budget as any other. `getRateSnapshot()` → `{ base: "USD", rates, fetchedAt, stale }`, `"use cache"`, `cacheTag("market")`, `cacheLife({ revalidate: 300 })`. `getDailySeries(instrumentId, days)` and `getOhlc(symbol, interval)` (1D/1W/1M/1Y, folded from daily bars by the rule above) likewise. |
| `packages/core/src/market-admin.ts`          | NEW. `loadMarketProvider()` → view; `saveMarketProvider()` (seals a supplied key, leaves the stored one alone when the field is blank — write-only means blank = unchanged, never blank = erase); `testMarketProvider()` fetches one rate and reports; instrument CRUD. Every mutation records audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/web/app/api/cron/market-sync/route.ts` | NEW, `publish-due`'s twin: `CRON_SECRET`, `timingSafeEqual`, fails closed on an absent secret, `userId: null` audit, `force-dynamic`. Calls `syncDailyBars()` then `revalidateTag("market", { expire: 0 })`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/db/prisma/seed.ts`                 | Seeds a `MANUAL`, disabled provider and ~28 instruments: the 8 majors as `CURRENCY` rows, the majors and main crosses as `PAIR`, `XAU/USD` (METAL), `BTC/USD` (CRYPTO), and the four index/commodity rows the meter's default basket names. Create-only on content, like every other seeded row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tests                                        | `market.test.ts` extends (driver parsing, the rate-limit trap, cross-rate assembly). `market.integration.test.ts` NEW (Testcontainers): the sweep is idempotent across two runs on the same day; an instrument with no bars gets full history on its first successful sync, and the second sync fetches only the tail; the sweep visits the stalest instrument first; a weekly fold takes the first open, the highest high, the lowest low and the last close; a provider failure writes `lastSyncError` and leaves yesterday's bars; `MarketProviderView` cannot carry a key (a type-level `expectTypeOf` plus a runtime assertion).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

### PR T4 — admin: instruments and the provider

Both under `/admin/market`, a new sidebar entry in the "data and reach" area.
ADR-044 / ADR-057 / ADR-077 conventions throughout — `AdminCombobox`, `Field` +
`FieldError` + `useFieldErrors`, `DialogTitle` **and** `DialogDescription`,
`ConfirmDialog` on every destructive path, filters in the `DataTable` toolbar.

| File                                                      | Change                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(admin)/admin/market/page.tsx`              | NEW. Instruments list: `DataTable` with kind and status filters, search, keyboard reorder, activate/deactivate, and a "last bar" column saying how fresh each instrument's data is — which is also what makes the sweep's staleness rotation visible rather than mysterious. |
| `apps/web/app/(admin)/admin/market/instrument-dialog.tsx` | NEW. Create/edit: kind, symbol, display name, base/quote (required for `PAIR`, hidden otherwise), provider symbol, pip size override, decimals.                                                                                                                              |
| `apps/web/app/(admin)/admin/market/provider/page.tsx`     | NEW. Driver, base URL, **API key (write-only — the field renders empty over a stored key and says so)**, refresh interval, stale window, enabled. A "Test connection" action reporting the fetched rate and its latency. Last sync and last error.                           |
| `apps/web/app/(admin)/admin/market/actions.ts`            | NEW. `requirePermission("market.instruments.manage")` / `("market.providers.manage")` as the first line of each; parse via `@repo/contracts`; call `@repo/core`; `recordAudit`; `revalidateTag("market", { expire: 0 })`.                                                    |
| `packages/contracts/src/market.ts`                        | NEW. `marketInstrumentSchema` (with the "`PAIR` requires base and quote" refinement), `marketProviderSchema` (blank key = unchanged).                                                                                                                                        |
| `apps/web/app/(admin)/admin/_components/admin-shell.tsx`  | The `/admin/market` entry, `permission: "market.view"`.                                                                                                                                                                                                                      |
| `packages/i18n/messages/en.json`                          | `admin.market.*` (en only — ADR-043 #2).                                                                                                                                                                                                                                     |
| Tests                                                     | `market-actions.test.ts` — every action refuses a subject without its key, **denied at the DB** (no row written). `admin-dialog-conventions.test.ts` and `admin-form-conventions.test.ts` pick the new screens up automatically.                                             |

---

### PR T5 — schema and admin for the tools themselves

**Schema:**

```prisma
model Tool {
  id           String   @id @default(cuid())
  key          String   @unique @db.VarChar(40) // a TOOL_KEYS member; code owns the set
  isEnabled    Boolean  @default(true)
  sortOrder    Int      @default(0)
  coverAssetId String?                          // MediaAsset id, no FK (ADR-035)
  config       Json                             // validated by TOOL_CONFIG_SCHEMAS[key]
  relatedCount Int      @default(6)
  showRelated  Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  translations ToolTranslation[]
  @@index([isEnabled, sortOrder])
  @@map("tools")
}

model ToolTranslation {
  id      String  @id @default(cuid())
  toolId  String
  locale  String  @db.VarChar(10)
  title   String  @db.VarChar(160)
  tagline String? @db.VarChar(220)
  intro   String? @db.Text      // sanitized on save (security.md #8)
  body    String? @db.LongText  // the explainer band, sanitized on save
  faq     Json?                 // [{ question, answer }] — the FAQ shape articles already use

  seoTitle        String? @db.VarChar(70)
  seoDescription  String? @db.VarChar(180)
  seoFocusKeyword String? @db.VarChar(100)

  translationStatus TranslationStatus @default(DRAFT)
  sourceHash        String?           @db.VarChar(64)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  tool Tool @relation(fields: [toolId], references: [id], onDelete: Cascade)
  @@unique([toolId, locale])
  @@map("tool_translations")
}
```

**No `status`, no `scheduledFor`, no seven-state machine.** A tool is a fixture
of the site, not an article: it is on or off. ADR-071 gave `scheduledFor` to the
five entities a reader browses as a feed; scheduling a calculator solves nothing.

| File                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/permission-groups.ts`                                | `"tools"` inserted after `"market"` — the fourteenth group, in sidebar order. `permission-groups.test.ts` then requires it to have keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `packages/db/prisma/seed.ts`                                          | Three permissions (`tools.view`, `tools.update`, `tools.publish`) in group `tools`; grants — all three to `admin`, view + update to `content_manager`, view to `market_data_manager`. Eight `Tool` rows with English copy, defaults and a starting related list, create-only — among the defaults, the converter's `rateMarkups` (bank / ATM / card / kiosk percentages) and correlation's `defaultWindow: "30d"`. The converter's seeded copy calls these **typical** markups and attributes them to no named provider.                                                                    |
| `packages/core/src/tools.ts`                                          | NEW. `listTools()`, `loadTool(key)`, `saveTool()` — **one transaction** writing tool fields, one translation and the mixed relation set, with the source hash over every prose field — **`faq` included, both the question and the answer of every entry** — so an FAQ-only edit flips sibling translations OUTDATED exactly as a body edit does (the ADR-069 rule: an example-only edit must flip siblings OUTDATED). `setToolEnabled()`. Public reads: `getEnabledTools()`, `getToolPage(locale, key)`, `getToolRelated(locale, key, count)` — all `"use cache"` + `cacheTag("content")`. |
| `packages/core/src/content-relations.ts`                              | `replaceMixedRelations` / `loadMixedRelationTargets` (§3.2 #6). `TOOL = "tool"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/web/app/(admin)/admin/tools/page.tsx`                           | NEW. The eight, with enabled state, last edit, related count and a link to each editor. Reorder is keyboard-only (plan 8.2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `apps/web/app/(admin)/admin/tools/[key]/page.tsx` + `tool-editor.tsx` | NEW, modelled on the glossary term editor (ADR-069): Content (title, tagline, intro, body, FAQ), **Configuration**, Related, Media, SEO, and a rail carrying only the enable toggle. `notFound()` for a key not in `TOOL_KEYS`.                                                                                                                                                                                                                                                                                                                                                             |
| `apps/web/app/(admin)/admin/tools/[key]/_panels/config-panel.tsx`     | NEW. Eight small panels behind one switch: instrument multi-selects, default values, windows, and the meter's basket editor (instrument, weight, direction), each validated against `TOOL_CONFIG_SCHEMAS[key]` by the same `useFieldErrors` the server action runs.                                                                                                                                                                                                                                                                                                                         |
| `apps/web/app/(admin)/admin/tools/[key]/_panels/related-panel.tsx`    | NEW. The articles' `RelatedPanel` shape, widened to mixed types: one ordered list whose rows carry a type badge, and an `AdminCombobox` per type to add from.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/app/(admin)/admin/tools/actions.ts`                         | NEW. `requirePermission("tools.update")` / `("tools.publish")` first, Zod, core, audit, `revalidateTag("content", { expire: 0 })`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/i18n/messages/en.json`                                      | `admin.tools.*`. **`admin.tools` must be an object, not a string** — the `admin.glossary` collision (ADR-069) is the precedent, and nothing static catches it.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Tests                                                                 | `tools.integration.test.ts` (save is one transaction; a config that does not match the key is rejected; the source hash covers every prose field, an FAQ-only edit included; mixed relations keep their order across types). `tool-actions.test.ts` (permission denied at the DB).                                                                                                                                                                                                                                                                                                          |

---

### PR T6 — public: the index, the shell, and the five tools that need no data

| File                                                                                | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(public)/[locale]/tools/page.tsx`                                     | REPLACES the `ComingSoon` render. `PageHero` masthead over generated art, an intro, and a card grid of the enabled tools (icon, title, tagline, "Open"). 404 when `calculators` is off. Indexable — the `robots: { index: false }` line goes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/app/(public)/[locale]/tools/layout.tsx`                                   | NEW. Renders the shared `SectionNav` with the enabled tools — the one section bar (ADR-076 §1), pinned at `top-(--header-offset)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `apps/web/app/(public)/[locale]/tools/[tool]/page.tsx`                              | NEW. The six-band flow: masthead → widget island → explainer body → FAQ (`FaqPanel`) → related strip → read-next → `RiskDisclaimer`. `generateStaticParams` over `TOOL_KEYS`; `notFound()` for an unknown or disabled key. Cached; no session read (ADR-056 #1).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `…/tools/_components/tool-shell.tsx`                                                | NEW. The band order in one place, so eight pages cannot drift into eight layouts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `…/tools/_components/related-strip.tsx`                                             | NEW. Curated-then-topped-up mixed cards, each badged by type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `…/tools/_widgets/position-size.tsx`                                                | NEW client island. Account currency, balance, risk %, stop-loss pips, pair → amount at risk, units, standard/mini/micro lots. Takes the rate snapshot as a prop and says when it is stale; with no snapshot it still works for a same-currency account and says why the rest is unavailable.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `…/_widgets/pip-value.tsx`, `gain-loss.tsx`, `pivot-points.tsx`, `market-hours.tsx` | NEW islands. Pivot ships **manual mode only** here — autofill arrives with T7 — and renders all five methods as one table inside its own `overflow-x: auto` container. Market hours: a timezone selector defaulting to the visitor's own, a 12/24-hour toggle, then **a horizontal 24-hour timeline** — each session drawn as a band across the day in the chosen timezone, with a now-marker — and the four session rows beneath it, keeping the volume band. The timeline is the page's main draw on the reference, so it ships with the tool rather than after it; it reads in RTL for the `ar` smoke test and scrolls inside its own `overflow-x: auto` container at 400px rather than pushing the page sideways. |
| `…/tools/_content/tools-media.ts` + `apps/web/scripts/generate-tools-art.mjs`       | NEW. The ADR-047 §3 pattern, sixth instance; committed, byte-deterministic output. A `Tool.coverAssetId` wins over the generated panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/i18n/messages/en.json` (+ es/ar/ur)                                       | A new **public** `tools` namespace — every field label, result label, unit and empty state. Public namespaces must be complete for every enforced locale (ADR-043 #1), so `check:catalog-completeness` is the gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Tests                                                                               | A component test per island covering the maths path and the invalid/empty path; `tool-page.test.tsx` for band order and the disabled-tool 404; RTL smoke (`ar`) asserting no horizontal overflow on either wide surface — the pivot table **and the market-hours timeline**.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

---

### PR T7 — the rate-backed tools

| File                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…/tools/[tool]/page.tsx`                       | Reads `getRateSnapshot()` for the three tools whose `needs` is `"rates"` and passes it down. One read per page, cached (§3.2 #7).                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `…/_widgets/currency-converter.tsx`             | NEW island. Amount, from, to, a swap button, the rate used, the "as of" line, and a short list of common conversions. Cross-rates via USD. A **"What kind of rate?"** control — Market / Bank / ATM / Card / Kiosk — applies the `config`'s markup percentage to the mid-market rate and shows both the adjusted amount and what the markup costs, in words. It is client-side arithmetic on the same snapshot: no second request, and the stored mid-market figure is never touched. The copy calls them typical markups and names no provider. 404s when `currency_converter` is off. |
| `…/_widgets/pivot-points.tsx`                   | Gains autofill: interval (1D/1W/1M/1Y) and symbol pull OHLC from `getOhlc`; switching to Manual keeps the fetched numbers as the starting values rather than clearing the form.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `…/_widgets/position-size.tsx`, `pip-value.tsx` | The account-currency leg via `accountPipValue`, with the conversion shown, not hidden.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tests                                           | The snapshot's stale flag reaches the screen as words; a missing rate degrades to a labelled disabled state rather than `NaN`; cross-rate arithmetic matches `crossRate`; a non-market rate type shows the markup cost and leaves the mid-market figure alone.                                                                                                                                                                                                                                                                                                                          |

---

### PR T8 — correlation and the risk meter

| File                                    | Change                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/market-analytics.ts` | NEW. `getCorrelationMatrix(window)` and `getRiskSentiment()` — both `"use cache"`, `cacheTag("market")`, `cacheLife({ revalidate: 3600 })`, both computed from `MarketDailyBar` — the `close` column and nothing else — with no extra table. A component with too few bars is **excluded and counted**, never zero-filled.                 |
| `…/_widgets/correlation.tsx`            | NEW island. The window tabs (5d…250d), a row per base instrument, each cell a signed coefficient on a −1…+1 bar. Colour is not the only channel — the number is always printed.                                                                                                                                                            |
| `…/_widgets/risk-sentiment.tsx`         | NEW island. The 0–100 meter with its band, a 60-day sparkline, a gauge per component, "as of", and a plain-English line saying how many components reported. **No copy here says "real-time" or "live"** (ADR-086): the score moves once per daily sweep, and the "as of" line and the methodology panel are where that cadence is stated. |
| `…/tools/_components/methodology.tsx`   | NEW. A collapsed panel on both pages stating ADR-086's definitions in the reader's words. A number a reader cannot interrogate is worse than no number.                                                                                                                                                                                    |
| Tests                                   | Fixture bars → known coefficients (cross-checked against a hand calculation in the test); a below-minimum sample renders "—"; the meter is monotone in a component's rank; weights summing to zero are refused at the contract, not at render.                                                                                             |

---

### PR T9 — navigation, sitemap, and the homepage

| File                                               | Change                                                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/seed.ts`                       | The `tools` header row gains eight children (route keys from `TOOL_ROUTE_KEYS`); the footer's "Markets & Tools" column gains the four most-used.                                                                      |
| `apps/web/app/(public)/[locale]/_nav/mega-menu.ts` | A `tools` panel in the About/track shape (ADR-076 §2): three headed columns — Position & risk / Market timing / Rates & relationships — an icon per tool, and a "view all" footer.                                    |
| `…/_sections/explore-destinations.ts`              | `tools` flips to `status: "live"`; `explore-destinations.test.ts` then requires the route to have stopped rendering `<ComingSoon `.                                                                                   |
| `…/_components/coming-soon.tsx`                    | `COMING_SOON_SECTIONS` drops `"tools"`, leaving `["markets"]`.                                                                                                                                                        |
| `apps/web/app/sitemap.ts`                          | The index plus the enabled tools, per locale.                                                                                                                                                                         |
| `packages/db/prisma/seed.ts` (home)                | `popular_tools` flips to `enabled: true`, limit 4. **Needs `pnpm db:reset` to appear** — the note changes-09 already carries.                                                                                         |
| `…/_sections/popular-tools.tsx`                    | NEW homepage section reading the enabled tools in `sortOrder`.                                                                                                                                                        |
| Tests                                              | `learn.test.ts`'s sibling for tools — the seeded tree, the panel and `TOOL_ROUTE_KEYS` name the same destinations, failing on whichever half is forgotten. `public-chrome.test.ts` still finds no counted stat strip. |

---

### PR T10 — the gate

| File                               | Change                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/tools.spec.ts`       | NEW. One deep journey (open `/tools`, pick position size, fill it, read a result, follow a related card into a lesson) plus axe on the index and all eight tools.                       |
| `apps/web/e2e/admin-tools.spec.ts` | NEW. Happy path and permission-denied, **denied asserted at the DB** (testing.md #1).                                                                                                   |
| Lighthouse budget                  | `/tools` and `/tools/[tool]` join the public budgets; eight interactive widgets are the first real client-JS weight on a public route since the quiz runner, so the budget is blocking. |
| `docs/logs/DEVLOG.md`              | The entry: what shipped, the three ADRs, test results, and what is deferred.                                                                                                            |
| `CLAUDE.md`                        | Module 13 and 12 rows updated to the shipped state.                                                                                                                                     |

---

## 7. Criterion → test

| Criterion                                                                                                 | Test                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Every tool key has a route, a config schema and an icon, and no orphan `tool-*` route exists              | `contracts/tools.test.ts`                                   |
| Pearson stays in [−1, 1], is symmetric, and self-correlates at 1 for any input                            | `statistics.test.ts` (fast-check)                           |
| Floor pivots always order S3 < S2 < S1 < PP < R1 < R2 < R3                                                | `calculators.test.ts` (fast-check)                          |
| `gainLoss` round-trips from each of its three entry points                                                | `calculators.test.ts`                                       |
| Sessions respect DST and the weekend gap                                                                  | `market-hours.test.ts` (fixed instants across a DST change) |
| The provider view type cannot carry the API key, and no reader but `loadProviderDriver` opens it          | `market.integration.test.ts` + `expectTypeOf`               |
| A blank key field leaves the stored key intact                                                            | `market-admin.integration.test.ts`                          |
| The sweep is idempotent within a day; a provider failure preserves yesterday's bars and records the error | `market.integration.test.ts`                                |
| An instrument with no bars gets full history on its first successful sync, and only the tail after that   | `market.integration.test.ts`                                |
| A 1W, 1M or 1Y bar is the first open, the highest high, the lowest low and the last close                 | `market.integration.test.ts`                                |
| The cron route fails closed with no `CRON_SECRET` and rejects a wrong one in constant time                | `market-sync.route.test.ts`                                 |
| A stale rate snapshot reaches the screen as words, and a missing rate never renders `NaN`                 | `currency-converter.test.tsx`, `position-size.test.tsx`     |
| A non-market rate type shows the markup cost and never changes the stored mid-market figure               | `currency-converter.test.tsx`                               |
| A below-minimum sample renders "—" rather than a number                                                   | `market-analytics.integration.test.ts`                      |
| The meter excludes a silent component and says how many reported                                          | `risk-sentiment.test.tsx`                                   |
| Saving a tool is one transaction, and the source hash covers every prose field, `faq` strings included    | `tools.integration.test.ts`                                 |
| Mixed related items keep their order across types                                                         | `content-relations.integration.test.ts`                     |
| A short curated list is topped up; the strip never renders empty                                          | `tools.integration.test.ts`                                 |
| Every tool and market action refuses a subject without its key, denied at the DB                          | `tool-actions.test.ts`, `market-actions.test.ts`            |
| `tools` is a registered permission group with keys, and the seed agrees                                   | `permission-groups.test.ts`                                 |
| A disabled tool 404s and leaves the section bar                                                           | `tool-page.test.tsx`                                        |
| Admin dropdowns are `AdminCombobox`; every modal has a title and a description; every field is a `Field`  | existing `admin-*-conventions.test.ts`                      |
| No arbitrary Tailwind value, no physical property, no hex literal, no non-lucide icon                     | `pnpm lint`                                                 |
| The public `tools` namespace is complete for every enforced locale                                        | `check:catalog-completeness`                                |
| Every permission string used exists in the seed registry                                                  | `check:permission-keys`                                     |
| `/tools/*` passes axe with no serious or critical violation, in `en` and `ar`                             | `e2e/tools.spec.ts`                                         |
| The pivot table and the market-hours timeline scroll rather than pushing the page sideways at 400px       | RTL smoke                                                   |

**Coverage floors (testing.md #1):** `@repo/utils` and `@repo/contracts` are
pure-logic — 90%, and the new maths files are the reason that floor exists.
`@repo/core`'s market and tools services sit at the 80% service floor.
`@repo/secrets` inherits `secret.test.ts` and stays at 90%.

---

## 8. Not in scope

- **Charts.** No candlesticks, no technical indicators, no MarketMilk
  equivalent. The meter's sparkline is the only time series that ships.
- **`/markets`.** Still `ComingSoon`; this plan builds the data layer it will
  later stand on, and nothing else.
- **A tools search, or user-saved presets.** Both need an account read on a
  cached page (ADR-056 #1) and can follow the quiz island's pattern later.
- **Premium gating.** `currency_strength` stays seeded off and unbuilt.
- **Intraday data.** The store is daily bars. Every intraday claim the
  reference makes is out of scope, which is why the pivot calculator offers no
  1m/15m/30m/1h/4h interval. **1Y is in scope**: it folds daily bars exactly as
  1W and 1M do, so it needs nothing the sweep does not already store.
- **The converter's historical chart.** The reference's 7D–5Y "what $100 has
  been worth" series is deferred, not rejected — the daily bars this plan stores
  make a 1Y version possible later without a schema change.
- **Regulatory Organizations.** The reference's ninth tools page is a static
  content page, not a widget; it belongs to the articles or About surface, not
  to this plan.
- **Alerts** ("tell me when the meter flips") — that is the changes-21 mail
  platform plus a worker, not this.

## 9. Risks

1. **Provider coverage.** AlphaVantage serves FX and crypto well, indices and
   commodities patchily. Mitigation: the meter's basket is admin-editable, a
   silent component is excluded and counted, and the `MANUAL` driver exists so
   the whole platform is testable and demonstrable with no key at all.
2. **Free-tier rate limits.** The sweep costs one request per instrument per day
   and the live path is cached for five minutes; ~28 instruments do not fit a
   25-request/day tier in one pass, and a first-run backfill costs the same one
   request per instrument. So the sweep orders instruments by **oldest stored
   bar first** — never-synced ones ahead of everything — and simply stops when
   the budget runs out. Resumption is implicit: the next run's ordering puts
   whatever was skipped at the front, so there is no cursor column to store or
   to drift. The admin screen shows per-instrument freshness precisely so this
   is visible rather than mysterious.
3. **A second sealed secret sets a pattern.** ADR-085 says plainly that it is the
   second and last without a further ADR, and states the test a third would have
   to pass.
4. **Eight interactive islands on public routes.** The first real client-JS
   weight since the quiz runner. Mitigation: one island per page, never eight; no
   charting library; the Lighthouse budget in T10 is blocking.
5. **Numbers imply advice.** A calculator that outputs a position size is one
   misreading away from being taken as a recommendation. Mitigation: the
   methodology panel, the risk disclaimer on every tool page, and ADR-086's "what
   this is not" section.
