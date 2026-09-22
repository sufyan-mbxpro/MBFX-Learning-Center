# ADR-156 — Google reCAPTCHA v3, configured in Settings → General

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 04 (auth), 09 (admin settings), 12 (public site: `/support`),
  14 (hardening)
- **Plan:** owner requests, 2026-09-22: "add the google captcha as well", then
  "add google captcha settings in general under a new tab. admin can enable
  disable in settings & add credentials". The owner chose the scope (staff
  sign-in, learner sign-in and sign-up, the support contact form) and the
  version (v3, invisible, score-based).
- **Closes:** the CAPTCHA item ADR-146 left under "Not done here" (changes-49:
  "Admin login has no CAPTCHA", "Public sign-up endpoint open").
- **Amends:** security.md #10 (a fourth sealed database secret) and
  architecture.md #8 (`auth → secrets`).
- **Does not change:** the rate limits (Better Auth's per-IP rules, the
  per-account lockout, the support form's two limits), the honeypot, or which
  endpoints are anonymous.

## Context

The credential endpoints and the support form had rate limits and a lockout,
but nothing that told a script from a person. A distributed guess campaign
stays inside every per-IP bucket. A sign-up flood sends one verification
email per account, and the support form mails staff. ADR-146 deferred a
CAPTCHA until there was a vendor and keys. The owner picked Google reCAPTCHA
v3 and asked for it to be switched on and off, and its keys entered, in the
admin rather than in the server's environment.

## Decision

1. **One `CaptchaConfig` row, edited by a Settings → General tab.** The row
   holds on/off, the site key, the sealed secret key, a minimum score (0.3,
   0.5, 0.7 or 0.9; Google suggests 0.5) and when a check last passed. It is
   not a registry setting, for the reason Branding is not either: the secret
   is write-only, so the tab is its own form (`CaptchaSettingsForm`). It
   saves under `settings.update`, the key every General tab uses, and the
   tab is absent for a subject without it.
2. **The secret is security.md #10's fourth sealed database secret.**
   - **Why not env:** the owner asked for the keys to be entered in the
     admin, and being able to switch the check off from the admin is the
     point. The sealing key itself is env-only (`CAPTCHA_SECRET_KEY`).
   - **Its one reader:** `loadCaptchaRuntime()` in `@repo/auth`.
     `CaptchaSettingsView` carries `hasSecretKey`, never the value. The audit
     row records only that the secret changed.
   - **Its gate, by blast radius:** the secret can only ask Google whether a
     token passed. It captures and delivers nothing, unlike the SMTP host or
     the AI `baseUrl`. So it gets the ordinary `settings.update`, not
     super_admin.
   - **Why not an existing seal:** each existing key belongs to the package
     that owns its secret (email, core, ai). This secret is `@repo/auth`'s,
     and sealing it under another package's key would tie rotating that key
     to sign-in.
3. **Switching on is proved, not trusted.** When the tab saves with the check
   on, the browser mints a token for the `check` action with the site key
   being saved. The server verifies it with the secret being saved (typed
   now, or the stored one). The row is written only if it passes. Keys that
   do not work would refuse every sign-in, including the admin who would
   have to sign in to fix them.
4. **Our own guard, not Better Auth's `captcha` plugin.** That plugin takes
   its keys once, at startup. `recaptchaGuard()` is a Better Auth plugin of
   our own. Its `onRequest` reads the row on each request to
   `/sign-in/email` and `/sign-up/email`, so switching the tab takes effect
   at once. It answers with the same codes the library uses
   (`MISSING_RESPONSE` 400, `VERIFICATION_FAILED` 403). Every credential form
   on both surfaces posts to those two endpoints (ADR-052), so one guard
   covers the staff sign-in and the learner pair. It answers before the
   endpoint runs, so a refused token never reaches the lockout: a bot's
   attempt is not a wrong password. `onRequest` sees HTTP only, so
   server-side `auth.api.*` calls (the seed, tests) are not asked for a
   token.
5. **The support form checks its own token.** It is a server action, so
   `verifyCaptchaToken()` checks the `support` token itself, AFTER both rate
   limits, so a flood is cut off before this server makes any request to
   Google. A refusal answers with a new `captcha` state.
6. **Action names are checked.** The actions are `auth`, `support` and
   `check` (`CAPTCHA_ACTIONS`, `@repo/contracts`). A token minted on one form
   is refused at the others.
7. **Two failure directions.** A token that fails (missing, low score, wrong
   action, Google's "no", Google unreachable after 10 s) is refused: that is
   the check doing its job. A configuration that cannot be used (the sealing
   key lost or rotated, a half-filled row) turns the check OFF and logs an
   error. It never becomes "refuse everyone". `CAPTCHA_DISABLED` in the
   environment is the break-glass switch for the one lockout left, Google
   itself being down.
8. **The site key reaches the page as data.** Each guarded page reads
   `getCaptchaSiteKey()`, which is cached (`"use cache"`) and tagged
   `settings:captcha`. The `settings:{group}` family is frozen API, and a
   save revalidates the tag. The page passes the key to its form, which
   registers it with `useRecaptcha(siteKey)`. The public pages stay static
   (architecture.md #6). The key is public by design, so nothing
   non-public reaches the page (security.md #12). Google's script loads only
   where a guarded form mounts, and its badge stays visible as the notice
   Google requires.
9. **The CSP names Google on the pages that can load it.** Whether the check
   is on is a database fact the proxy does not read. So Google's documented
   origins go on `/keystone`, `/keystone/settings/general` and the public
   `sign-in`, `sign-up` and `support` pages, and on no other:
   - `script-src`: `www.google.com/recaptcha/`, `www.gstatic.com/recaptcha/`
   - `frame-src`: `www.google.com/recaptcha/`, `recaptcha.google.com/recaptcha/`

   On `/keystone`, `'strict-dynamic'` ignores host lists. The script runs
   there because a nonced Next chunk inserts it.

10. **A refusal says what happened.** A blocked script and either guard code
    show "We couldn't confirm this request came from a person…", never
    "check your password". Each refusal in the settings tab names what to
    fix: the sealing key, a missing secret, keys that fail, or a browser
    that could not run the check.

## Consequences

- **With the check on, the three forms need JavaScript.** The support form
  still submits before hydration while the check is off (ADR-113). The
  credential forms already needed JavaScript.
- **A reader whose content blocker blocks Google cannot sign in, sign up or
  send a support message** while the check is on. The message tells them
  what to do.
- A Google outage is a sign-in outage while the check is on. The fix is
  `CAPTCHA_DISABLED=1` and a restart, since the admin cannot sign in to
  switch it off.
- Deploying the feature needs `CAPTCHA_SECRET_KEY`. Without it the tab says
  so and cannot switch the check on.
- A public page can carry a stale site key for the moment between a save and
  its revalidation. A submit from it is refused with the captcha message,
  and a reload fixes it.
- Not done: `allowedHostnames` (Google's test keys report their own
  hostname), and reCAPTCHA on the newsletter form and password reset. Each is
  a small change later.
