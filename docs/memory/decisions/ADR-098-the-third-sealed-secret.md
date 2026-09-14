# ADR-098: The AI provider key — the third sealed database secret, and the last for a different reason

**Status:** Accepted
**Date:** 2026-09-14
**Module:** 18 (AI platform), 01 (db), 03/10 (rbac, roles), 09 (admin shell)
**Supersedes:** —
**Extends:** ADR-078 #3 (the first sealed secret), ADR-087 #5 (the second, and
the three-part bar this ADR is written to clear), security.md #10
**Superseded by:** —

## Context

security.md #10 says secrets live in environment variables. Two exceptions
exist: the SMTP password (ADR-078 #3, super_admin-only) and the market data
provider key (ADR-087 #5, gated on `market.providers.manage`). ADR-087 closed
its own section with a bar rather than a prohibition:

> **This is the second and last without a further ADR.** A third would have to
> show, in its own ADR, that the secret (a) cannot live in env because a
> non-deploying admin must rotate it, (b) has exactly one reader, and (c) has a
> stated blast radius that justifies its chosen gate.

The owner's brief asks for admin-entered AI provider keys, stored encrypted,
never in `.env`, never exposed to the client. This ADR is the further ADR, and
it answers (a), (b) and (c) in order.

## Decision

**1. `AiProvider.apiKeyCipher` holds the provider key, AES-256-GCM-sealed under
`AI_SECRET_KEY`, through `@repo/secrets`.** The seal is `v1:<iv>:<tag>:<ct>`,
so rotation is a version bump. **The key itself stays in env.** No new crypto
is written: `@repo/secrets` is the one primitive both existing owners already
use (ADR-087 #6), and `@repo/ai` delegates to it exactly as `@repo/email` does,
translating its errors into this package's own types at the boundary.

**2. (a) Why it cannot live in env.** The owner's instruction is explicit —
"never in .env for admin-entered keys" — and the operational case is stronger
here than for either predecessor. An AI key is the one credential an
organisation rotates on a **billing** event: a leaked key, a spend spike, a
provider switch mid-month. A rotation that requires a redeploy will not happen
at 2am when the spend alert fires, and the person who needs to do it is the
person holding the budget, not the person holding the deploy pipeline.

**3. (b) One reader, and the type makes it one.** `loadProviderDriver()` in
`packages/ai/src/provider.ts` selects `apiKeyCipher`. Nothing else does.
`AiProviderView` has **no key property at all** — absent, not omitted — so
there is no shape through which it can serialise into an RSC payload by
accident; a leak has to get past the type, not just past a reviewer. A source
guard fails any other file in the package that names the column.

**4. (c) The blast radius, stated rather than inferred.** This key is neither
of its predecessors, and saying how is what stops "sealed secret" spreading by
resemblance:

|                                         | SMTP (ADR-078)                | Market (ADR-087)          | **AI (this)**                                         |
| --------------------------------------- | ----------------------------- | ------------------------- | ----------------------------------------------------- |
| Captures something delivered to a user? | **Yes** — the next reset link | No                        | No                                                    |
| Costs money when abused?                | Little                        | Little (free tier)        | **Yes, and unbounded**                                |
| Repointing `baseUrl` exfiltrates…       | credentials                   | a price nobody trusts     | **every prompt** — the unpublished editorial pipeline |
| Gate                                    | super_admin                   | `market.providers.manage` | **`ai.providers.manage`, seeded to super_admin only** |

ADR-087 gated its key loosely because it "buys read-only market quotes" and
"nothing is delivered TO a user through this host". The first half is false
here — this key spends real money with no ceiling the victim controls — and
while the second half is true, it is not the only harm that matters: an
attacker-controlled `baseUrl` receives **every prompt this platform sends**,
which is the site's unpublished articles, lessons and drafts, continuously,
without touching the database or leaving an audit trail.

**5. The gate is a key, seeded to super_admin alone.** `ai.providers.manage`
joins `email.settings.manage`, `roles.manage`, `permissions.assign` and
`users.impersonate` in the `admin` role's exclusion list. It is deliberately a
**permission key** rather than a hardcoded `userType` or role test, so that a
later organisation can grant it to a non-super_admin deliberately — with its
own ADR — instead of by editing a condition.

The three sibling keys are **not** super_admin-only: `ai.settings.manage`
(switches, budget, limits, tiers), `ai.usage.view` (the meter) and `ai.use`
(spending against a configured provider) are ordinary `admin` capabilities.
The screen splits by permission rather than hiding whole, as ADR-078 #4's
settings screen does.

**6. Write-only in the UI, and the caption carries the state.** The key field
renders empty over a stored key; blank on save means **unchanged**, never
"clear". The placeholder distinguishes _no key saved_ from _a key is saved and
will not be shown to you_, because an empty box with no caption cannot express
which, and the difference decides whether leaving it alone is safe. The
contract says so, the service implements it, and an integration test pins it —
`provider-form.tsx`'s existing comment is the specification.

**7. Absence of `AI_SECRET_KEY` degrades, it does not throw.**
`hasSecretKey()` false means the providers screen says so in words and the
platform falls back to the `ECHO` driver. Losing the key means re-entering the
provider keys; that is the design, and the screen says it.

**8. A fourth sealed secret keeps ADR-087's bar, with one addition.** It must
still answer (a), (b) and (c) — and it must now also say why it is not
satisfied by one of the three seals that already exist. Three is where a
pattern starts looking like a default.

## Consequences

- **`AI_SECRET_KEY` joins `.env.example`** (name only) beside
  `EMAIL_SECRET_KEY` and `MARKET_SECRET_KEY`, and the local-setup note about
  generating a base64 32-byte value now covers three.
- **An instance without it still runs.** Every screen renders, the meter works,
  and every feature reports that no provider is configured — the ADR-087 #11
  shape.
- **Only a super_admin can configure AI.** On a small team that is one person,
  which is friction. Accepted: the alternative is an `admin` who can silently
  redirect the entire draft pipeline to a host they control.
- **The dev-server reload trap applies to this key too.** An edited `.env` does
  nothing until `next dev` restarts (DEVLOG 2026-09-14), and the failure reads
  as a rejected credential. The providers screen's secret-key warning names
  the restart.

## Alternatives rejected

- **Env-only, like every other secret.** The safer default, and the owner
  declined it for the second time in this repo's history (ADR-078 D1 was the
  first). The exception is narrowed to one field, one reader and one role
  instead.
- **Gating on `ai.settings.manage` like the market key.** Rejected on the
  table in #4: this key's abuse costs money and exfiltrates drafts, which is
  not "lying about the price of EUR/USD on a page that carries a disclaimer".
- **A hardcoded super_admin check instead of a key.** It would make a future
  deliberate grant a code change, and it would be invisible to
  `check:permission-keys` and to the role editor.
- **Per-user or per-workspace keys.** No use case; more secrets, more readers,
  and a per-user key makes the usage meter's "who spent this" ambiguous rather
  than clearer.

## Compliance

- `packages/ai/src/secret.test.ts` — round trip, tamper detection, and **no
  plaintext fallback when the key is absent** (`email/secret.test.ts`'s shape;
  ADR-087 #6 proved that suite survives the extraction untouched).
- `packages/ai/src/provider.test.ts` — the source guard: no file but
  `provider.ts` names `apiKeyCipher`, and `AiProviderView` has no key property
  at the type level.
- `packages/core/src/ai-admin.integration.test.ts` — the view never carries the
  key, at runtime and at the type level.
- `apps/web/app/(admin)/admin/_actions/ai-actions.test.ts` +
  `seed-roles.test.ts` — an `admin`-level subject can save limits and features
  but can neither save, test nor delete a provider, and no role but
  `super_admin` holds `ai.providers.manage`.
- `pnpm check:permission-keys` — the four new keys exist in the seed registry.
