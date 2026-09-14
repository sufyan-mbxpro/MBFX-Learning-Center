# ADR-099: The provider abstraction is ours — official SDKs behind a seam, and three model tiers in front of it

**Status:** Accepted
**Date:** 2026-09-14
**Module:** 18 (AI platform), 05 (settings)
**Supersedes:** —
**Extends:** ADR-078 #2 (the transport is a seam, not a provider), ADR-087
(the market driver), ADR-097 (the platform)
**Superseded by:** —

## Context

The owner asked for multiple providers — Anthropic, OpenAI, others — with a
default and per-feature model selection, and asked explicitly whether to build
a thin layer or adopt the Vercel AI SDK.

The repo has answered the structurally identical question twice.
`EmailTransportDriver { send; verify }` (ADR-078 #2) has two implementations
and a third planned; the market driver has two and a `MANUAL`. Neither adopted
a vendor abstraction, and both have since been extended without rework.

A second question arrived during review. The plan's first draft seeded
`claude-opus-5` for every feature and called the cheaper choice the owner's to
make. The owner overruled it: at a $50 monthly cap, Opus on alt-text and
grammar burns the month in a busy editing week, on tasks where the quality
difference is not visible in the output.

## Decision

**1. The seam is ours.** `AiDriver { complete; stream; countInputTokens;
test }` with three implementations: `anthropicDriver` over
`@anthropic-ai/sdk`, `openaiDriver` over `openai`, and `echoDriver` — a
deterministic local driver that returns a labelled placeholder and records a
zero-cost usage row. `echoDriver` is the `MANUAL` of ADR-087 #11 and the
`logDriver` of ADR-078 #2: it is what makes the platform demonstrable,
seedable and testable with no key, and what a missing `AI_SECRET_KEY` falls
back to.

Four reasons, heaviest first:

1. **Two working precedents.** A third abstraction layered over a fourth is
   how a codebase acquires two ways to swap a provider.
2. **The seam is where our policy lives, and our policy is not a library's.**
   Budget refusal before the call, the three-way output clamp, the usage row,
   the abort path and the error taxonomy are ours, and all of them have to be
   unskippable (ADR-097 #2, #8).
3. **Weight and blast radius.** `@repo/ai` is server-only and admin-only. The
   Vercel SDK's React half is precisely the part we would not use, and its
   provider packages wrap the two SDKs underneath anyway.
4. **Token accounting is provider-shaped and must stay exact.** Anthropic
   reports `input_tokens`, `output_tokens`, `cache_creation_input_tokens` and
   `cache_read_input_tokens` separately, and the last two are priced
   differently. An abstraction that flattens them to
   `{ promptTokens, completionTokens }` makes ADR-100's cost figure wrong by
   construction.

**2. Retries, timeouts and typed errors are the SDKs'; the taxonomy is ours.**
Bounded at two retries and 60 seconds. A timeout is one `FAILED` row, never a
silent retry loop. `AiError.reason` is a closed union —
`globally_disabled`, `feature_disabled`, `budget_exceeded`, `rate_limited`,
`no_provider`, `missing_key`, `secret_unreadable`, `provider_auth`,
`provider_rate_limit`, `provider_timeout`, `provider_error`,
`content_too_large`, `aborted` — and the usage row stores the reason,
**never** the provider's message text, which can quote the prompt back.

**3. Model selection is three tiers, resolved in three steps.** The registry
entry declares a `modelRole` of `light | standard | heavy`; three settings keys
(`ai.model.light` / `.standard` / `.heavy`) name what each tier resolves to;
`AiFeature.modelId` is an explicit per-feature override. Resolution order:

```
AiFeature.modelId  →  the tier model for the entry's modelRole
                   →  the default provider's first enabled model
```

Seeded tiers: `light` = `claude-haiku-4-5` ($1/$5 per MTok), `standard` =
`claude-sonnet-5` ($2/$10), `heavy` = `claude-opus-5` ($5/$25).

**4. The tier belongs to the registry entry, not only to the feature row, and
that is the whole reason tiers exist.** `fix_grammar` is an _action inside_
`writing_assistant`, not a feature: one feature, one row, one model column.
"Grammar on Haiku, drafting on Opus" cannot be expressed by a per-feature model
column at all. The alternatives were splitting `fix_grammar` into its own
feature key — two switches for what an admin thinks of as one tool — or adding
a second model column for light actions, which is a column that exists for one
case. So `AI_ASSISTANT_ACTIONS` entries carry a `modelRole` alongside
`AI_FEATURES` entries, and both resolve through the same three steps.

Seeded roles: `alt_text`, `translation` and `fix_grammar` are `light`;
`seo_generation`, `summarization`, `quiz_generation` and the assistant's
`summarize` are `standard`; the assistant's `draft`, `expand` and
`change_tone` are `heavy`.

**5. Effort moves with the tier.** `thinking: { type: "adaptive" }` on every
call, with a per-entry `effort` in the registry — `low` for alt-text and
grammar, `medium` for SEO, summary, translation and quiz generation, `high`
for drafting. A `light` entry at `high` effort is a Haiku bill pretending to be
a Haiku bill. Effort is code, not a control: it is behaviour (ADR-097 #3).

**6. A tier holds a model id string, not an `AiModel` row id.** So a tier keeps
its meaning when a provider row is deleted and re-created, and a tier naming a
retired model falls through to the default provider's first enabled model
rather than throwing.

**7. Versions are pinned in `docs/memory/stack.md` at install time, after a
registry sweep** (Part F #9). This ADR deliberately names no version number: a
number written a week before the install is a number nobody swept.

## Consequences

- **Two SDK dependencies.** Confined to a package `app/(public)` never
  imports; `check:phantom-deps` and the public Lighthouse budgets are the
  guards.
- **One extra concept** — `modelRole` — that a reader of `AiFeature` alone
  will not see. Mitigated in the UI: the features screen's empty model option
  reads "Standard tier (Sonnet 5)" rather than being blank, and the limits
  screen names the features each tier governs.
- **Changing a tier re-points several features at once.** That is the point —
  when a cheaper model lands, an admin moves one row instead of six — and the
  limits screen says so in words before the change.
- **The per-feature override still wins**, so the brief's "model selection per
  feature" survives intact rather than being replaced by tiers.
- **If the Vercel AI SDK is ever preferred**, `AiDriver` becomes an adapter
  over its model interface and nothing else changes. That is the reason this
  decision is low-regret, and the reason the seam — not the SDK — is the unit.
- **A new provider is a new driver file plus a `AiProviderKind` member**, not a
  change to any caller.

## Alternatives rejected

- **Vercel AI SDK (`ai` + `@ai-sdk/*`).** Genuine upside — one streaming
  protocol, one message shape, provider swap for free — and the reasonable
  choice for a greenfield app. Rejected on reasons 1 and 4 above, plus its own
  major-version churn against a repo whose stack file exists to stop ad-hoc
  bumps.
- **Raw `fetch` for both providers**, as the market driver does. It works and
  MSW tests it well, but hand-rolled SSE parsing plus backoff plus a typed
  error taxonomy is three wheels re-invented on the one path that is
  interactive.
- **One default model for everything.** Overruled by the owner; see Context.
- **Splitting `fix_grammar` into its own feature**, or **a second model column
  on `AiFeature`.** See Decision #4.
- **Prices or model ids as constants in code.** ADR-100's territory; a price
  correction must not be a deploy.

## Compliance

- `packages/ai/src/config.test.ts` — the three-step resolution at every step,
  including a tier naming a retired model (falls through, never throws), every
  registry entry's `modelRole` resolving to a seeded model, and the three-way
  output clamp picking the minimum.
- `packages/ai/src/run.test.ts` (MSW, `onUnhandledRequest: "error"`) — every
  refusal short-circuits before any HTTP call; a leaked request fails the
  suite. The market driver's trailing-slash bug is why that setting is not
  optional.
- `packages/ai/src/stream.test.ts` — deltas in order, usage off the final
  message, an abort writing `ABORTED` with the tokens observed.
- `pnpm check:ai-model-tiers` — a seeded tier naming a model the seed does not
  create fails the build.
- `docs/memory/stack.md` — the two SDK pins, with the sweep date.
