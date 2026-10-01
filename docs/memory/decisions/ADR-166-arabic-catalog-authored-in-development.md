# ADR-166 — The Arabic interface catalog is authored in development, not by the catalog script

- **Status:** Accepted
- **Date:** 2026-09-28
- **Module:** 06 (i18n)
- **Plan:** `docs/changes/multilingual-automation-plan.md` §4.4 and §6 Phase 6.
- **Decides:** plan §7 open item 1: **Arabic is the first real locale** (owner,
  2026-09-28).
- **Deviates from:** plan §4.4's "catalog-fill script … uses `@repo/translate`'s
  driver" for this one catalog. The script, its ICU handling and Google stay
  as they are for every later language and for content.

## Context

Phase 6 starts by filling `ar.json`'s public namespaces. The plan's route is
`pnpm translate:catalog -- --locale ar`, through Google. This install has no
translation provider row and no `TRANSLATE_SECRET_KEY`, so that route cannot
run without first setting up a paid key. The owner chose to have the catalog
written in the development session instead (Claude, the coding assistant).

`ar.json` today holds 380 public keys and misses 976 (31,998 characters of
English). Some of the 380 no longer translate the current English:
`home.heroTitle` still says "Learn to trade the markets" in Arabic, while the
English has read "Learn the market before you risk anything in it" since the
changes-28 homepage pass. `check:catalog-completeness` checks that a key is
present, not what it says, so such a value passes every gate.

## Decision

1. **Arabic is the first locale** to be switched on (plan §7 item 1).
2. **The missing keys are written in the session**, not by Google. It is
   machine-written text in ADR-159's sense and is treated that way: the PR
   lists it for a person's review before the locale is switched on, as the
   plan already required of the script's output.
3. **The same gates as the script, run as a check rather than trusted.** Every
   Arabic message must parse as ICU; carry exactly the English message's
   arguments and rich-text tags; and give every plural argument the categories
   Arabic uses (`zero`, `one`, `two`, `few`, `many`, `other`, from
   `Intl.PluralRules("ar")`). A message that fails is not written.
4. **Existing values that no longer translate the current English are
   rewritten**, and listed in the DEVLOG. The script's rule — never overwrite
   a value already in the file — protects a person's work; these values were
   the seed's, and serving them would put a stale claim on a translated page.
5. **Numbers, product names and the brand stay as they are** (`MBX`, `MBFX`,
   `forex` currency codes such as `EUR/USD`, `MT4`). Western Arabic digits are
   kept, because every figure on the site is rendered by `Intl` in the page's
   locale and a digit typed into a message would disagree with it.
6. **`ar` joins `ENFORCED_LOCALES` in the same change**, so CI fails from now on
   when a public key is added to `en.json` without its Arabic. This is the
   plan's "activation PR" gate; it does not switch the locale on. Switching on
   stays an admin action (ADR-163), and is still refused until a person has
   written the two legal settings in Arabic (ADR-165 #9).

## Consequences

- Every later public key costs an Arabic value in the same PR.
- The catalog carries no Google cost and no metering row; nothing in
  `TranslateUsage` describes it.
- The plural review list the script would have produced is replaced by the
  validation in #3 and the DEVLOG's list of plural keys.

## Alternatives rejected

- **Wait for a key and run the script.** The owner chose not to block on it.
  The script remains the route for `ur` and later locales.
- **Fill only the missing keys.** It would ship the stale values in #4 behind a
  green completeness check.
