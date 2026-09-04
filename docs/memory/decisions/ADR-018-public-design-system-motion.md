# ADR-018: Public design system — CSS-first motion, no animation library

**Status:** Accepted
**Date:** 2026-09-03
**Module:** 07 (`@repo/ui`) / 12 (public site)
**Supersedes:** —
**Superseded by:** —

## Context

`docs/changes/changes-03.md` (copied verbatim as `changes-04.md`) asks for a
premium fintech visual system on the public surface, modelled on the ForTradex
demo: scroll reveals, stat counters, a marquee ticker, image hover effects, a
full-screen page preloader, and a brand palette whose primary is `#E8B98C`.
The plan is `docs/changes/changes-03-plan.md`.

Three constraints collide with a literal reading of that brief.

1. The public surface carries a **blocking Lighthouse budget** (Module 12/14),
   which is also the admin-bundle-leak backstop under the single-app
   architecture (ADR-006). An animation library on public routes spends
   30–50 KB of that budget before a single section renders.
2. The reference's preloader is a full-screen overlay that must finish before
   content is visible. Ported faithfully onto a server-rendered app it delays
   LCP for every visitor on every navigation — it would fail the budget above.
3. `#E8B98C` measures **1.79:1** on `#FFFFFF` (the outgoing `#C28D5A` was
   2.90:1). The engine's `validateMode` only checks a fill as _text_, so this
   raises no error — but the reference design uses its primary colour for thin
   borders, small icon glyphs and eyebrow-pill labels, and at 1.79:1 those are
   invisible. Nothing in lint or CI would catch it.

Verified against the engine's own maths on 2026-09-03: `--primary-foreground`
resolves to `#1A1A1A` at 9.74:1 (button labels are legible),
`--primary-interactive` resolves to `#8B6F54` light / `#E8B98C` dark — exactly
the read-only derived pair the brief's admin screenshot shows. ADR-003's
derivation flow is confirmed correct and unchanged; only `DEFAULT_BRAND.primary`
moves.

## Decision

**1. Zero new runtime dependencies for motion.** Every effect the brief asks
for is built from CSS transitions, CSS keyframes, and one small
`IntersectionObserver` hook. No `motion`, no `framer-motion`, no GSAP, no
`wow.js`, no `odometer`.

**2. Animated content is present and visible in the server HTML.** `Reveal`
never ships `opacity: 0` without a companion rule restoring visibility when
scroll-driven animation is unsupported _and_ JS has not run. No-JS renders,
crawler renders and reduced-motion renders all show the finished state. The
observer is one client island per page, not one per revealed element.

**3. `prefers-reduced-motion` short-circuits at the JS level too**, not only
via the existing global duration reset in `globals.css`'s `@layer base`.
`Counter` jumps straight to its final value; `Marquee` renders static;
`SiteLoader` is skipped entirely. A CSS-only reset is insufficient because an
observer that never fires would otherwise leave content permanently hidden.

**4. The preloader is a deliberate, bounded deviation from the reference.**
`SiteLoader` is a first-visit-only, CSS-only overlay that (a) never blocks
paint of the content beneath it, (b) self-dismisses on `window.load` or after
a hard **900 ms** cap, whichever comes first, (c) is skipped under
`prefers-reduced-motion`, and (d) is gated by a `layout.pageLoader` boolean
setting so it can be switched off without a deploy.

**5. `--primary` is for fills and large shapes only.** Any thin, small or
text-adjacent primary-coloured element — borders, icon glyphs, eyebrow labels,
inline links — uses `--primary-interactive`. This is binding on `Badge`'s
`eyebrow` variant, `IconCard`, `ProcessStep` and the bordered/featured `Card`
variants.

**6. The public display type scale is public-only.** New `--text-display-*`
tokens using `clamp()` serve `Hero` and `SectionHeading`. The shared `--text-*`
ramp is **not** touched — it belongs to the admin surface too, and it was
already the subject of the spacing-namespace incident documented in
`globals.css`.

## Consequences

- Effects are limited to what CSS transitions, keyframes and one observer can
  express. Spring physics, gesture-driven motion and FLIP layout transitions
  are off the table. Accepted: nothing in the brief needs them, and the budget
  they would cost is the budget protecting the whole public surface.
- `animation-timeline: view()` is not universally supported, so `Reveal` needs
  an `@supports not` fallback path — two code paths to keep working, verified
  in a real browser rather than against the spec.
- The preloader will not look like the reference's. A visitor on a fast
  connection may see it for well under 900 ms, or not at all. That is the
  intended outcome, not a defect to "fix" by raising the cap.
- Restricting `--primary` to fills means the tan brand colour appears less
  often than the reference's green does. Mitigated by `--primary-interactive`,
  which is the same hue and passes at 4.67:1.
- A future brand whose primary _does_ pass 3:1 still cannot use raw
  `--primary` for thin elements under rule 5, which is stricter than that
  brand needs. Accepted: a per-brand conditional rule is not enforceable by
  review, and the derived sibling is correct for every brand.

## Alternatives considered

- **Add `motion` (Framer Motion) and use it for reveals and counters.**
  Rejected: 30–50 KB on routes with a blocking budget, plus a
  `pnpm-workspace.yaml` dependency review, to replace roughly 40 lines of CSS
  and one observer hook. The cost is not paid back.
- **Port the reference preloader faithfully.** Rejected: it delays LCP for
  every visitor on every navigation and would fail the Module 12/14 Lighthouse
  gate that backstops ADR-006. Rule 4 keeps the visual idea and drops the cost.
- **Enlarge the shared `--text-*` ramp to the reference's display sizes.**
  Rejected: that ramp is shared with the admin surface, where a 14px base is
  deliberate. Public-only `--text-display-*` tokens get the same result with
  no blast radius.
- **Keep `#C28D5A` as primary to avoid the contrast question entirely.**
  Rejected: the brief pins `#E8B98C`, and the measurement shows it is safe —
  button ink passes at 9.74:1 and `validateMode` raises no blocking error.
  Rule 5 handles the one case that measurement exposed.
- **Let admins pick raw `--primary` for borders and trust `validateMode`.**
  Rejected: the validator checks fills as text, not as thin non-text elements,
  so it would pass a palette that renders invisible borders. A structural rule
  beats a check that does not run.

## Compliance

- No animation package appears in any `package.json` under `apps/` or
  `packages/` — `pnpm check:phantom-deps` plus dependency review at PR time.
- `@repo/ui` unit tests (vitest + RTL): `Reveal` renders its children visible
  with no JS and no observer; `Counter` renders its final value under
  `prefers-reduced-motion`; `Marquee` renders static under the same;
  `SiteLoader` returns `null` under the same.
- `@repo/theme`: existing contrast assertions retargeted from `#C28D5A` to
  `#E8B98C`; snapshots refreshed; the fast-check property test stays green at
  the 90% floor.
- Rule 5 is a review checklist item on every new `@repo/ui` component and every
  `_sections/*` file — raw `bg-primary`/`border-primary`/`text-primary` on a
  small or thin element is a review reject. It is deliberately **not** lint-
  enforced: the same utility is correct on a large fill, so a selector cannot
  tell the two apart.
- The 900 ms preloader cap and the `layout.pageLoader` kill switch are asserted
  in `SiteLoader`'s unit test.
