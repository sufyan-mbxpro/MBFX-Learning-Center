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
