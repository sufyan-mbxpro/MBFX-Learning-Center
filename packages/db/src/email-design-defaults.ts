// The designs a fresh install starts with (ADR-172 #3, changes-55 §5.3).
//
// A design is a starting point an admin copies into a custom email; it is not
// a template, has no key, and nothing sends it on its own. The seed writes
// these rows create-only under a FIXED id, so a later seed run never
// overwrites an admin's edit and never adds a second copy.
//
// Kept apart from `email-template-defaults.ts` on purpose:
// `check:email-templates` reads that file as the registry's mirror, and a
// design in it would look like a template key nobody declared.
//
// Only the variables a custom email may use (`CUSTOM_EMAIL_VARIABLES`):
// the globals and `unsubscribe.url`. RICH mode, so the shell supplies the
// logo, the footer, the postal address and the unsubscribe link.

export interface EmailDesignDefault {
  id: string;
  name: string;
  description: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
}

export const EMAIL_DESIGN_DEFAULTS: readonly EmailDesignDefault[] = [
  {
    id: "design_plain_message",
    name: "Plain message",
    description: "A greeting, a heading, a few paragraphs and one button.",
    subject: "News from {{site.name}}",
    preheader: "",
    bodyHtml:
      "<p>Hello {{recipient.name}},</p>" +
      "<h2>Your heading here</h2>" +
      "<p>Write your message here. Keep it short: one idea, and one thing to do next.</p>" +
      '<p><strong><a href="{{site.url}}">Visit {{site.name}}</a></strong></p>' +
      "<p>Thank you for learning with us.</p>",
  },
] as const;
