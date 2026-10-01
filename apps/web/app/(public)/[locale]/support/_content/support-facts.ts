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
 * The questions support is actually asked (ADR-113), in the order they are
 * shown. The WORDS are catalog messages, `support.faq.items.<key>` (ADR-159
 * #6): they are interface text like every other band on the page, and left in
 * code they made `/ar/support` the one page with English inside it.
 *
 * The FIGURES are not. Every quantity below is a claim about the brokerage —
 * a $10 minimum, 1:100 leverage, a 24-hour window — and ADR-113 §3's reason
 * for keeping them out of a translator's hands still holds, so they stay here
 * and are passed to the messages as ICU arguments. No translation, a person's
 * or a machine's, can change one: the catalog messages hold no digits at all
 * (`support-page.test.ts`), and the catalog script protects arguments.
 *
 * Plain text: `FaqPanel` renders the answers with `format="text"`.
 */
export const SUPPORT_FAQ_KEYS = [
  "openAccount",
  "minimumDeposit",
  "withdraw",
  "platforms",
  "hours",
  "education",
  "leverage",
] as const;

export type SupportFaqKey = (typeof SUPPORT_FAQ_KEYS)[number];

/** The owner's figures, by question — the only place a number in the FAQ lives. */
export const SUPPORT_FAQ_FIGURES: Record<SupportFaqKey, Record<string, string>> = {
  openAccount: { fromMinutes: "15", toMinutes: "30" },
  minimumDeposit: { fromMinutes: "15", toHours: "24", minimumDeposit: "$10" },
  withdraw: { fromMinutes: "30", toHours: "24", holidayHours: "48" },
  platforms: { platform: "MetaTrader 5 (MT5)", platformShort: "MT5" },
  hours: {
    hoursPerDay: "24",
    daysPerWeek: "5",
    opens: "5:00 PM EST",
    closes: "5:00 PM EST",
    platformTimeZone: "GMT+2",
    cryptoHours: "24/7",
  },
  education: {},
  leverage: { leverage: "1:100", position: "$10,000", margin: "$100" },
};
