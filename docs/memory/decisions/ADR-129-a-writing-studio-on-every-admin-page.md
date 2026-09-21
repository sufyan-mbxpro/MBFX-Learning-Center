# ADR-129: A writing studio on every admin page

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 18 (`@repo/ai`), 09 (admin shell)
**Plan:** owner request, 2026-09-17
**Extends:** ADR-097 (the platform), ADR-099 (tiers), ADR-126 (form fill). Nothing in any of them is reversed.
**Superseded by:** —

## Context

The owner:

> can we use general ai button available for the whole site or any page where
> we can put the text or topic & generate the text in different tone, grammar
> mistake, rewrite, decide the characters, & also provide the character & word
> count etc..

Every AI affordance so far is bound to a FIELD: the writing assistant lives in
a rich-text toolbar, form fill in an editor, SEO in the SEO section. None of
them helps with text that has no field in this CMS yet — a social post, an
email to a partner, a headline being argued over, a paragraph pasted from
somewhere else to be tidied. The owner also wants length to be something they
set (characters or words) and something they can SEE, which no current surface
offers.

"The whole site" had two readings. The public site (learners) was set aside:
ADR-097 keeps learner-facing AI spec-only because it changes who spends, where
it runs, whether output is reviewed and who writes the prompt, all at once.
This ADR is the staff reading.

## Decision

### 1. One new feature key, `writing_studio`, on a new surface `global`

`AI_FEATURES` gains `writing_studio` (surface `global`, streamed, `standard`
tier at `medium` effort, ceiling 4000 output tokens). A new key rather than
more `writing_assistant` actions, because the two are different exposures:

- the assistant works on text already inside an editor, for a person who can
  save that editor;
- the studio accepts ANY text from anyone holding `ai.use`, and is the closer
  of the two to a general-purpose chatbot billed to the company.

An admin must be able to leave the first on and the second off, and to see the
second's spend on its own line. That is what a key is for.

`AiFeatureSurface` gains `global`. It names where the affordance lives, as
`editor` and `media` do; nothing else reads it.

### 2. The actions are a nested registry, each with its own tier

`AI_STUDIO_ACTIONS` — `draft`, `headlines`, `rewrite`, `paraphrase`,
`fix_grammar`, `expand`, `shorten`, `summarize` — each declaring `modelRole`
and `effort`, exactly as `AI_ASSISTANT_ACTIONS` does (ADR-099 #4). The run
route applies the action's tier. `fix_grammar` is `light`; the rest are
`standard`. No action is `heavy`: a studio result is a suggestion copied out
by hand, and the owner's cost dial should not move because someone tidied a
tweet.

Tones are a CLOSED list (`AI_STUDIO_TONES`): the assistant's four plus
`formal`, `casual`, `persuasive` and `educational`. A free-text tone is a
free-text prompt field wearing a label.

### 3. A length target is a REQUEST, and the screen measures the answer

A target is `{ unit: "characters" | "words", target }`. The prompt asks for
about that length and never more. A model cannot count characters reliably, so
the target is not enforced by rejecting output (unlike ADR-097 #13's column
limits — there is no column here). Instead:

- the result is MEASURED client-side and shown against the target ("276 / 280
  characters", or "12 over");
- **Fit to limit** is a separate, explicit request (a `shorten` of the result
  with the same target), never an automatic retry, because a second call is a
  second charge.

Counting is `textStats()` in `@repo/utils`: graphemes for characters (an emoji
is one), `Intl.Segmenter` for words and sentences, so Arabic and Urdu count
correctly. It is pure, free, and runs on every keystroke.

### 4. `ai.use` is the whole gate

Every other feature is also gated on the content key of the entity it writes
into (ADR-097 #10). The studio writes into nothing: its result is copied to
the clipboard or back into its own input. So `FEATURE_SURFACE_PERMISSIONS`
holds `null` for `writing_studio` — an explicit "no surface key", not an empty
list that `canAny` would read as a refusal. ADR-097 #4 (AI never writes to the
database) holds without qualification.

The existing platform limits apply unchanged: the global switch, the monthly
budget, `ai.rateLimitPerUserHour`, `ai.maxTokensPerRequest`, the feature's own
switch. Input is capped at 10,000 characters (`AI_STUDIO_INPUT_MAX`).

### 5. The shell mounts it, and absence is still the rule

`AdminShell` resolves availability on the server — `ai.use` AND
`getAiAvailability().features.writing_studio` — and renders the header button
only when both hold (ADR-097 #6). Mounted in the shell, the panel and its
unsent draft survive soft navigation between admin pages. The shortcut is
Ctrl/⌘+J, beside search's Ctrl/⌘+K.

A failure to READ availability hides the button and logs; it never takes the
admin shell down with it, because the studio is optional chrome on every page.

### 6. History is memory only

The panel keeps its last five results in component state. Nothing is stored:
ADR-097 #7's log holds no prompt and no completion, and a studio history table
would be exactly that log.

## Consequences

- Every admin page render for a subject holding `ai.use` performs the
  availability read (settings, budget, enabled features). The admin is
  `force-dynamic` already; the cost is a handful of indexed reads.
- An existing database needs `pnpm db:seed` for the `writing_studio` row; until
  then the feature reads as off, which is the seeded state anyway.
- A learner-facing version remains out of scope and needs its own ADR.
