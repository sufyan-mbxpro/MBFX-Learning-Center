# ADR-097: The AI platform — one package, one door, and AI never commits

**Status:** Accepted
**Date:** 2026-09-14
**Module:** new **18** (`@repo/ai`), touching 01 (db), 03/10 (rbac, roles),
05 (settings), 06 (i18n), 09 (admin shell), 11 (content), 15 (articles),
14 (hardening)
**Supersedes:** —
**Extends:** ADR-042 (composition is code, content is data), ADR-078 #5 (a code
registry with data content), ADR-086 #1 (the same split for tools),
ADR-043 (what is translated)
**Superseded by:** —

## Context

`docs/plan.md` names no AI module. Part F #10 therefore makes this an ADR
before any code: the platform is an addition to the architecture, not an
implementation of something already planned.

The owner's brief (2026-09-14, recorded verbatim in
`docs/changes/changes-29-ai-platform.md` §1) asks for two phases — a settings
surface with providers, switches, limits and a usage meter; then five editorial
features on top of it — with one requirement stated twice: **the CMS must
remain fully functional when AI is disabled or the budget is spent.**

Three facts about this repo shaped the answer before any design did.

1. **`@repo/core` is on the public render path.** Every public server component
   imports it. Two provider SDKs inside core's dependency graph is weight and
   surface on exactly the path architecture.md #5 and the Lighthouse budgets
   exist to protect.
