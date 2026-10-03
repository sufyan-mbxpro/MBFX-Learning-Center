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

import { badge, button, check, eyebrow, headline, note, panel } from "./email-blocks.ts";

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
      "<p>Hello <strong>{{recipient.name}}</strong>,</p>" +
      headline("Your heading here") +
      "<p>Write your message here. Keep it short: one idea, and one thing to do next.</p>" +
      button("{{site.url}}", "Visit {{site.name}}") +
      "<p>Thank you for learning with us.</p>" +
      "<p>Best regards,<br><strong>{{site.name}} Team</strong></p>",
  },
  // changes-61: the owner's promotion layout — an eyebrow, a headline, the
  // offer in a tinted panel with ticked lines and an end-date badge, then the
  // one action. Placeholder words an author replaces; no real offer, price or
  // date is promised by the seed.
  {
    id: "design_limited_offer",
    name: "Limited-time offer",
    description:
      "A promotion: headline, the offer in a highlighted box with ticks and an end date.",
    subject: "A limited-time offer from {{site.name}}",
    preheader: "Here is what is included, and when it ends.",
    bodyHtml:
      eyebrow("Limited-time offer") +
      headline("Your offer headline here") +
      "<p>Hi <strong>{{recipient.name}}</strong>,</p>" +
      "<p>One or two sentences on what the offer is and who it is for.</p>" +
      panel(
        "<h3>The offer in one line</h3>",
        check("The first thing that is included"),
        check("The second thing that is included"),
        check("Any condition the reader should know"),
        "<p>" + badge("primary", "Ends on the date you choose") + "</p>",
      ) +
      button("{{site.url}}", "Claim the offer") +
      note("Terms apply. Replace this line with the offer's own conditions.") +
      "<p>Best regards,<br><strong>{{site.name}} Team</strong></p>",
  },
] as const;

/**
 * Design bodies as seeded before changes-61, verbatim. The seed moves a design
 * still holding one of these onto the new body and leaves an edited one alone.
 */
export const EMAIL_DESIGN_PREVIOUS_BODIES: Readonly<Record<string, string>> = {
  design_plain_message:
    "<p>Hello {{recipient.name}},</p>" +
    "<h2>Your heading here</h2>" +
    "<p>Write your message here. Keep it short: one idea, and one thing to do next.</p>" +
    '<p><strong><a href="{{site.url}}">Visit {{site.name}}</a></strong></p>' +
    "<p>Thank you for learning with us.</p>",
};
