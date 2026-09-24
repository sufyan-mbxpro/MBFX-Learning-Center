import type { Metadata } from "next";
import { ReviewsBand } from "../_components/reviews-band.tsx";
import { jsonLd, localizedPath } from "../../../_lib/seo.ts";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Headphones,
  Mail,
  GraduationCap,
  MessageCircle,
  Phone,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCaptchaClient } from "@repo/auth";

import { learnTrackVideosPath, ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { FaqPanel } from "@repo/ui/components/faq-panel";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal, RevealGroup } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import {
  SUPPORT_CHANNELS,
  SUPPORT_CONTACT,
  SUPPORT_FAQ,
  type SupportChannel,
} from "./_content/support-facts.ts";
import { SupportBackdrop } from "./_components/support-backdrop.tsx";
import { SupportForm } from "./_components/support-form.tsx";

// `/support` (Module 12, ADR-113) — the owner's published support page,
// rebuilt on this design system.
//
// ADR-109 kept one page when the About section was withdrawn and gave it the
// reference's SHAPE with its own words. What that shipped was a page whose
// "Ways to reach us" list was gated on a collection that was empty, so the
// one page a reader arrives at with a question offered no way to ask it.
// ADR-113 replaces the words with the owner's and the empty list with three
// working channels and a form.
//
// **Five bands, in the reference's order**, and the order is the argument:
// the channels come first because a reader who already knows what they want
// should not scroll past seven FAQ items to find a phone number; the FAQ
// comes next because it is cheaper for both sides than a message; the form is
// the fallback it is labelled as ("Still Need Help?"); and the four other
// places an answer might already be waiting come last.
//
// **Every band is still data-gated** the way ADR-047 §2 requires, which is
// what stops this page ever looking broken again:
//
//   - no `SUPPORT_CHANNELS` ⇒ no channel band;
//   - no `site.supportEmail` (Settings → General, ADR-131) ⇒ no Email Support
//     card AND no form, because both of them are that one address;
//   - no `SUPPORT_FAQ` ⇒ `FaqPanel` renders nothing on its own;
//   - a "More ways to get help" card whose section is flagged off renders as
//     a plain card rather than a link to a 404 (changes-11 D25's rule).

/** ADR-048's split: a lucide component per channel kind, resolved in the app. */
const CHANNEL_ICONS: Record<SupportChannel["kind"], typeof Mail> = {
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
};

/**
 * The "More ways to get help" band.
 *
 * The reference renders all four as dead `<button>`s under a "Coming Soon"
 * heading. Ours are four places an answer is already waiting, which is why
 * the heading no longer says otherwise (changes-36, the owner's own ask):
 * three of the four LINKED, and the fourth — a community forum this site does
 * not have and is not building — was the only thing the heading was true of.
 *
 * It is replaced by COURSES, which is the destination a reader who could not
 * find their answer here actually wants, and which is also what a forum was
 * standing in for: somewhere to go and learn the thing rather than ask about
 * it. A band of four cards where every card leads somewhere is worth more
 * than a band of four where one is a promise.
 *
 * The LINK-or-static rule stays, and it is what keeps the band honest in both
 * directions: nothing promises a page that does not exist, and nothing hides
 * a page that does. `feature` is checked against an anonymous subject, so a
 * flag that is off makes the card static rather than absent — the reader is
 * told the thing exists and is not offered a 404.
 */
const MORE_HELP = [
  {
    key: "helpCenter",
    icon: BookOpen,
    feature: "glossary",
    href: ROUTE_PATHS.glossary,
  },
  { key: "courses", icon: GraduationCap, feature: "courses", href: ROUTE_PATHS.learn },
  {
    key: "videos",
    icon: Headphones,
    feature: "videos",
    // The forex school's library. A track is part of the address (ADR-065), so
    // a cross-track "all videos" URL does not exist to link to, and the
    // default school is the honest choice over inventing one.
    href: learnTrackVideosPath("forex"),
  },
  { key: "phone", icon: Phone, feature: null, href: `tel:${SUPPORT_CONTACT.phone}` },
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/support">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "support" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("meta.title")),
    description: t("meta.description"),
    alternates: { canonical: localizedPath(locale, ROUTE_PATHS.support) },
    // No `robots` key at all — a present one replaces the root layout's
    // site-wide directive rather than inheriting it (code-style.md #26).
  };
}

