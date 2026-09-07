# ADR-036: Puck spike result — reject for now, keep the form-based composer

**Status:** Accepted
**Date:** 2026-09-05
**Module:** 16 (Website Builder / CMS), Phase 3 PR 3.7
**Supersedes:** — (resolves ADR-026 §2's "Puck is a candidate, not a decision")
**Superseded by:** —

## Context

ADR-026 gated Puck adoption on a timeboxed spike passing five checks, run
against the repo's real pins (Next 16.3.3, React 19.2.8, Base UI ^1.7.0,
`minimumReleaseAge: 1440`, nonce-based admin CSP). This ADR records that
spike's result. Per ADR-026 §5/Compliance, **no Puck code was installed in
the repo or merged** — every finding below came from package-registry
metadata, a scratch `npm pack`/dry-run install outside the repo (in a
temp directory, discarded after), and static inspection of the unpacked
package contents. This is real evidence, not guesswork, but it stops short
of the full spike ADR-026 envisioned: no actual editor render was attempted
against our block registry's field types, because that would mean
importing Puck into `apps/web` before this ADR exists — exactly what
ADR-026 §2 forbids ("no code may import it" until the follow-up ADR
lands). The gap this leaves is named in "What remains unverified" below.

**First correction to the plan's own premise:** v1 §1 and this plan's §12
PR 3.7 line both assume a "current stable 0.23.x." As of this spike,
`@measured/puck`'s `latest` dist-tag is **0.20.2** (published
2025-09-05) — no 0.21.x, 0.22.x or 0.23.x stable line has ever shipped;
0.21.0 exists only as a long-running canary series with no accompanying
GA release. The version this repo would actually pin is 0.20.2, not
0.23.x — a correction to the record, not a blocker on its own.

## Findings against ADR-026's five gates

1. **Installs under `minimumReleaseAge`, no new `onlyBuiltDependencies`
   entry — PASS.** 0.20.2 was published a year before this spike, clear of
   the 1440-minute floor by a wide margin. `npm view` shows no
   `install`/`postinstall` script on `@measured/puck` or any of its nine
   direct dependencies (`@dnd-kit/react`, `@dnd-kit/helpers`, `zustand`,
   `use-debounce`, `deep-diff`, `object-hash`, `react-hotkeys-hook`,
   `flat`, `uuid`, `fast-deep-equal`) — none need an
   `onlyBuiltDependencies` allowlist entry.

2. **Renders under React 19.2.8/Next 16.3.3; no Radix in the tree —
   PARTIAL PASS (dependency resolution verified; live render not
   attempted).** `@measured/puck`'s peer range is
   `react: "^18.0.0 || ^19.0.0"`; `@dnd-kit/react` (its drag-and-drop
   engine, used in place of Radix) declares the same range for `react` and
   `react-dom`. A scratch `npm install --dry-run` against
   `react@19.2.8`/`react-dom@19.2.8` resolved all 21 packages with zero
   `ERESOLVE` warnings. Grepping the full dependency list finds no
   `@radix-ui/*` package anywhere — ADR-013's "no Radix packages alongside
   Base UI" constraint is not violated at the dependency-graph level.
   **What this does not confirm:** that Puck's field-rendering API actually
   maps cleanly onto this repo's `EditorFieldMeta`/`fields` vocabulary
   (ADR-030 §1) without an adapter layer, or that its components render
   without runtime errors under React 19's stricter dev-mode checks. That
   needs a real, in-app render — the part of the spike this ADR cannot do
   without violating its own compliance rule.

