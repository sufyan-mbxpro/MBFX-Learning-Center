-- Deactivate the instruments no shipped driver can ever serve as daily bars.
--
-- A DATA migration, for the reason every other one in this repo is: the
-- instrument seed is an upsert whose `update` clause is `{}`, so a change to
-- the seeded row reaches a FRESH install only.
--
-- ── Why ─────────────────────────────────────────────────────────────────
--
-- Six instruments were seeded active that neither shipped driver can fill.
-- `MANUAL` serves nothing. AlphaVantage's free tier has no physical-currency
-- entry for XAU or XAG, so `FX_DAILY` rejects them; it prices gold, silver and
-- WTI one number a day, and a bar invented from one price would claim a high
-- and a low nobody measured (ADR-087 #2); and `INDEX_DATA` is paid-tier only.
-- `ALPHAVANTAGE_BAR_KINDS` already keeps the sweep from spending a request on
-- them — but `syncDailyBars` names every one of them under "Not available from
-- this provider" on every single run, which is an admin being handed a list to
-- act on that nothing they do can shorten.
--
-- ── Deactivated, not deleted ────────────────────────────────────────────
--
-- The rows are not wrong; they are unreachable from HERE.
-- `MARKET_BOARD_GROUPS.commodities` still names XAU/XAG/WTI for the live-rates
-- frame, which reads TradingView's own tickers and is unaffected either way,
-- and an instance that buys a provider serving metals flips three switches
-- back on instead of re-deriving the table. On the volatility board an
-- inactive row lands in `missing` — which is exactly where an active row with
-- no bars was already landing, so nothing a reader sees changes.
--
-- ── Bounded ─────────────────────────────────────────────────────────────
--
-- To a row that still has NO BARS AT ALL. An install that has loaded history
-- for gold from somewhere — a paid provider, an import, a driver added after
-- this migration was written — is matched by nothing here and keeps its
-- instrument switched on. This is the same discipline the settings migrations
-- use: touch only what still holds the state the seed left.
UPDATE `market_instruments` AS `i`
SET `i`.`isActive` = 0
WHERE `i`.`symbol` IN ('XAU/USD', 'XAG/USD', 'SPX/USD', 'NDX/USD', 'WTI/USD', 'DXY/USD')
  AND `i`.`isActive` = 1
  AND NOT EXISTS (
    SELECT 1 FROM `market_daily_bars` AS `b` WHERE `b`.`instrumentId` = `i`.`id`
  );
