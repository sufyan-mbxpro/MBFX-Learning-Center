# SKILL — Module 18: `@repo/ai` (the AI platform)

ADR-097 (the platform), ADR-098 (the sealed provider key), ADR-099 (the
provider seam + model tiers), ADR-100 (cost estimation).
Plan: `docs/changes/changes-29-ai-platform.md` (PRs A0–A9, then B1–B6).

**Status: PHASE 1 COMPLETE (A1-A9, 2026-09-14).** `@repo/ai`, six tables, five
admin screens, one generation endpoint and the meter are all in. `ai.enabled`
ships `false` and the default provider is `ECHO`, so a fresh clone has a
working AI area that cannot spend a cent. **Phase 2 (B1-B6) is not started** —
no editor has an AI control yet, which is why the invariants below read as
rules rather than as descriptions of existing screens.

## The shape

```
packages/ai/src/
├── index.ts        # the ONLY door: runAiTask, streamAiTask, the views
├── secret.ts       # AI_SECRET_KEY + this package's error types (email/secret.ts's shape)
├── provider.ts     # AiDriver seam; loadProviderDriver() — THE ONE READER of apiKeyCipher
├── drivers/        # anthropic.ts | openai.ts | echo.ts
├── config.ts       # resolve a feature: registry + row + tier settings -> ResolvedFeature
├── pricing.ts      # tokens + price row -> Decimal. Pure. Property-tested.
├── usage.ts        # row + daily rollup + period counter, one transaction
├── budget.ts       # getBudgetState(), the cap transition, notify-once
├── prompts/<key>.ts # one PURE builder per feature key
├── errors.ts       # the closed reason taxonomy
└── testing.ts      # memory driver + fixtures; not exported from "."

packages/contracts/src/ai.ts       # AI_FEATURES + AI_ASSISTANT_ACTIONS + payload schemas
packages/core/src/ai-admin.ts      # the ADMIN's door: reads, writes, audit, notifications
apps/web/app/(admin)/admin/ai/     # usage (the landing screen) | features | limits | providers
apps/web/app/(admin)/admin/api/ai/run/   # the ONE generation endpoint (streams or JSON)
apps/web/app/api/cron/housekeeping/      # gains the 90-day AiUsage purge
```

`core → ai` and `apps/web → ai`. It depends on
`db / contracts / settings / secrets` and never on an app, on `core`, on
`auth`, or on `email`. **Nothing in `auth` may ever call it** — the session
path must not acquire a dependency that takes two seconds and spends money.

## Invariants

1. **AI never writes to the database.** Every result lands in a form field a
   human saves through the existing action, schema and permission check. This
   is the security property, not a UX preference: a model that cannot commit
   cannot be prompt-injected into committing. It binds hardest in B6 (quiz
   generation), where the integration test asserts **zero rows** between
   generation and Save.
2. **One door.** `runAiTask` / `streamAiTask` are the only exports that reach a
   provider. `index.test.ts` pins the export surface — a leaked driver export
   fails the suite.
3. **Metering lives in the seam's `finally`.** A feature cannot forget to log
   because a feature never logs. Row + daily rollup + period counter, one
   transaction, atomic increments. An aborted stream still meters what was
   billed.