3. **Runs under the admin CSP with a nonce, no `unsafe-eval` — PASS with a
   named future risk.** Static analysis of the unpacked `dist/index.js`
   bundle finds zero occurrences of `eval(` or `new Function(`. It does
   contain one real `document.createElement("style")` call (in a
   `mirrorEl` helper, used to copy an external `<link rel="stylesheet">`'s
   rules into an inline `<style>` tag) — this is Puck's mechanism for
   making the host page's CSS visible inside its drag-and-drop canvas
   iframe. Under **today's actual policy** this is a non-issue twice over:
   the CSP is still report-only repo-wide (`apps/web/proxy.ts`, matching
   the Module 14 status this plan's own audit already recorded), and per
   ADR-026 §2's fourth gate the canvasing iframe would target the
   **public** draft-preview route, whose `style-src` is nonce-less
   (`'self' 'unsafe-inline'`) in the current report-only policy by explicit
   design (`proxy.ts`'s own comment: nonce-less until a hash-based
   allowance for the cached brand-tokens CSS lands, tracked as Module 14
   work). **The named future risk:** once that public-surface CSP is
   enforced with a nonce (Module 14, independent of this ADR), this
   specific `mirrorEl` code path would be blocked unless Puck is run in a
   configuration that avoids it, or a nonce is threaded through — a real,
   concrete complication for whoever does that enforcement work, not a
   blocker today.

4. **A canvas iframing the public draft-preview URL works same-origin —
   PASS (architecture-level; not Puck-specific).** The draft-preview route
   already renders the real public page same-origin
   (`app/api/preview/route.ts` → `draftMode().enable()` → the actual
   `(public)` route, ADR-026 §5 "preview is the real page"). Any canvas
   library iframing that URL inherits this property for free; nothing
   about Puck specifically helps or hurts it.

5. **Admin bundle delta acceptable; nothing leaks past the
   `(public)`/`(admin)` boundary — LIKELY PASS, not measured precisely.**
   Summed `npm view … dist.unpackedSize` across Puck's core package and its
   nine direct dependencies is ~2.5 MB unpacked (pre-minification,
   pre-tree-shaking, pre-gzip — genuinely shipped bytes are typically a
   fraction of this). For scale, this repo's `stack.md` already accepts
   Tiptap (3.31.0), TanStack Table (8.21.3) and recharts (3.10.1) as
   admin-only dependencies of comparable or greater real-world weight.
   ADR-026 §3 already places any editor's client code under
   `apps/web/app/(admin)/admin/website/_builder/`, and
   `check-phantom-deps` + the existing `(public)`/`(admin)` import-boundary
   lint rule (architecture.md #5) would catch an accidental public-side
   import the same way they already guard Tiptap/TanStack Table/recharts —
   no new enforcement mechanism would be needed. A precise Lighthouse-
   budget measurement was not run (no Playwright/Lighthouse harness exists
   yet in this repo, an unrelated Module 14 gap already on record).

## Decision

**Reject Puck for Phase 3. Keep the form-based composer
(`apps/web/app/(admin)/admin/website/pages/[id]/builder/`, shipped PR
3.3–3.6) as the only editing surface.** Four of the five gates pass
cleanly or pass with only a named, containable future risk; the one gate
this ADR cannot fully close (real rendering fidelity against this repo's
own block/field registry) is exactly the kind of unknown a "just try
adopting it" decision would paper over rather than resolve — and per
ADR-026's own framing, resolving it costs a real, separate unit of
integration work for a UX improvement (drag-and-drop, inline canvas
editing) that nothing else in this plan depends on. The composer already
delivers everything ADR-026 §1 asked of it and has been verified,
repeatedly, against real browser sessions across PR 3.3 (tree/settings/
preview), PR 3.4 (gates), and PR 3.5 (versions/translations) — it is not a
stopgap, it is a complete, working editing surface on its own terms.

This is a **reject, not a "reject forever."** Nothing here found a
disqualifying defect in Puck itself — quite the opposite, the dependency
and CSP findings are more favorable than ADR-026's Context section
anticipated (no Radix conflicts, no `eval`, a clean resolve against the
exact pinned React version). If a future product need for true canvas/
inline-text editing emerges, this ADR's findings are the starting point
for that spike, not a reason to start over — the version to re-check
first, the CSP interaction to re-verify against whatever the enforced
policy looks like by then, and the one gate (live render fidelity) that
still needs a real, ADR-authorized install.

## Consequences

- **No new dependency is added.** `stack.md` is not touched; no
  `onlyBuiltDependencies` entry is added; `packages/blocks` and
  `@repo/contracts` gain nothing and lose nothing.
- **The composer remains the only editing surface for the remainder of
  this plan.** Phases 4–10 build on it (collection blocks, reusable
  sections, etc.) with no canvas-shaped assumption anywhere — matching the
  plan's own risk table entry ("Puck never passes its spike → Composer is
  the product path; nothing else depends on the canvas").
- **The "two editor UIs may exist briefly" consequence ADR-026 flagged
  never materializes** — there is exactly one editor, now and for the rest
  of this plan's currently-scoped phases.
- **Inline canvas text editing (v1 §8.3) stays out of scope**, as ADR-026
  already accepted; text is edited in the settings panel against a live
  preview pane, which PR 3.3–3.6 verified works well in practice.

## Alternatives considered

- **Accept-with-pin at 0.20.2.** Rejected: the one gate this spike
  couldn't close (real render fidelity against our field registry) is the
  gate most likely to surface real integration cost, and accepting a
  pre-1.0 dependency into the critical path on 4-of-5-gates-plus-an-
  assumption is the exact risk ADR-026 §"Alternatives considered" already
  rejected once for locking it sight-unseen.
- **Extend the spike to a real in-app install on a throwaway branch.**
  Rejected for this ADR specifically: ADR-026 §5/Compliance is explicit
  that "the spike is not merged as code" and "a PR importing an editor
  library without [this] ADR fails review" — writing that code before this
  ADR existed would violate the sequencing ADR-026 itself set up. If a
  future ADR wants to re-open Puck, that install-and-render step is exactly
  what it should do first.
- **Evaluate a different editor library instead of Puck.** Out of scope:
  ADR-026 named Puck specifically as the one candidate worth a timeboxed
  look, on the strength of v1's original evaluation; nothing in this
  session's research surfaced a reason to widen the search when the
  named candidate's own result is "no urgent need, revisit later," not
  "disqualified."

## Compliance

- No `package.json` in this repo changed as part of this ADR. A `git
status`/`git diff` at merge time shows no dependency additions.
- Any future PR importing `@measured/puck` (or any other editor library)
  anywhere under `apps/web` without a superseding ADR fails review, per
  ADR-026 §5's standing rule — this ADR does not relax it, it exercises it.
- Phase 3's PR checklist (plan v2.2 §12 PR 3.7) is satisfied by this
  document: "timeboxed, produces an ADR (accept-with-pin or reject), no
  code merged."
