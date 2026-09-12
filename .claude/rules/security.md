# Rules — Security

Non-negotiable. A PR violating any numbered rule here does not merge.

## Authorization

1. **`requirePermission()` (or `requireAnyPermission()`) is the first line of
   every mutation** — server action or route handler, no exceptions. The UI
   `<Can>` component and the proxy gate are UX, not security.
2. **Deny beats allow, and deny beats super_admin.** Evaluation order is
   frozen: deny > super_admin > allow (Module 03 SKILL.md documents this as
   frozen behavior with tests).
3. **The STAFF gate comes before the permission check.** A learner cannot
   become staff by acquiring a role — `userType` is checked first ("two
   locks"). Under the single-app architecture (ADR-006) this is checked in
   `proxy.ts` for `/admin/*` **and re-checked server-side** in the admin
   layout and services. Never assume the proxy ran — Next.js docs are
   explicit that server functions must verify auth themselves.
4. `canAssignRole` enforces strict `<` on role level; the last super_admin
   cannot be demoted or deactivated.
5. Every mutation writes an audit row (`recordAudit`). Impersonation start
   and stop are always audited.

## Input & data

6. All external input is parsed through `@repo/contracts` Zod schemas before
   use — route params, search params, form data, webhook bodies. No
   `as`-casting request bodies. This is the mass-assignment defense: parse,
   don't spread.
7. IDOR: every `[id]` route loads the resource _scoped to the subject's
   permissions_, and returns 404 (not 403) where existence itself is
   sensitive. Automated IDOR suite in Module 14 — including learner-session
   probes against every `/admin/*` route (ADR-006).
8. Rich text is sanitized **server-side on save**, regardless of editor
   behavior. XSS regression suite required (Module 11).
9. Uploads: validate MIME (magic bytes, never the client's `File.type`) +
   size server-side; bytes enter storage only through `@repo/core`'s
   `storeImage()` and its storage driver (ADR-017: local disk now, S3 as
   the seam — presigned direct-to-S3 replaces the transport, not the
   validation). Never proxy or fetch arbitrary URLs (SSRF); image "URL"
   text fields are replaced by the upload widget, not supplemented.

## Secrets & sessions

10. Secrets live in environment variables, never in the database, never in
    `NEXT_PUBLIC_*`, never committed. `.env.example` carries names only.
    `SEED_ADMIN_PASSWORD` is dev-only; omit in production and force reset.

    **One exception, ADR-078: the SMTP password.** It is stored in
    `EmailTransport.passwordCipher`, AES-256-GCM-sealed under
    `EMAIL_SECRET_KEY` — which is itself env-only. It is write-only in the
    UI, `loadTransportDriver()` is its only reader, and `EmailTransportView`
    has no password property. Editing the transport is **super_admin-only**,
    because the _host_ is an escalation path: repointing delivery captures
    the next password-reset link. Nothing else may follow this path without
    its own ADR.

11. Sessions are database-backed (revocable). httpOnly cookies on web; tokens
    never in localStorage. Argon2id for password hashing.
12. Non-public settings (`isPublic: false`) must never serialize into RSC
    payloads of public pages (leak test in Module 05).
13. Rate limiting on sign-in/up/reset per IP and per account; lockout uses
    exponential backoff, never a hard lock (self-DoS). **Both limits, not
    one** (ADR-079): per-IP stops one attacker, per-account stops a
    distributed mail-bomb aimed at one address. This covers
    `/request-password-reset`, `/send-verification-email` and newsletter
    signup, whose per-email limit is the same idea without an account.

## Headers & supply chain

14. CSP is nonce-based; the injected `<style id="brand-tokens">` element gets
    the nonce. Stricter policy on `/admin/*` than public (ADR-006).
15. `pnpm-workspace.yaml` `onlyBuiltDependencies` is the allowlist for
    install scripts; do not add to it casually. `minimumReleaseAge` stays on.
    Dependency changes are reviewed; `pnpm audit` runs in CI (Module 14).