4. **The log holds no prompt and no completion** (ADR-097 #7). `reason` is a
   closed taxonomy value, never a provider message — those quote the prompt
   back. Raw rows purge at 90 days; rollups are kept forever.
5. **The sealed key has one reader.** `loadProviderDriver()` selects
   `apiKeyCipher`; `AiProviderView` has **no key property at all**. A second
   reader is a schema-level mistake, not a style one.
6. **`ai.providers.manage` is super_admin-only** (ADR-098): a repointed
   `baseUrl` receives every prompt — the unpublished editorial pipeline.
   `ai.settings.manage`, `ai.usage.view` and `ai.use` are ordinary `admin`.
7. **The registry decides what exists.** A new feature needs five things: an
   `AI_FEATURES` entry, a prompt builder, a payload schema, a seed row and a
   catalog block. `contracts/src/ai.test.ts` names any half you forget. An
   admin can never mint a key, and can never replace a system prompt — only
   append ≤1000 escaped characters.
8. **Model selection is three steps:** `AiFeature.modelId` → the entry's
   `modelRole` tier (`ai.model.light|standard|heavy`) → the default provider's
   first enabled model. The tier exists because `fix_grammar` is an _action
   inside_ a feature, and a per-feature column cannot say "grammar on Haiku,
   drafting on Opus" (ADR-099 #4).
9. **Disabled, capped or unavailable means ABSENT, not disabled.**
   `ai-degradation.test.ts` fails on a `disabled` AI control — the
   `newsletter-signup.test.ts` precedent. Availability is a server-resolved
   prop, so an AI-off install ships no AI client code into the editor bundle.
10. **No new permission key per feature.** `ai.use` gates spend, the feature
    toggle gates existence, and `requireFeatureSurface()` makes the content key
    the admin already holds gate the save.
11. **Prompt builders are pure and content is delimited.** They take named
    fields — never a Prisma row, never settings, never a `User`. Authored
    content goes inside explicit markers that the system prompt names as
    material, never instructions. Tested against an injection corpus.
12. **No tools, ever.** No tool use, no web search, no code execution, in
    either phase. A model with no tools cannot be persuaded to use one.
13. **Structured output is parsed with the same schema the form uses**, with
    the column's own limits. An over-length meta description is a `FAILED` row,
    not a truncation.
14. **Cost is frozen at write time** (ADR-100). Re-pricing never rewrites
    history, and every figure on screen says "estimated" with a `pricedAt`
    date.
15. **The pre-flight check over-estimates**, so the last few dollars of a
    period are unusable. Documented, not a bug — the limits screen shows
    "available to spend".

## What Phase 1 learned

Three failures worth knowing before B1, all found by tests rather than by
running the thing:

- **`upsert` is not atomic, and the obvious fix is half of one.** Two
  concurrent meter writes race; catching the 1062 and retrying as an increment
  then fails with "record not found", because MariaDB's default REPEATABLE READ
  serves the retry a snapshot from before the other insert committed.
  `usage.ts` runs at `ReadCommitted` for exactly this (ADR-056's lesson, second
  domain).
- **Haiku 4.5 takes a different request shape.** `budget_tokens` is a 400 on
  the Claude 5 family; `output_config.effort` is a 400 on Haiku. Haiku is the
  seeded LIGHT tier, so the wrong shape is every alt-text and grammar call.
  `drivers/anthropic.ts` keeps an explicit table of provider facts, not a
  pattern over model ids, and an unknown id gets the modern shape.
- **`NOTIFY_ONLY` is identical to `DISABLE` unless the pre-flight check skips
  it.** The worst-case budget refusal fires the moment `availableUsd` hits
  zero, whatever the cap behaviour says.

## Where things go wrong

- **An edited `.env` does nothing until `next dev` restarts** (DEVLOG
  2026-09-14). `AI_SECRET_KEY` absent reads exactly like a rejected API key.
  The providers screen names the restart.
- **`admin.ai` must be an OBJECT in the catalog**, not a string — the
  `admin.glossary` collision (ADR-069) and nothing static catches it. The
  sidebar label is `admin.nav.ai`.
- **A blank model dropdown is a bug.** Its empty option reads "Standard tier
  (Sonnet 5)" — leaving a field alone has to be legible as a choice, the same
  rule as the write-only key caption.
- **MSW with `onUnhandledRequest: "error"`** in every driver test. A refusal
  that leaks an HTTP call must fail the suite; the market driver's
  trailing-slash bug is why.
- **`@repo/ai` cannot import `@repo/core`.** Anything needing bytes (B5's
  images) or a subject reads them in `core` and passes them in.
- **Admin-only weight.** Both SDKs are dependencies of a package
  `app/(public)` never imports (architecture.md #5). Check the public
  Lighthouse budget if that is ever in doubt.

## Owed to Module 14 (Phase 1's share is now due)

E2E for the five admin screens and each Phase 2 affordance (`fixme`, same
auth-setup reason as every admin spec); axe on the AI screens and on B4's
public takeaways block; a Lighthouse check that no AI client code reaches a
public route.
