// The STARTING CONTENT of every email this product sends (Module 17, ADR-078 #5).
//
// It lives here, in @repo/db, for one reason: two callers need the same words.
// The seed writes them on a fresh database, and `resetEmailTemplate()` in
// @repo/core puts an edited template back to them. Keeping the array in
// `prisma/seed.ts` would have meant the reset button owning a second copy of
// the bodies, which is the drift `check:email-templates` exists to catch one
// level up.
//
// It carries no KEYS of its own authority: `EMAIL_TEMPLATES` in
// @repo/contracts declares which templates exist, and
// `scripts/check-email-templates.mjs` fails when the two lists disagree. This
// file cannot import that registry — @repo/db sits upstream of
// @repo/contracts — which is exactly why the check is a script.
//
// **The design (changes-61, ADR-184).** Every body opens on an eyebrow and a
// headline, prints each dynamic value in bold, puts the facts of a message in
// a tinted panel and its one action on a BUTTON. All of it is `ed-*` classes
// from `./email-blocks.ts`, which @repo/email's layout turns into inline
// styles from the active theme at send time — a template still never carries
// a colour of its own.
import { badge, button, check, codeBox, eyebrow, headline, note, panel } from "./email-blocks.ts";

export interface EmailTemplateDefault {
  key: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
}

const SIGNOFF = "<p>Best regards,<br><strong>{{site.name}} Team</strong></p>";

