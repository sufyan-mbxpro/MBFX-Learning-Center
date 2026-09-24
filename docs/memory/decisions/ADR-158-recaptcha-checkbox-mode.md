# ADR-158 — reCAPTCHA can be a checkbox in the form, chosen in Settings

- **Status:** Accepted
- **Date:** 2026-09-24
- **Module:** 04 (auth), 09 (admin settings), 12 (public site)
- **Plan:** owner request, 2026-09-24: "add the form within form checked
  captcha rather than showing floating captcha". Asked to choose, the owner
  picked "selectable in Settings" over replacing v3.
- **Amends:** ADR-156 #1 (the row gains a type), #6 (actions), #8 (what
  reaches the page). Everything else in ADR-156 stands, including the sealed
  secret, the proved switch-on, the two failure directions, the CSP scope and
  the break-glass variable.

## Context

ADR-156 shipped Google reCAPTCHA v3: invisible, score-based, with Google's
floating badge as the only visible sign. The owner wants the visible "I'm not
a robot" checkbox inside the form instead. That is reCAPTCHA v2 ("Checkbox"),
a different product with its own keys: a v3 key cannot render a checkbox, and
a v2 answer carries no score and no action.

## Decision

1. **`CaptchaConfig.mode` — `SCORE` (v3, the default and every existing row)
   or `CHECKBOX` (v2).** A type select on the reCAPTCHA tab. The keys stay
   one pair: whoever switches type enters the matching keys from Google, and
   the proved switch-on (ADR-156 #3) is what catches a pair of the wrong type.
2. **The page gets the type with the key.** `getCaptchaSiteKey()` becomes
   `getCaptchaClient()`, returning `{ siteKey, mode } | null`, same cache and
   tag. Forms take `captcha` instead of `captchaSiteKey`.
3. **The checkbox renders inside the form, above the submit button**
   (`RecaptchaCheckbox`, app-level shared code beside `recaptcha.ts`). It
   draws nothing in `SCORE` mode. It follows the reader's colour mode when it
   is drawn. Google's badge does not appear in `CHECKBOX` mode.
4. **An unticked box is refused in the browser, with its own message**
   ("Tick 'I'm not a robot'…"), before any request. The server still refuses a
   missing or failing answer (ADR-156 #4, #5): the browser check is UX.
5. **A checkbox answer is single-use, so the widget resets after each
   submit.** A wrong password means ticking again, which is how Google's own
   widget behaves.
6. **Verification by type.** `SCORE` keeps ADR-156 #6: score and action.
   `CHECKBOX` checks `success` only, because v2 answers have neither. So in
   this mode a token from one form is not bound to that form. It is still
   single-use and expires in two minutes, and each form refuses without one.
7. **The settings tab proves a checkbox key by ticking one.** With `CHECKBOX`
   chosen and the switch on, the tab draws the box for the site key being
   typed, and Save sends its answer as the proof.

## Consequences

- Switching type needs new keys from Google. The tab says so in the type's
  hint, and a save with the wrong kind of key is refused by the proof.
- The checkbox is 304px wide, Google's fixed size. It fits every form at
  phone width.
- The minimum score is ignored while the type is `CHECKBOX`; the tab hides it.
- Not done: the invisible v2 variant, and `hostname` checking (ADR-156 left
  that open too).
