# Rules — Testing

The standard from plan.md Part C, stated as merge-blocking rules. "Tests are
Phase 0 work, not an afterthought" — every module spec in Part D lists its
required tests, and a module is not done while they fail.

## Frameworks (versions pinned in docs/memory/stack.md)

- **Vitest** — unit/integration in every package (`turbo test` fans out).
- **React Testing Library** (+ jsdom or vitest-browser) — components.
- **Playwright** — E2E for both surfaces of the single app: public suites
  against `/`, admin suites against `/admin/*`.
- **@axe-core/playwright** — a11y gate; serious/critical violations fail CI.
- **Testcontainers (MariaDB)** — real-DB integration for db/rbac/settings.
  Mocking Prisma hides FK and constraint bugs; don't.
- **MSW** — faking external APIs (market data provider) only. Never mock
  our own packages to make a test pass.
- **fast-check** — property-based tests where the contract is a property
  (theme contrast is the canonical case).

## Blocking rules

1. **Coverage floors:** 90% on pure-logic packages (`theme`, `rbac`, `utils`,
   `contracts`); 80% on service packages (`core`, `settings`, `i18n`). No
   floor on apps, but every admin screen ships happy-path + permission-denied
   E2E (denied asserted at the DB level, not just the UI).
2. **Every bug fix lands with its regression test in the same PR.** The
   scope-resolution bug (plan A5.1) is the cautionary tale — the test that
   would have caught it is now required before the fix ships.
3. **CI order:** lint → typecheck → test → build → e2e. `turbo test` depends
   on `@repo/db#generate`.
4. **Cross-cutting suites** (from Part C, wired as their modules land):
   - RTL smoke: public suite runs `en` and `ar`, asserts `dir=rtl` and no
     horizontal overflow.
   - A11y: axe on every public template and admin screen.
   - Theme contract: default theme + property-based random palettes — every
     emitted (text, surface) pair meets its WCAG threshold.
   - Single-app gates (ADR-006): blocking Lighthouse budgets on public
     routes; learner-session probes against every `/admin/*` route.
5. **Permission-key cross-check:** every string passed to
   `requirePermission|requireAnyPermission|<Can permission=` must exist in
   the seed registry (CI script, Module 03) — kills the typo'd-key
   silent-403 bug.
6. A module's Definition of Done includes its DEVLOG entry recording test
   results. No green suite, no DEVLOG entry, no merge.

## Judgment calls

- Unit-test pure logic in the package that owns it, not through the UI.
- Integration tests hit a real MariaDB via Testcontainers; reserve mocks for
  the network edge (MSW) only.
- E2E asserts user-visible behavior and DB side effects, not implementation
  details. Prefer one deep journey over five shallow clicks.
- Proxy logic is unit-testable via `next/experimental/testing/server`
  (`unstable_doesProxyMatch`) — use it for matcher/gate tests (Modules 04/06).
