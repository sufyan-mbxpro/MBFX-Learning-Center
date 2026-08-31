# SKILL — Module 13: Market layer

plan.md Module 13 + architecture doc §8's warning: market data never goes
into Prisma as a source of truth.

## Requirements

- Provider abstraction in `@repo/core`: interface + AlphaVantage
  implementation, swappable via `MARKET_DATA_PROVIDER` env.
- Live rates in Redis, TTL = provider refresh. **Never persist per-tick** —
  only the historical series worth charting goes to MariaDB.
- Economic calendar sync (new models), idempotent.
- Calculators (pip value, position size, margin) as PURE functions in
  `@repo/utils` — no I/O, table-tested.
- Admin config screens gated by `market.*` permissions.
- Failure posture: rate-limit or malformed payload from the provider
  degrades to stale cache — never crashes the page.

## Required tests

Calculator tables against hand-computed values (90% floor — pure logic);
provider adapter contract test against MSW-mocked API incl. rate-limit and
malformed-payload handling; Redis TTL behavior; calendar sync idempotency.
