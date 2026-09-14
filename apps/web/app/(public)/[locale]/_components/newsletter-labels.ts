// The newsletter form's strings, resolved once (ADR-080).
//
// Four render sites pass the same nine labels, and the form is a CLIENT
// component — so the strings must be read on the server and handed down. This
// cannot live in `newsletter-form.tsx`: that file is `"use client"`, and a
// plain function exported from a client module reaches a server component as a
// client reference, not something it can call.
//
// One place rather than four: adding a state means adding a label, and this is
// where it is added once instead of being forgotten in three render sites.
import type { NewsletterFormLabels } from "./newsletter-form.tsx";

/** `t` is next-intl's `footer` namespace translator. */
export function newsletterFormLabels(t: (key: string) => string): NewsletterFormLabels {
  return {
    placeholder: t("newsletterPlaceholder"),
    label: t("newsletterLabel"),
    submitLabel: t("newsletterSubmit"),
    pendingLabel: t("newsletterPending"),
    consent: t("newsletterConsent"),
    sent: t("newsletterSent"),
    invalid: t("newsletterInvalid"),
    limited: t("newsletterLimited"),
    failed: t("newsletterFailed"),
  };
}