export const EMAIL_TEMPLATE_DEFAULTS: readonly EmailTemplateDefault[] = [
  // changes-61: the registration email, sent once a learner's account exists.
  {
    key: "auth.welcome",
    subject: "Welcome to {{site.name}}",
    preheader: "Your account is ready. Here is where to start.",
    bodyHtml:
      eyebrow("Welcome aboard") +
      headline("Your account is ready") +
      "<p>Dear <strong>{{recipient.name}}</strong>,</p>" +
      "<p>Thank you for registering with <strong>{{site.name}}</strong>. Your account " +
      "has been created for <strong>{{recipient.email}}</strong>.</p>" +
      panel(
        "<h3>What you can do now</h3>",
        check("Follow structured forex and crypto courses, lesson by lesson"),
        check("Test what you have learned with short quizzes"),
        check("Use the trading calculators and the economic calendar"),
        "<p>" + badge("success", "Account created") + "</p>",
      ) +
      button("{{site.url}}", "Start learning") +
      note("We will also send you a short code to confirm this email address.") +
      SIGNOFF,
  },
  // changes-61, ADR-184: the code a new learner types to confirm the address.
  {
    key: "auth.verify_code",
    subject: "Your {{site.name}} verification code: {{verify.code}}",
    preheader: "Use this code to verify your email. It is valid for {{expires.minutes}} minutes.",
    bodyHtml:
      eyebrow("Email verification") +
      headline("Verify your email address") +
      "<p>Dear <strong>{{recipient.name}}</strong>,</p>" +
      "<p>Please verify your email address using the code below:</p>" +
      codeBox("Your verification code", "{{verify.code}}") +
      note("This code is valid for <strong>{{expires.minutes}} minutes</strong>.") +
      "<p>If you did not create an account with <strong>{{site.name}}</strong>, you can " +
      "ignore this email.</p>" +
      SIGNOFF,
  },
  {
    key: "auth.password_reset",
    subject: "Reset your password",
    preheader: "The link expires in {{expires.minutes}} minutes.",
    bodyHtml:
      eyebrow("Account security") +
      headline("Reset your password") +
      "<p>Dear <strong>{{recipient.name}}</strong>,</p>" +
      "<p>Someone asked to reset the password for your <strong>{{site.name}}</strong> " +
      "account. If that was you, use the button below. The link expires in " +
      "<strong>{{expires.minutes}} minutes</strong>.</p>" +
      button("{{reset.url}}", "Reset password") +
      panel(
        "<p>" + badge("warning", "Not you?") + "</p>",
        "<p>If you did not ask for this, nothing has changed and you can ignore this " +
          "message. Your password stays the same.</p>",
      ) +
      note("Button not working? Paste this link into your browser: {{reset.url}}") +
      SIGNOFF,
  },
  // Since ADR-184 this confirms a NEW address after a change of email: a
  // sign-up is verified by `auth.verify_code`.
  {
    key: "auth.verify_email",
    subject: "Confirm your email address",
    preheader: "One click and your {{site.name}} account is confirmed.",
    bodyHtml:
      eyebrow("Confirm your address") +
      headline("Confirm this email address") +
      "<p>Dear <strong>{{recipient.name}}</strong>,</p>" +
      "<p>Please confirm that <strong>{{recipient.email}}</strong> is the address you want " +
      "to use for your <strong>{{site.name}}</strong> account:</p>" +
      button("{{verify.url}}", "Confirm my email") +
      note("Button not working? Paste this link into your browser: {{verify.url}}") +
      "<p>If you did not ask for this, you can ignore this email and nothing will change.</p>" +
      SIGNOFF,
  },
  {
    key: "auth.password_changed",
    subject: "Your password was changed",
    preheader: "A confirmation, in case it was not you.",
    bodyHtml:
      eyebrow("Account security") +
      headline("Your password was changed") +
      "<p>Dear <strong>{{recipient.name}}</strong>,</p>" +
      "<p>The password on your <strong>{{site.name}}</strong> account was just changed.</p>" +
      panel(
        "<p>" + badge("success", "Password updated") + "</p>",
        "<p>Changed on: <strong>{{changed.at}}</strong></p>",
        "<p>Every signed-in session was signed out.</p>",
      ) +
      "<p>If that was not you, reset your password immediately and contact us.</p>" +
      button("{{site.url}}", "Go to {{site.name}}") +
      SIGNOFF,
  },
  {
    key: "auth.email_changed",
    subject: "Your email address was changed",
    preheader: "A confirmation, in case it was not you.",
    bodyHtml:
      eyebrow("Account security") +
      headline("Your email address was changed") +
      "<p>Dear <strong>{{recipient.name}}</strong>,</p>" +
      "<p>The email address on your <strong>{{site.name}}</strong> account was changed. " +
      "This address will no longer receive messages about the account.</p>" +
      panel(
        "<p>" + badge("warning", "Security notice") + "</p>",
        "<p>New address: <strong>{{email.new}}</strong></p>",
        "<p>Changed on: <strong>{{changed.at}}</strong></p>",
      ) +
      "<p>If that was not you, contact us immediately so we can secure your account.</p>" +
      SIGNOFF,
  },
  {
    key: "newsletter.confirm",
    subject: "Confirm your newsletter subscription",
    preheader: "One click to start receiving {{site.name}} updates.",
    bodyHtml:
      eyebrow("Newsletter") +
      headline("One more step") +
      "<p>Thanks for signing up to the <strong>{{site.name}}</strong> newsletter.</p>" +
      "<p>Confirm the subscription to start receiving it:</p>" +
      button("{{confirm.url}}", "Confirm my subscription") +
      note("Button not working? Paste this link into your browser: {{confirm.url}}") +
      "<p>If you did not sign up, ignore this message — nothing happens without that " +
      "confirmation.</p>" +
      SIGNOFF,
  },
  {
    key: "newsletter.welcome",
    subject: "You are subscribed",
    preheader: "Here is what to expect from the {{site.name}} newsletter.",
    bodyHtml:
      eyebrow("Newsletter") +
      headline("You are on the list") +
      "<p>Welcome to the <strong>{{site.name}}</strong> newsletter. Here is what to expect:</p>" +
      panel(
        check("Market notes that explain what moved and why"),
        check("New lessons and courses as soon as they are published"),
        check("The occasional deep dive into a single topic"),
        "<p>" + badge("success", "Subscribed") + "</p>",
      ) +
      button("{{site.url}}", "Visit {{site.name}}") +
      note('You can <a href="{{unsubscribe.url}}">unsubscribe</a> at any time.') +
      SIGNOFF,
  },
  // The support inbox's own copy of a visitor's message (ADR-113).
  //
  // The subject carries the visitor's, prefixed, so a reply keeps its thread
  // and an inbox rule can match the prefix. `{{contact.email}}` is printed
  // because that is how the reader replies: `sendTemplatedEmail` has no
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
      eyebrow("Support request") +
      headline("{{contact.subject}}") +
      "<p><strong>{{contact.name}}</strong> sent a message through the " +
      "<strong>{{site.name}}</strong> support form.</p>" +
      panel(
        "<p>From: <strong>{{contact.name}}</strong></p>",
        "<p>Reply to: <strong>{{contact.email}}</strong></p>",
        "<p>Reading the site in: " + badge("info", "{{contact.locale}}") + "</p>",
      ) +
      "<h3>Message</h3>" +
      panel("<p>{{contact.message}}</p>"),
  },
  // A new course, announced (ADR-171 #8). The body is the design; a campaign
  // overrides only its subject and the short note. The cover is ALWAYS a URL
  // (a track's raster panel when the course has none — Gmail and Outlook do
  // not render SVG), and an empty note is an empty paragraph, because the
  // template language has no conditionals (ADR-078 #6). The lesson count is
  // a label, not a sentence, so "1" never reads "1 lessons".
  {
    key: "announcement.course",
    subject: "New course: {{course.title}}",
    preheader: "{{course.summary}}",
    bodyHtml:
      '<p><a href="{{course.url}}"><img src="{{course.coverUrl}}" alt="{{course.title}}" ' +
      'width="560" style="width:100%;max-width:560px;height:auto;border:0"></a></p>' +
      eyebrow("New course") +
      headline("{{course.title}}") +
      "<p>" +
      badge("primary", "{{course.level}}") +
      " " +
      badge("muted", "Lessons: {{course.lessonCount}}") +
      "</p>" +
      "<p>{{course.summary}}</p>" +
      "<p><strong>{{campaign.message}}</strong></p>" +
      button("{{course.url}}", "Start the course") +
      note(
        "You are receiving this because you have an account with {{site.name}} or " +
          'subscribed to its newsletter. <a href="{{unsubscribe.url}}">Stop course announcements</a>.',
      ),
  },
] as const;

