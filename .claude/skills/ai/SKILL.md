# SKILL — Module 18: `@repo/ai` (the AI platform)

ADR-097 (the platform), ADR-098 (the sealed provider key), ADR-099 (the
provider seam + model tiers), ADR-100 (cost estimation), ADR-126 (form fill),
ADR-129 (the AI Writer).
Plan: `docs/changes/changes-29-ai-platform.md` (PRs A0–A9, then B1–B6).

**Status: COMPLETE (A0-A9 + B1-B6, 2026-09-14).** `@repo/ai`, six tables, five
admin screens, one generation endpoint, the meter, and all six features.
`ai.enabled` ships `false` and the default provider is `ECHO`, so a fresh clone
has a working AI area that cannot spend a cent and no AI control anywhere in
the editors.

**Where each feature lives:** the writing assistant is a toolbar menu in
`rich-text-editor.tsx`, on EVERY rich-text field of the seven editors since
ADR-126; SEO is a button in the article editor's SEO header;
translation is in the locale-switcher row; takeaways are an ordinary field
beside the excerpt; alt text is in the media detail drawer and a review list on
`/admin/media`; quiz generation is in the quiz editor's question section; **form fill**
(ADR-126) is the "Generate with AI" bar at the top of the article, course,
lesson, video topic, quiz, glossary term, glossary topic and tool editors, plus a ✨
menu (regenerate · improve · shorten · expand) beside each text field. Each
arrives as a PROP — its absence is how an AI-off install ships no AI client
code.

## The AI Writer (ADR-129, 2026-09-17)

`writing_studio`, the eighth key and the first on the `global` surface: a
header button and a Ctrl/⌘+J sheet (`_components/ai-writer.tsx`) for text that
has no field — a post, an email, a headline, a pasted paragraph.

- **Mounted by `AdminShell`**, so an unsent draft survives soft navigation. The
  shell renders it only for `ai.use` AND `availability.features.writing_studio`;
  a failed availability READ hides it and logs rather than breaking every admin
  page.
- **`ai.use` is the whole gate.** It writes into no entity, so the run route's
  `FEATURE_SURFACE_PERMISSIONS.writing_studio` is `null` with an early return.
  Never `[]`: `canAny` refuses an empty list.
- **Actions are a nested registry** (`AI_STUDIO_ACTIONS`), each with its own
  tier, applied by `actionOverrides` exactly as the assistant's are. Grammar is
  light; nothing is heavy.
- **A length target is a request.** The prompt phrases it as a ceiling; the
  panel measures the result with `textStats`/`measureLength` (`@repo/utils`)
  against the target it was ASKED with, and **Fit to limit** is a separate
  `shorten` call. No output is rejected for length — there is no column.
- **The prompt shares `EDITORIAL_BASE` and `PLAIN_TEXT_FORMAT`** with the
  writing assistant (`prompts/shared.ts`). `fix_grammar` drops tone, format and
  length, which would contradict "change nothing else".
- **History is five results in component state.** A stored history would be a
  log of completions, which ADR-097 #7 forbids.
- An existing database needs `pnpm db:seed` for the row; it seeds OFF.

## Guided setup (ADR-120, 2026-09-16)

`/admin/settings/ai` is the fast path: provider → that provider's key → Test
connection (`AiDriver.listModels()`) → tick models → tier dropdowns → prices →
**Save and connect** (`saveAiSetup`: enabled + THE default, key sealed, un-ticked
models DISABLED not deleted, tiers written). A provider kind is a row in
`AI_PROVIDER_PRESETS` (`@repo/contracts`); every kind but Anthropic speaks the
OpenAI protocol through `openAiDriver` with preset options, and `buildDriver()`
in `provider.ts` is the one protocol switch. **A stored key is never used for a
row of another kind** — both the discovery and the save ignore a mismatched
provider id. Adding a vendor: a preset, `admin.ai.providerKinds.<KIND>`, an enum
migration over the three tables that carry the kind.

## Form fill (ADR-126, 2026-09-17)

One key, `form_fill`, for all seven editors. `AI_FILL_FIELDS` (`@repo/contracts`)
is the registry of what AI may write per module, with each field's KIND and
column limit — the output schemas (`aiFormSuggestionSchema`,
`aiFieldSuggestionSchema`), the prompt's JSON description and the review
dialog's rows are all derived from it. No URL, image, slug, taxonomy or status
field is ever in it (`ai.test.ts` fails on one).

- **Rich text is BLOCKS, never HTML.** `aiBlocksToHtml` (`@repo/utils`) escapes
  everything and emits only `h2 h3 p ul ol li blockquote strong em`, all
  attribute-free and all already allowed by `sanitizeRichText`.
- **Review before replacing.** The dialog ticks a field only when it is empty;
  Apply hands the editor ONE patch. Editors merge `setDraft` from CURRENT state
  — several setter calls in one tick used to overwrite each other.
- **Gated per MODULE.** The run route re-parses the payload and requires that
  module's content key (`FILL_MODULE_PERMISSIONS`), so `glossary.update` does
  not buy course generation.
- **Pages call `loadEditorAi()`** (`_lib/editor-ai.ts`): one availability read,
  `ai.use` AND the content key, each affordance present or absent on its own.
  The article page keeps its own fold (B1–B4 guards) and adds `fill`.
- **`ai.maxTokensPerRequest` is seeded at 2000 and must be raised (~8000).** A
  lesson body cut off mid-JSON is `invalid_output`, and the dialog says which
  setting to raise.

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
apps/web/app/(admin)/admin/settings/ai/  # Settings → AI tabs (changes-51, ADR-150): connection | usage | features | limits | providers
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
   catalog block. `contracts/src/ai.test.ts` names the registry half and
   `apps/web/app/ai-registry.test.ts` the cross-file half. An
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

## What building it learned

Six failures worth knowing, all found by tests rather than by running the
thing:

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
- **`Button loading` is `Button disabled`.** The assistant's Stop button is the
  one control that must stay clickable while its work runs; the shared
  `Spinner` sits beside it instead.
- **A guard trips on its own explanation.** Three times: `ogImageUrl`, `sharp`
  and `Promise.all` all had to be NAMED in a comment saying why they are
  absent. Read `stripped(path)` in `ai-degradation.test.ts`, never the raw
  source, for any "must not appear" assertion.
- **`\b` written by hand through a shell becomes a literal backspace.** It
  reached `ai-degradation.test.ts` twice and `no-control-regex` caught it. A
  plain `toContain` says the same thing and cannot carry a control byte.

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
