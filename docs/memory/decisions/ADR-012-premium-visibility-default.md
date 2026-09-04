# ADR-012: `PREMIUM` feature-flag visibility defaults to STAFF-only

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 05 (`@repo/settings`) — SKILL.md flagged this explicitly: "PREMIUM
has no real modeling yet, needs a documented conservative default."
**Supersedes:** —
**Superseded by:** —

## Context

`FeatureFlag.visibility` is `PUBLIC | AUTHENTICATED | PREMIUM | ADMIN`
(`packages/db/prisma/schema.prisma`). `PUBLIC`, `AUTHENTICATED`, and `ADMIN`
map cleanly onto data the system already has: no session, any session, and
`userType === "STAFF"` respectively. `PREMIUM` does not — there is no
subscription, plan, or entitlement model anywhere in the schema yet. A
learner today has no field that could ever make a `PREMIUM` check pass.

`isFeatureVisible()` still has to return _something_ for a `PREMIUM` flag,
because Module 08 (navigation) and later content modules call it
unconditionally for every flag in the registry regardless of whether that
flag happens to be gated by a tier that doesn't exist yet.

## Decision

Until a subscription/entitlement model lands, `PREMIUM` evaluates as
**visible to `STAFF` only** — the same outcome as `ADMIN`. A learner sees a
`PREMIUM`-gated feature as absent, exactly as if it were disabled; staff can
still preview it in the admin-facing surfaces that reuse the same
evaluator, which is what makes the flag safely toggleable and testable
before the entitlement system exists.

The alternative — treating `PREMIUM` as equivalent to `AUTHENTICATED` — was
rejected because it would silently grant every signed-in learner access to
a feature explicitly marked as gated, the exact kind of privilege
escalation-by-omission `security.md` exists to prevent. A missing model is
not consent to grant the broader tier.

`isFeatureVisible()` documents this default inline with a
`// ADR-012` reference, and the flag-matrix truth test
(`packages/settings/src/index.test.ts`) asserts a learner subject sees
`PREMIUM` as `false` and a staff subject sees it as `true`, so a future
entitlement model can't quietly regress this without failing a test that
names the ADR.

## Consequences

- No learner-visible `PREMIUM` feature can exist until this ADR is
  superseded by the entitlement model landing (currently no module in the
  index owns that — flag it when scoping a "billing"/"entitlements" module).
- Seeding a `PREMIUM` flag today (e.g. `market.currency_strength`) is safe:
  it behaves as staff-only/disabled-to-learners, not as a broken always-on
  or always-off flag.
- Whoever builds the entitlement model must revisit `isFeatureVisible()`'s
  `PREMIUM` branch and this ADR together — the conservative default is
  deliberately named here so it's easy to find.

## Alternatives considered

- **Treat `PREMIUM` as `AUTHENTICATED`.** Rejected — see Decision; grants
  access the flag was explicitly marked to withhold.
- **Throw on `PREMIUM` until modeled.** Rejected — `isFeatureVisible()` is
  called in render paths (navigation, page guards); throwing there turns a
  seeded-but-unbuilt tier into a 500 instead of the feature simply not
  appearing, which is a worse failure mode for an unfinished feature.

## Compliance

- Reviewed when an entitlement/billing module is scoped: confirm `PREMIUM`
  gets real modeling and this ADR is superseded, not silently bypassed.
