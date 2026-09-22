// The STARTING CONTENT of every email this product sends (Module 17, ADR-078 #5).
//
// It lives here, in @repo/db, for one reason: two callers need the same words.
// The seed writes them on a fresh database, and `resetEmailTemplate()` in
// @repo/core puts an edited template back to them. Keeping the array in
// `prisma/seed.ts` would have meant the reset button owning a second copy of
// five bodies, which is the drift `check:email-templates` exists to catch one
// level up.
//
// It carries no KEYS of its own authority: `EMAIL_TEMPLATES` in
// @repo/contracts declares which templates exist, and
// `scripts/check-email-templates.mjs` fails when the two lists disagree. This
// file cannot import that registry — @repo/db sits upstream of
// @repo/contracts — which is exactly why the check is a script.
//
// Plain prose and one link each: @repo/email's layout supplies the frame, and
// every `ed-*` class becomes an inline style at render time, so a template
// never carries a colour of its own.

export interface EmailTemplateDefault {
  key: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
}

export const EMAIL_TEMPLATE_DEFAULTS: readonly EmailTemplateDefault[] = [
  {
    key: "auth.password_reset",
    subject: "Reset your password",
    preheader: "The link expires in {{expires.minutes}} minutes.",
    bodyHtml:
      "<p>Hello {{recipient.name}},</p>" +
      "<p>Someone asked to reset the password for your {{site.name}} account. " +
      "If that was you, use the link below. It expires in {{expires.minutes}} minutes.</p>" +
      '<p><a href="{{reset.url}}">Reset your password</a></p>' +
      "<p>If it was not you, nothing has changed and you can ignore this message.</p>",
  },
  {
    key: "auth.verify_email",
    subject: "Confirm your email address",
    preheader: "One click and your {{site.name}} account is confirmed.",
    bodyHtml:
      "<p>Welcome to {{site.name}}, {{recipient.name}}.</p>" +
      "<p>Confirm this address so we know we can reach you:</p>" +
      '<p><a href="{{verify.url}}">Confirm my email</a></p>' +
      "<p>You can keep using your account either way — confirming just keeps you " +
      "reachable if you ever need to recover it.</p>",
  },
  {
    key: "auth.password_changed",
    subject: "Your password was changed",
    preheader: "A confirmation, in case it was not you.",
    bodyHtml:
      "<p>Hello {{recipient.name}},</p>" +
      "<p>The password on your {{site.name}} account was changed on {{changed.at}}, " +
      "and every signed-in session was signed out.</p>" +
      "<p>If that was not you, reset your password immediately and contact us.</p>",
  },
  {
    key: "auth.email_changed",
    subject: "Your email address was changed",
    preheader: "A confirmation, in case it was not you.",
    bodyHtml:
      "<p>Hello {{recipient.name}},</p>" +
      "<p>The email address on your {{site.name}} account was changed on {{changed.at}}. " +
      "It is now {{email.new}}, and this address will no longer receive messages about " +
      "the account.</p>" +
      "<p>If that was not you, contact us immediately so we can secure your account.</p>",
  },
  {
    key: "newsletter.confirm",
    subject: "Confirm your newsletter subscription",
    preheader: "One click to start receiving {{site.name}} updates.",
    bodyHtml:
      "<p>Thanks for signing up to the {{site.name}} newsletter.</p>" +
      "<p>Confirm the subscription to start receiving it:</p>" +
      '<p><a href="{{confirm.url}}">Confirm my subscription</a></p>' +
      "<p>If you did not sign up, ignore this message — nothing happens without " +
      "that confirmation.</p>",
  },
  {
    key: "newsletter.welcome",
    subject: "You are subscribed",
    preheader: "Here is what to expect from the {{site.name}} newsletter.",
    bodyHtml:
      "<p>You are on the list. Expect market notes, new lessons and the " +
      "occasional deep dive from {{site.name}}.</p>" +
      '<p>You can <a href="{{unsubscribe.url}}">unsubscribe</a> at any time.</p>',
  },
  // The support inbox's own copy of a visitor's message (ADR-113).
  //
  // The subject carries the visitor's, prefixed, so a reply keeps its thread
  // and an inbox rule can match the prefix. `{{contact.email}}` is on its own
  // line because that is how the reader replies: `sendTemplatedEmail` has no
  // per-send reply-to override, and the template's stored `replyTo` is a
  // fixed address, so the visitor's own is printed rather than smuggled into
  // a header.
  //
  // **`{{contact.message}}` arrives with its paragraph breaks collapsed.**
  // Every variable is escaped after the body is sanitised (`render.ts`), which
  // is what makes a message containing markup safe, and it also means a
  // newline is a newline in HTML — i.e. a space. The words are all there. The
  // alternative is a template language that can loop, which ADR-078 #6
  // deliberately refused.
  {
    key: "support.request",
    subject: "Support request: {{contact.subject}}",
    preheader: "From {{contact.name}} <{{contact.email}}>",
    bodyHtml:
      "<p><strong>{{contact.name}}</strong> sent a message through the " +
      "{{site.name}} support form.</p>" +
      '<p class="ed-tx-muted">Reply to: {{contact.email}}</p>' +
      '<p class="ed-tx-muted">Subject: {{contact.subject}}</p>' +
      '<p class="ed-tx-muted">Reading the site in: {{contact.locale}}</p>' +
      "<p>{{contact.message}}</p>",
  },
] as const;

/** The default content for one key, or null when the key is not one of ours. */
export function emailTemplateDefault(key: string): EmailTemplateDefault | null {
  return EMAIL_TEMPLATE_DEFAULTS.find((template) => template.key === key) ?? null;
}