/** The default content for one key, or null when the key is not one of ours. */
export function emailTemplateDefault(key: string): EmailTemplateDefault | null {
  return EMAIL_TEMPLATE_DEFAULTS.find((template) => template.key === key) ?? null;
}

/**
 * The defaults these templates shipped with BEFORE changes-61, verbatim.
 *
 * The seed is create-only, so a live install would keep the old plain bodies
 * forever. It upgrades a stored English row only while that row still holds
 * EXACTLY one of these bodies — i.e. nobody has edited it — and leaves an
 * admin's own wording alone (the ADR-183 rule for every re-seed). Never edit
 * an entry here: it is a fingerprint, and a changed fingerprint matches
 * nothing.
 */
export const EMAIL_TEMPLATE_PREVIOUS_DEFAULTS: readonly EmailTemplateDefault[] = [
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
  {
    key: "announcement.course",
    subject: "New course: {{course.title}}",
    preheader: "{{course.summary}}",
    bodyHtml:
      '<p><a href="{{course.url}}"><img src="{{course.coverUrl}}" alt="{{course.title}}" ' +
      'width="560" style="width:100%;max-width:560px;height:auto;border:0"></a></p>' +
      '<p class="ed-tx-primary ed-fs-sm"><strong>New course</strong></p>' +
      "<h2>{{course.title}}</h2>" +
      '<p class="ed-tx-muted ed-fs-sm">Level: {{course.level}} · Lessons: {{course.lessonCount}}</p>' +
      "<p>{{course.summary}}</p>" +
      "<p>{{campaign.message}}</p>" +
      '<p><strong><a href="{{course.url}}">Start the course</a></strong></p>' +
      '<p class="ed-tx-muted ed-fs-sm">You are receiving this because you have an account ' +
      "with {{site.name}} or subscribed to its newsletter. " +
      '<a href="{{unsubscribe.url}}">Stop course announcements</a>.</p>',
  },
] as const;