2. **This repo has built a provider seam twice** — `EmailTransportDriver`
   (ADR-078 #2) and the market driver (ADR-087) — and both work. The third one
   does not get to be different for novelty's sake.
3. **Module 16 is the cautionary tale.** ADR-042 cancelled a whole programme
   because the admin surface it produced could express far more than anyone
   wanted, and each expressible thing was a state nobody had designed. An AI
   feature whose prompt is an admin text field is that failure mode with a
   language model attached.

## Decision

**1. AI is its own package, `@repo/ai`, and it owns its own tables.** The
graph gains `core → ai` and `apps/web → ai`. It depends on
`db / contracts / settings / secrets` and never on an app, on `core`, on
`auth`, or on `email`. Domain packages owning their own tables is settled
practice here — `settings`, `theme` and `email` all do it.

It sits beside `email` rather than below it. Email is below its senders
because `auth` and `core` both send; **nothing in `auth` calls AI and nothing
ever should** — the session path every request touches must not acquire a
dependency that can take two seconds and spend money.

**2. There is one door, and it is not a convention.** `runAiTask()` and
`streamAiTask()` are the only exports that reach a provider. No feature, route
handler or server action constructs a driver. `packages/ai/src/index.test.ts`
pins the export surface, so "no feature talks to a provider directly" is a
property of the import graph rather than a code-review habit.

**3. The set of features is code; everything a feature says is data.**
`AI_FEATURES` in `@repo/contracts` declares each key, its surface, whether it
streams, its model role, its effort and its output ceiling; a prompt builder in
`packages/ai/src/prompts/<key>.ts` is a pure function from typed input to
`{ system, messages }`. `AiFeature` rows hold on/off, provider, model, output
ceiling and a **bounded** extra-instructions field (1000 characters, escaped,
appended — never replacing the system prompt).

This is ADR-078 #5 and ADR-086 #1 a third time, and the line is the same one:
**code decides when a provider is called and what it is asked to do**, because
that is behaviour; admins own the knobs, because those are policy and copy. An
admin who can rewrite the whole prompt can turn the summariser into a general
chatbot billed to the company — which is a program, not a setting.

**4. AI never writes to the database.** Every result lands in a form field a
human then saves through the existing server action, with the existing
`@repo/contracts` schema and the existing `requirePermission()` check. This is
the owner's "AI suggests, admin edits before save" promoted from the SEO
feature to a platform invariant, and it is the load-bearing security property:
**a model that cannot commit cannot be prompt-injected into committing.**

It binds hardest where it is least convenient. Quiz generation produces a
parent row plus N questions plus M options; it still persists nothing until an
admin presses Save in the existing editor, and its integration test asserts
zero rows written between generation and Save.

**5. Every field AI fills is a field a human can fill.** No column, block or
control exists only because AI does. With AI off, the editors are exactly the
editors that shipped in changes-07/10/11, minus some buttons. This is what
makes "degrades gracefully" structural rather than a promise.

**6. A disabled, capped or unavailable feature is ABSENT, not disabled.**
changes-11 D25's rule for a flag-off learn section and ADR-080's for the
newsletter form, where `newsletter-signup.test.ts` fails on a `disabled`
control. Availability is resolved server-side and passed down as props, so an
AI-off install ships **no AI client code into the editor bundle at all** — no
client component asks "is AI on", because the answer arrives as the absence of
a prop.

**7. The usage log records the call, never the message.** `AiUsage` holds
feature, provider, model, status, a reason from a closed taxonomy, token
counts, cost, duration, actor and entity. It holds **no prompt and no
completion**, for ADR-078 #10's reason one domain over: a log holding bodies is
a second copy of unpublished drafts under a different permission gate with a
different retention. Raw rows are purged at 90 days; the daily rollups are kept
forever, because spend history must outlive PII.

**8. Metering lives in the seam's `finally`, not in the caller.** A feature
cannot forget to log because a feature never logs. The usage row, the daily
rollup and the period counter are written in one transaction with atomic
increments, and an aborted stream still meters what the provider billed.

**9. No new permission key per feature.** `ai.use` gates spending,
`AiFeature.isEnabled` gates existence, and the content key the admin already
holds gates the save — enforced as `requireFeatureSurface()` on the run route.
The fifth time this repo declines keys for a new surface (after quizzes,
glossary topics, videos and instruments), for ADR-086 #7's reason: a key
answers "may this person change this kind of thing", not "which screen are they
on".

**10. The tutor chatbot is not part of this.** Everything here is
staff-triggered, admin-surface, bounded and reviewed. A learner-facing tutor
changes four properties at once — who spends, where it runs (a cached public
route), whether the output is reviewed, and who writes the prompt — and needs
its own ADR and its own module. No registry key exists for it, because a key
with no builder is a switch an admin can flip into a 500.

## Consequences

- **`@repo/ai` touches the database**, so "core is the only door to db" reads
  as it always has in practice: a domain package owns its own tables
  (ADR-078's last consequence, restated).
- **Two provider SDKs enter the dependency graph.** They are confined to a
  server-only, admin-only package that `app/(public)` never imports, and
  `check:phantom-deps` plus the public Lighthouse budgets are how that stays
  true.
- **An admin cannot change what a feature asks the model.** That is the point,
  and it will be asked for. The answer is a new registry entry with an ADR, or
  the extra-instructions field — not a prompt textarea.
- **A future public read that filters on `translationStatus` must exclude
  `MACHINE_TRANSLATED`.** Today none does (verified across
  `packages/core/src` on 2026-09-14) and only `en` is active (ADR-091), so the
  member is admin-visible and reader-invisible. Recorded here because the next
  person to add such a filter will not think to look.
- **Refusals cost a row.** A capped platform still writes `REFUSED` rows for
  direct API attempts. Deliberate: "why did nothing happen" has to be
  answerable, and §13's absent affordances mean there is nothing left to
  click.

## Alternatives rejected

- **AI inside `@repo/core`.** It would put two provider SDKs in the graph every
  public page imports, and it would make the one-door property a convention
  rather than a boundary.
- **A prompt template per feature, editable in admin.** The ADR-042 failure
  mode exactly: infinite expressible states, none designed. The bounded
  extra-instructions field is the deliberate narrow version.
- **Writing AI output straight to a draft row** ("it's only a draft"). A draft
  nobody asked for is a row someone has to find and delete, and it converts a
  prompt injection from a bad suggestion into a database write.
- **A per-feature permission key.** Five keys nobody would grant separately,
  against a repo that has refused this four times already.
- **Shipping the tutor chatbot in the same programme.** See Decision #10.

## Compliance

- `packages/ai/src/index.test.ts` — the export surface; a leaked driver export
  fails.
- `packages/contracts/src/ai.test.ts` — the drift guard: every `AI_FEATURES`
  key has a prompt builder, a seed row, a payload schema and a catalog block,
  and nothing else does (`learn.test.ts`'s shape).
- `apps/web/app/ai-degradation.test.ts` — the four availability states, and it
  **fails on a `disabled` AI control**.
- `apps/web/app/ai-output.test.ts` — no AI result reaches
  `dangerouslySetInnerHTML`; a `<script>` in a suggestion renders as text.
- `packages/ai/src/usage.integration.test.ts` — every terminal state writes a
  row; no prompt or completion text is present in any written row.
- Integration tests for B5 and B6 — zero entity rows written between
  generation and Save.
