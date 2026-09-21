# SKILL — Module 14: Hardening & launch gate

plan.md Module 14. Cross-cutting; runs alongside Modules 09–13. Nothing
launches until this module's gate is green and signed off in DEVLOG.

## Scope

- **CSP:** nonce-based; the injected `<style id="brand-tokens">` gets the
  nonce; report-only soak, then enforce. Per-path policy: stricter on
  `/admin/*` than public (ADR-006). Document in security.md.
- Path-based admin protection at the edge (IP allowlist / WAF on `/admin/*`);
  host-rewrite escape hatch documented if host isolation is ever needed.
- Dependency audit in CI (`pnpm audit`) + Renovate (which also proposes the
  reviewable TypeScript/stack bumps per ADR-010/stack.md).
- Backup/restore runbook for MariaDB (tested, not just written).
- Sentry + structured logging. k6 load smoke (lesson page + admin login).
- OWASP ASVS L1 self-audit: IDOR probes on every `[id]` route,
  mass-assignment via contracts-only parsing, SSRF on media fetch.

## Running the E2E suite

`pnpm e2e` (root) or `pnpm --filter web e2e`. Prerequisites and the three
things that used to make it unrunnable:

- **Its own database.** `mbfx_e2e` is dropped, migrated, seeded and given its
  fixtures on every run — never the dev database, which `provision.mts`
  refuses by name. Creating it needs a privilege `MARIADB_USER` does not get
  by default: `docker/mariadb-init/10-e2e-grants.sql` grants it on a fresh
  volume, and an existing container needs that GRANT applied once by hand
  (Prisma reports the gap as `P1010`).
- **Provisioning runs from the web server's own command**, not `globalSetup`
  — Playwright starts `webServer` first, so anything in `globalSetup` loses
  the race to a server that cannot answer without a database. `globalSetup`
  verifies instead.
- **It coexists with `pnpm dev`.** The E2E server builds into `.next-e2e`
  (`NEXT_DIST_DIR`), because Next 16 takes a dev lock per `distDir` and
  refuses a second dev server sharing one.

**Writing a spec: wait for hydration before acting.** Playwright's
actionability is a DOM property, and server-rendered React satisfies it
before any JavaScript has run. Use `e2e/hydration.ts` — `openAdminScreen`,
`reloadAdminScreen`, `fillField` — rather than `page.goto` + `fill`. A click
on an un-attached handler does nothing and a `fill` can CONCATENATE with the
value React restores mid-operation; both read as bugs in the code under test.
That mistake is what kept every admin spec `fixme` for months under the wrong
diagnosis.

**Scope a locator to the row or card it means.** `.first()` on a list of
switches flips whichever record the query returned first, then asserts against
the record you named — the most misleading way for a test to fail. Filter by
something that identifies the subject (`[data-slot="card"]` + its own text, a
`row` + its title).

**`getByLabel` reads label TEXT, so `{ exact: true }` and ADR-077's required
asterisk do not mix** — `<Field required>` draws a `*` inside the label, and
`aria-hidden` keeps a screen reader from saying "star" but does not remove it
from the text.

## Launch gate (all blocking)

- CSP enforced after clean soak.
- IDOR suite: authenticated-as-A vs B's resources → 403/404 across all admin
  APIs; **learner session vs every `/admin/*` route and admin handler →
  403/404, never 200** (single-app cross-surface probe).
- Full CI matrix green; Lighthouse budgets green (the admin-bundle-leak
  backstop); launch checklist appended to DEVLOG and signed off.
- **`ABOUT_CONTENT_MODE=real` (ADR-051 §1).** The About section ships with a
  PLACEHOLDER dataset — invented figures, a made-up company history, twelve
  awards from fictional bodies — because the owner asked for a section that
  reads as finished before the real content exists. Going to production in
  `demo` publishes all of it as fact. Check `data-about-content` on
  `/about`'s `<main>`: it must read `real`. This is the only launch-gate item
  that is a content claim rather than a technical one, and it is the one a
  green CI run will not catch.