export default async function SupportPage({ params }: PageProps<"/[locale]/support">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, supportEmailSetting, visibility, captcha] = await Promise.all([
    getTranslations({ locale, namespace: "support" }),
    // The one inbox both the Email Support card and the form use (ADR-131).
    // Public on purpose — the card prints it — so security.md #12 holds.
    getSetting("site.supportEmail"),
    Promise.all(
      MORE_HELP.map((entry) => (entry.feature ? isFeatureVisible(entry.feature, null) : true)),
    ),
    // ADR-156: cached and tagged, so this static page carries the key.
    getCaptchaClient(),
  ]);
  const supportEmail = supportEmailSetting ?? "";

  // The compose window opens ADDRESSED and with a subject line already in it,
  // so "Send Email" leaves the reader one thing to type: their question.
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent(
    t("channels.email.mailSubject"),
  )}`;

  // An email channel with no address behind it opens `mailto:` — a blank
  // compose window addressed to nobody — so it is dropped instead.
  const channels = SUPPORT_CHANNELS.filter(
    (channel) => channel.kind !== "email" || supportEmail !== "",
  ).map((channel) => ({ ...channel, href: channel.href ?? mailtoHref }));

  return (
    <main className="flex flex-col">
      <PageHero
        backdrop={<SupportBackdrop slot="supportHero" />}
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        align="center"
        title={t("hero.title")}
        lead={t("hero.body")}
      />

      {/* ── How Can We Help? ──────────────────────────────────────── */}
      {channels.length > 0 && (
        <Section spacing="lg" tone="muted">
          <Container className="flex flex-col gap-10">
            <Reveal variant="up">
              <SectionHeading
                align="center"
                title={t("channels.title")}
                lead={t("channels.lead")}
              />
            </Reveal>

            <RevealGroup variant="up" className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {channels.map((channel) => {
                const Icon = CHANNEL_ICONS[channel.kind];
                const external = channel.href.startsWith("http");
                return (
                  <div
                    key={channel.kind}
                    className="card-hover flex h-full flex-col items-center gap-3 rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10"
                  >
                    <span className="flex size-16 items-center justify-center rounded-xl bg-primary/10 text-primary-interactive">
                      <Icon aria-hidden className="size-8" />
                    </span>
                    <h3 className="text-xl font-semibold text-foreground">
                      {t(`channels.${channel.kind}.title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(`channels.${channel.kind}.description`)}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock aria-hidden className="size-4" />
                      {channel.availability}
                    </p>
                    {/*
                      A plain anchor, not `Link`: `mailto:`, `tel:` and an
                      off-site `https://` are not routes, and next-intl's Link
                      would locale-prefix the last of them. `rel` is on the
                      one that opens a new tab — `noopener` is what stops the
                      opened page reaching back through `window.opener`.

                      `role="link"` is not redundant, it is a REPAIR. `Button`
                      passes `nativeButton={false}` whenever `render` is given
                      (so Base UI keeps the element it was handed), and Base UI
                      then stamps `role="button"` on it. On the rest of the
                      site that is a cosmetic inaccuracy; here all three of
                      these leave — to WhatsApp, to a mail client, to the
                      dialler — and announcing "button" tells a screen-reader
                      user the one thing that is not true about them. Fixing it
                      inside `Button` would change every `render={<Link/>}` call
                      site on the public surface, which is its own change.
                    */}
                    <Button
                      variant="outline"
                      className="mt-3 w-full"
                      role="link"
                      render={
                        <a
                          href={channel.href}
                          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        />
                      }
                    >
                      {t(`channels.${channel.kind}.action`)}
                    </Button>
                  </div>
                );
              })}
            </RevealGroup>
          </Container>
        </Section>
      )}

      {/* ── Frequently Asked Questions ────────────────────────────────
          `format="text"` — these are plain strings from the facts file, not
          editor HTML, so nothing here needs sanitising. `FaqPanel` renders
          nothing at all when the list is empty. */}
      <Section spacing="lg">
        {/* `FAQPage` for the same list the panel draws, and only when it
            draws one — markup for questions a reader cannot see is the
            pattern search engines penalise. */}
        {SUPPORT_FAQ.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: SUPPORT_FAQ.map((item) => ({
                  "@type": "Question",
                  name: item.question,
                  acceptedAnswer: { "@type": "Answer", text: item.answer },
                })),
              }),
            }}
          />
        )}
        <Container size="narrow">
          <FaqPanel title={t("faq.title")} lead={t("faq.lead")} items={SUPPORT_FAQ} format="text" />
        </Container>
      </Section>

      {/* ── Still Need Help? ──────────────────────────────────────────
          Absent, not disabled, when there is no inbox to send to: a form that
          accepts a message and drops it is worse than no form. */}
      {supportEmail !== "" && (
        <Section spacing="lg" tone="muted">
          <Container size="narrow" className="flex flex-col gap-10">
            <Reveal variant="up">
              <SectionHeading align="center" title={t("contact.title")} lead={t("contact.lead")} />
            </Reveal>
            <Reveal variant="up" delay={80}>
              <SupportForm
                locale={locale}
                captcha={captcha}
                labels={{
                  nameLabel: t("contact.nameLabel"),
                  namePlaceholder: t("contact.namePlaceholder"),
                  emailLabel: t("contact.emailLabel"),
                  emailPlaceholder: t("contact.emailPlaceholder"),
                  subjectLabel: t("contact.subjectLabel"),
                  subjectPlaceholder: t("contact.subjectPlaceholder"),
                  messageLabel: t("contact.messageLabel"),
                  messagePlaceholder: t("contact.messagePlaceholder"),
                  submit: t("contact.submit"),
                  pending: t("contact.pending"),
                  sentTitle: t("contact.sentTitle"),
                  sent: t("contact.sent"),
                  errorTitle: t("contact.errorTitle"),
                  signedInHint: t("contact.signedInHint"),
                  invalid: t("contact.invalid"),
                  limited: t("contact.limited"),
                  captcha: t("contact.captcha"),
                  captchaRequired: t("contact.captchaRequired"),
                  failed: t("contact.failed"),
                }}
              />
            </Reveal>
          </Container>
        </Section>
      )}

      {/* ── Coming Soon ───────────────────────────────────────────── */}
      <Section spacing="lg">
        <Container className="flex flex-col gap-10">
          <Reveal variant="up">
            <SectionHeading align="center" title={t("moreHelp.title")} lead={t("moreHelp.lead")} />
          </Reveal>

          <RevealGroup
            variant="up"
            className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
          >
            {MORE_HELP.map((entry, index) => {
              const Icon = entry.icon;
              const href = visibility[index] ? entry.href : null;
              const action =
                entry.key === "phone"
                  ? t("moreHelp.phone.action", { phone: SUPPORT_CONTACT.phoneDisplay })
                  : t(`moreHelp.${entry.key}.action`);

              return (
                <div key={entry.key} className="flex flex-col items-center gap-2 text-center">
                  {/* `rounded-full` is right here: the geometry IS a circle
                      (ADR-107), unlike a row of text with padding. */}
                  <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary-interactive">
                    <Icon aria-hidden className="size-8" />
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">
                    {t(`moreHelp.${entry.key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`moreHelp.${entry.key}.description`)}
                  </p>

                  {href === null ? (
                    // No destination — every entry has one, so this is the
                    // flag-off case alone. The label still renders, in muted
                    // ink and with no arrow, so the card names the thing
                    // without looking like something that can be pressed.
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{action}</p>
                  ) : href.startsWith("tel:") ? (
                    <a
                      href={href}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-interactive hover:underline"
                    >
                      {action}
                      <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-interactive hover:underline"
                    >
                      {action}
                      <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                    </Link>
                  )}
                </div>
              );
            })}
          </RevealGroup>
        </Container>
      </Section>
      {/* changes-41 (ADR-135): after a reader has found their answer. */}
      <ReviewsBand tone="muted" />
    </main>
  );
}
