# ADR-120: Guided AI provider setup, and OpenAI-compatible providers as a registry

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 18 (AI platform)
**Supersedes:** ADR-099's closed provider list (Anthropic, OpenAI, Echo). The seam, the three tiers and everything else in ADR-099 stand.
**Superseded by:** —

## Context

> review the Ai plan & add the generic api key settings like we can use
> claude,openai,..when we select the claude then it should show the api key as
> per claude first configure the api settings.. & make a test to check that
> connectivity then automatically show the all available models in dropdown
> and admin can select the models & other usage limit as per requirements

`/admin/settings/ai` fell through to `settings/[group]`, the generic key/value
form. It showed the three tiers as free-text boxes for model IDs, next to
budget numbers, with no provider, no key and no test anywhere on the screen.
Connecting a provider meant four other screens (Providers → new → models table
→ Budget & limits) and typing each model ID and price by hand, where a typo is a
tier that silently falls through to the default provider's first model.

The providers themselves were a closed enum of two real vendors. Almost every
other vendor an owner is likely to ask for speaks the OpenAI Chat Completions
shape, which the OpenAI driver already sends.

## Decision

**1. A provider kind is a registry row, not a driver.** `AiProviderKind` gains
`GOOGLE`, `XAI`, `DEEPSEEK`, `MISTRAL`, `OPENROUTER` and `OPENAI_COMPATIBLE`.
`AI_PROVIDER_PRESETS` (`@repo/contracts`) holds each kind's PROTOCOL
(`anthropic` | `openai` | `echo`) and the facts that differ between gateways:
default base URL, whether one is required, `max_tokens` vs
`max_completion_tokens`, whether `stream_options.include_usage` is accepted,
a key-check path for a gateway whose `/models` is public (OpenRouter), a key
placeholder, a console link and the name a new row is created with.
`buildDriver()` in `provider.ts` is the one switch on protocol. A new vendor is a
preset, a catalog name and an enum migration.

The KIND stays on the usage row rather than collapsing to a protocol: "who was
billed" is what the usage screen answers, and "OpenAI" for a Gemini call would be
false.

**2. Drivers list models.** `AiDriver.listModels()` returns `AiDiscoveredModel`
(id, name, output ceiling, vision, and prices when the provider publishes them,
which only OpenRouter does). Anthropic's comes from the Models API, including
`max_tokens` and `capabilities.image_input`. Anthropic's `test()` moves from a
one-token `claude-haiku-4-5` message to `models.list`. That costs nothing, and it
no longer fails on an account without the model the ping named.

**3. `/admin/settings/ai` is a static route**, as `settings/email` is. It holds
one connection flow: choose provider → that provider's key field (write-only,
blank = unchanged) → Test connection → the provider's model list (search, tick) →
three tier dropdowns drawn from it → a price row per ticked model → **Save and
connect**. Below it sits the existing limits form in a `usage` variant (without
tiers), and links to Features, Providers and Usage.

**4. One save, `saveAiSetup`.** It writes the provider (enabled, THE default,
incumbent demoted in the same transaction), seals a typed key, upserts the ticked
models and **disables** the un-ticked ones. It never deletes them, because usage
rows and feature overrides point at them. It then writes the three tier
settings. `aiSetupSchema` refuses a tier that names a model the same save does not
enable. `pricedAt` moves only when a price does (`saveAiModel`'s rule).

**5. A stored key never crosses vendors.** Both `discoverAiModels` and
`saveAiSetup` ignore a provider id whose row is of a different kind. Testing
Gemini while the form still holds the Anthropic row's id therefore uses no key,
and never sends the Anthropic key to Google. `loadProviderDriver()` stays the ONE
reader of `apiKeyCipher`. It gains `includeDisabled` because connecting is what
enables a row, and a `baseUrl` override for an unsaved endpoint typed beside a
stored key.

**6. Gates are unchanged, and the save needs both keys.** Discovery needs
`ai.providers.manage`. Saving the connection needs `ai.providers.manage` AND
`ai.settings.manage`, because the tiers are settings. Usage limits need
`ai.settings.manage`. Without the connect keys the form is ABSENT and a summary
shows the connected provider and tiers (ADR-078 #4's split).

**7. No price is invented.** A model priced before, on any provider, keeps that
price. A gateway-published price is next. Otherwise the field is empty and
required. There is no hard-coded price table: ADR-100 #2 says prices are data.

## Consequences

- `/admin/ai/providers` and `/admin/ai/limits` keep working unchanged. They are
  the place for a second, non-default provider and for per-model price edits.
  The setup screen is the fast path, not a replacement.
- Presets encode gateway behaviour we have not all exercised against live
  endpoints. `drivers.test.ts` pins the request shapes under MSW. A vendor that
  changes a field's name is a one-line preset edit.
- OpenAI's `/models` lists embeddings, TTS and image models beside chat models.
  The list is shown as the provider returns it, searchable. Filtering by id
  pattern would be the meaning-from-shape `AiModel.modelId` refuses.
- The Anthropic thinking table (`BUDGET_THINKING_MODELS`) still applies only to
  the `anthropic` protocol. A Claude model reached through OpenRouter is an
  OpenAI-protocol call and gets no thinking parameters.
