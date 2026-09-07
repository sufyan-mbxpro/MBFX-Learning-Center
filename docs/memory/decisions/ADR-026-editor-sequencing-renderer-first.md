# ADR-026: Renderer first, visual canvas second — the editor is a spike-gated choice, and its client code lives in `apps/web`

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** — (replaces v1 §1's "Visual editor is Puck… pin to current
stable 0.23.x" as a _locked_ decision, and v1's `packages/page-builder`)
**Superseded by:** —

## Context

v1 §1 locks Puck as the editor and §19 acknowledges the risk ("Puck is
pre-1.0; breaking changes") with three mitigations: pin the version, isolate
it in `packages/page-builder`, keep the JSON Puck-agnostic. Those are the
right mitigations for a decision that has been _tested_. It has not been:

- The stack is Next **16.3.3** / React **19.2.8** / Tailwind **4.3** /
  Base UI (ADR-013, "no Radix packages alongside it"). Puck 0.23.x's peer
  and primitive expectations against that exact combination are unverified
  by anyone here.
- `minimumReleaseAge: 1440` and `onlyBuiltDependencies` are in force — a
  dependency cannot be adopted the day it publishes, and anything with an
  install script needs an allowlist entry that `pnpm-workspace.yaml` says
  is not added casually.
- The admin surface runs a **per-request nonce CSP** with
  `X-Frame-Options: DENY` and `frame-ancestors 'none'`. An editor that
  injects styles or eval-shaped code has to be checked against that, and its
  canvas can only iframe the **public** surface (`frame-ancestors 'self'`),
  not an admin route.
- The one production build on the owner's machine currently **OOMs**.

Meanwhile, none of the value of this module lives in the canvas. The value
is: a page model, a renderer, providers, card templates, and the ability to
change a listing's composition without a deploy. All of that is testable and
shippable with no editor at all — and the repo already has a working
proof of the idea in `home.sections` (a JSON descriptor list, admin-editable,
mapped to components, CI-checked).

## Decision

1. **Sequence: renderer before canvas.** Phases 1–2 of the v2 plan deliver
   the page model, `@repo/blocks`, the renderer, providers and the
   `home.sections` migration with a **form-based composer** — an ordered
   block list with add / remove / reorder / duplicate and a settings panel,
   built from the shipped `DataTable`, drag-reorder (the navigation manager
   already does this) and `Form` primitives. No new dependency.
2. **Puck is evaluated in a timeboxed spike (2 days) at Phase 3**, against
   the real pins, and adopted only if all of these pass:
   - installs under `minimumReleaseAge` with no new `onlyBuiltDependencies`
     entry, or with one the owner explicitly approves;
   - renders our block editor fields under React 19.2.8 / Next 16.3.3;
     no Radix packages enter the tree (ADR-013);
   - runs under the admin CSP with a nonce, no `unsafe-eval`;
   - a canvas iframing the **public** draft-preview URL works same-origin;
   - the admin route's bundle delta is acceptable and nothing leaks past
     the `(public)`/`(admin)` import boundary.
     The spike's result is recorded in a follow-up ADR (accept-with-pin, or
     reject-and-keep-the-composer). **Until then Puck is a candidate, not a
     decision** — no code may import it.
3. **The editor's client code lives in
   `apps/web/app/(admin)/admin/website/_builder/`**, not in a package. This
   is the established precedent for admin-only client dependencies: Tiptap
   (ADR-009/ADR-015), TanStack Table and recharts all live in `apps/web`
   under the import boundary + Lighthouse backstop. It also means a rejected
   or replaced editor never touches the package graph.
4. **The layout JSON is editor-agnostic and owned by `@repo/contracts`.**
   No Puck type appears in a schema, a service, a database column or a
   renderer. If Puck's `Data` shape is convenient, it is adapted at the
   editor boundary in both directions. This preserves v1's best instinct
   while making it verifiable: a test asserts the layout schema has no
   dependency on any editor library.
5. **Preview is the real page.** The draft-mode route renders the actual
   public surface with the draft version, so what the admin previews is what
   ships — no second rendering path to keep in sync, and it works for the
   composer and any future canvas identically.

## Consequences

- **The first releases have no drag-and-drop canvas.** An admin reorders
  blocks in a list, not on a stage. This is a real UX reduction from v1's
  promise, and it is what buys a shippable module in weeks instead of a
  pre-1.0 dependency in the critical path. The homepage is already
  configured this way today, so it is not a regression for the surface that
  matters first.
- **Two editor UIs may exist briefly** if Puck is adopted (the composer
  stays as the fallback for a release). Accepted; the composer is small
  because it is built from shipped primitives.
- **If Puck is rejected**, the module still delivers everything in the v2
  plan except canvas ergonomics, and the follow-up ADR records what would
  have to change for a different editor (or a hand-built canvas) to be
  worth it.
- **Inline text editing on the canvas** (v1 §8.3) is not available in the
  composer; text is edited in the settings panel with a live preview pane.

## Alternatives considered

- **Lock Puck now (v1 §1).** Rejected: locking an unverified pre-1.0
  dependency into the critical path of a twelve-phase module is the risk
  v1's own §19 identifies, and this repo's version discipline
  (`stack.md`, ADR-002, ADR-010) exists precisely to stop that.
- **Build a custom drag-and-drop canvas first.** Rejected: it is the most
  expensive part of the module and the least differentiated; deferring it
  costs nothing structurally because the JSON is editor-agnostic.
- **Ship the canvas and defer the providers.** Rejected: it produces a
  builder that can only place static content — the demo-ware failure mode,
  and precisely what the critique document argues against.
- **Put the editor in `packages/page-builder` anyway** for future reuse.
  Rejected: nothing else can consume it, and it would put a pre-1.0
  dependency in the shared graph.

## Compliance

- A test asserts the layout Zod schema and every service signature are free
  of editor-library types.
- `check-phantom-deps` + the `(public)`/`(admin)` import boundary rule keep
  any editor dependency admin-side; the Lighthouse budget on public routes
  is the backstop.
- The spike is not merged as code: it produces an ADR and, if accepted, a
  `stack.md` pin. A PR importing an editor library without that ADR fails
  review.
