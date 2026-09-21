// `/support`'s facts (Module 12, ADR-113 — rewritten from the ADR-109 stub).
//
// **ADR-047 §2's two rules still govern this file, and rule 2 is why the FAQ
// moved in here from the message catalog:**
//
//   1. An EMPTY collection renders NOTHING — not a placeholder, not a
//      heading over an empty grid. Empty `SUPPORT_CHANNELS` ⇒ no "How can we
//      help?" band. No `site.supportEmail` ⇒ no contact form AND no Email
//      Support card, because both of those are that one address (ADR-131).
//   2. Nothing factual lives in the message catalogs. Catalog strings
//      describe how support works — qualitative, checkable against the
//      product. An address, a phone number, an opening-hours line or a
//      claim about a minimum deposit comes from here, where it is visibly the
//      owner's to supply and to correct.
//
// Rule 2 is the whole argument for `SUPPORT_FAQ` being here rather than under
// `support.faq.*` in `en.json`. These seven answers are dense with quantities
// — a $10 minimum, 1:100 leverage, MetaTrader 5, 15-minute-to-24-hour
// processing, GMT+2 — and every one of them is a claim about a brokerage
// rather than a description of a product feature. A translator should not be
// the person who decides what a withdrawal window says, which is the reasoning
// `SupportChannel.availability` has always carried: a wrong translation of a
// fact is worse than an untranslated one. The BAND's heading, lead, card
// titles, button labels and form copy stay in the catalog, because those are
// interface text (code-style #2 is unchanged — see ADR-113 §3).
//
// The content is the owner's own, transcribed from the published page at
// https://mbfx.co/support. Nothing here is invented; the withdrawal of the
// About section (ADR-109) turned on exactly that distinction.
//
// No I/O and no package imports: this is data the page reads at build time,
// so it stays a plain module.

/**
 * What the channel cards advertise besides email.
 *
 * **The support inbox is not here any more (ADR-131).** It is the
 * `site.supportEmail` setting (Settings → General), because an address the
 * owner changes should not need a deploy — and because it had been seeded,
 * typed and editable there since Module 05 while read by nothing, so an admin
 * could change it, see "Saved", and keep mail arriving at the old address
 * (code-style.md #28). The page and the action both read that one setting, so
 * the Email Support card and the form still cannot disagree (ADR-113 §2).
 *
 * `whatsapp` and `phone` are E.164 with the leading `+`. `tel:` takes that
 * form as is; `wa.me` wants digits only, so its href strips the `+`.
 *
 * Typed as `string`, deliberately NOT `as const`, so the owner may empty a
 * field without a compile error elsewhere.
 */
export interface SupportContact {
  phone: string;
  phoneDisplay: string;
  whatsapp: string;
}

export const SUPPORT_CONTACT: SupportContact = {
  phone: "+18445880522",
  /**
   * The same number as `phone`, punctuated for reading rather than for
   * dialling. Two fields rather than one formatter: grouping a phone number
   * is a national convention, not an algorithm, and a helper that guessed
   * would eventually guess wrong on the first non-US number added here.
   */
  phoneDisplay: "+1-844-588-0522",
  whatsapp: "+447822035609",
};

/**
 * A way to reach support, in the order the cards are drawn.
 *
 * `kind` picks the icon in the page's own registry — a lucide name held as a
 * string here would be a key nothing validates (ADR-048's split, same
 * reasoning as `MEGA_MENU_ICONS`).
 *
 * `availability` is the human line under the description ("24/7",
 * "Mon-Fri 9AM-6PM GMT"). It carries its own text rather than a catalog key
 * because opening hours are a fact — see rule 2 above.
 *
 * `href` is built here rather than in the page so that the ONE thing a
 * reviewer has to check about an anonymous outbound link — its scheme — is
 * visible in one place. The email channel's is `null`: its address is the
 * `site.supportEmail` setting, which this file cannot read, so the page builds
 * the `mailto:` from it (ADR-131).
 */
export interface SupportChannel {
  kind: "whatsapp" | "email" | "phone";
  availability: string;
  href: string | null;
}

export const SUPPORT_CHANNELS: readonly SupportChannel[] = [
  {
    kind: "whatsapp",
    availability: "24/7",
    href: `https://wa.me/${SUPPORT_CONTACT.whatsapp.replace(/\D/g, "")}`,
  },
  {
    kind: "email",
    availability: "Response within 2 hours",
    href: null,
  },
  {
    kind: "phone",
    availability: "Mon-Fri 9AM-6PM GMT",
    href: `tel:${SUPPORT_CONTACT.phone}`,
  },
];

/**
 * The questions support is actually asked, with the owner's own answers.
 *
 * Plain text, not HTML: `FaqPanel` renders these with `format="text"`, so
 * nothing here needs sanitising and nothing here can carry a link. If an
 * answer ever needs one, the answer is too long and wants a page.
 */
export interface SupportFaqItem {
  question: string;
  answer: string;
}

export const SUPPORT_FAQ: readonly SupportFaqItem[] = [
  {
    question: "How do I open a trading account?",
    answer:
      "Opening an account is simple. Click 'Sign Up' on our homepage, choose your account type, complete the registration form, verify your identity, and make your first deposit. The entire process typically takes 15-30 minutes.",
  },
  {
    question: "What is the minimum deposit required?",
    answer:
      "The minimum deposit depends on the payment method you choose. Our deposit and withdrawal requests are typically processed within a minimum of 15 minutes and up to a maximum of 24 hours. To view your exact deposit limits and available methods, please log in to your client portal. You can start trading with as little as $10.",
  },
  {
    question: "How can I withdraw my funds?",
    answer:
      "You can withdraw funds using the same method you used for your deposit. Withdrawals are processed within a minimum of 30 minutes and up to a maximum of 24 hours. During weekends and public holidays, processing may take up to 48 hours. We also offer instant withdrawal services for selected payment methods.",
  },
  {
    question: "What trading platforms do you offer?",
    answer:
      "We are licensed by MetaQuotes and provide you with the industry-leading MetaTrader 5 (MT5) trading platform. Our clients can access MT5 through the web terminal, mobile apps for iOS and Android, and desktop applications for Windows and Mac. All versions offer advanced charting tools, real-time price feeds, fast execution, and a full suite of professional trading features.",
  },
  {
    question: "What are your trading hours?",
    answer:
      "The forex market operates 24 hours a day, 5 days a week. Trading opens on Sunday at 5:00 PM EST and closes on Friday at 5:00 PM EST. On our platform, market hours are displayed in GMT+2 for your convenience. Additionally, cryptocurrency trading is available 24/7, allowing you to trade anytime — even on weekends and public holidays.",
  },
  {
    question: "Do you offer educational resources?",
    answer:
      "Yes, we provide comprehensive educational materials including trading courses, live webinars, platform tutorials, market analysis, and a complete trading glossary. All resources are free for our clients.",
  },
  {
    question: "What is leverage and how does it work?",
    answer:
      "Leverage allows you to control larger positions with smaller capital. For example, with 1:100 leverage, you can control $10,000 with just $100. While leverage can amplify profits, it also increases risk, so proper risk management is essential.",
  },
];
