// "Follow us" — the connect band (changes-28 PR 4, ADR-093).
//
// The brief's image 51: a full-bleed dark band, a large promise on the inline
// start, a CONNECT row of social tiles under it, a pill CTA, and a video panel
// on the inline end.
//
// ─── What is copied from the reference, and what is not ───────────────────
//
// The reference's right-hand panel is an embedded livestream, and its button
// reads "view all interactive livestreams". This site has no livestreams —
// changes-23 is unbuilt — so neither is reproduced. Copying them would put a
// promise on the homepage that every click disproves, which is the failure
// ADR-047 §3 exists to prevent and the same reason `explore-destinations.ts`
// refuses to link a route that does not render.
//
// For one release the newest published video topic stood in that slot. It has
// MOVED (changes-35, ADR-116 §5): `in_practice` carries the page's one
// featured video now, and two different "featured" videos on a page is the
// page arguing with itself. The `next/dynamic` boundary went with the tile.
//
// ─── The subscribe band merged into this one (owner, 2026-09-16) ──────────
//
// Taking the video out left the whole inline end of this band empty, and the
// newsletter was a separate brand-coloured strip directly under it — two bands
// making the same ask ("keep hearing from us") in two different colours, one
// of them half empty. They are ONE band now: follow us on the start, subscribe
// on the end.
//
// **The two newsletter switches are unchanged** (ADR-080 #5). The `newsletter`
// FLAG still says signup exists and `newsletter.placements.home` still says it
// is drawn here; the form still submits `source="home"`, so an admin filtering
// subscribers by where an address came from sees exactly what they saw before.
// What changed is which element the column is nested in.
//
// **Either half can be absent, and the band survives one of them.** No active
// social link and the follow column is gone; the flag or the placement off and
// the subscribe column is gone; both and the band does not render. That is
// ADR-116 §3's per-dataset rule, which this band now needs because it has two
// datasets.
//
// **The social row is data.** `SocialLink` rows, `isActive`, in the admin's
// own `sortOrder` — the same rows the footer draws. The band renders nothing
// at all when none is active: a "follow us" heading over an empty row invites
// a visitor to follow nobody.
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { ROUTE_PATHS } from "@repo/contracts";
import { getActiveSocialLinks, isNewsletterPlacementEnabled } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { cn } from "@repo/ui/lib/utils";

import { NewsletterForm } from "../_components/newsletter-form.tsx";
import { newsletterFormLabels } from "../_components/newsletter-labels.ts";
import { SocialLinkIcon } from "../_components/social-link-icon.tsx";
import { SIGNED_OUT_ONLY_CLASS } from "../../../_lib/session-hint.ts";
import type { SectionProps } from "./registry.ts";

export async function Connect({ locale }: SectionProps) {
  const [t, tFooter, socialLinks, newsletterEnabled, newsletterPlaced] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "footer" }),
    getActiveSocialLinks(),
    isFeatureVisible("newsletter", null),
    isNewsletterPlacementEnabled("home"),
  ]);

  const showFollow = socialLinks.length > 0;
  const showSubscribe = newsletterEnabled && newsletterPlaced;
  if (!showFollow && !showSubscribe) return null;

  return (
    // ADR-124: the subscribe half is hidden for a signed-in reader before
    // first paint. With no follow half to keep, that is the whole band.
    <Section tone="inverted" spacing="lg" className={cn(!showFollow && SIGNED_OUT_ONLY_CLASS)}>
      {/* changes-31 / ADR-101 §6: the ambient wash and dot grid are gone.
          Bands separate by TONE down the page now — a muted band, an inverted
          band, the default ground — which is how the reference does it, and
          four bands each painting their own glow was four arguments against a
          design whose whole case is restraint. The utilities stay in
          globals.css for the surfaces that still use them. */}

      <Container>
        {/* Two columns when both halves have content, one when only one does —
            the band closes up rather than leaving the empty half the video's
            removal left behind. `grid-cols-1` stated, not implied: the bare
            form is one implicit `auto` track that sizes to its items'
            min-content, which is what makes a phone scroll sideways
            (code-style.md #23). */}
        <div
          className={cn(
            "grid grid-cols-1 items-center gap-10",
            showFollow && showSubscribe && "lg:grid-cols-(--grid-3-2) lg:gap-16",
          )}
        >
          {showFollow && (
            <Reveal variant="start" className="flex flex-col items-start gap-6">
              {/*
              Hand-written rather than `SectionHeading`, for the reason the
              video rail records at length: that component's eyebrow and lead
              are coloured for `--background`, not for the `--secondary` band
              this section paints. Opacities of `--secondary-foreground` are
              readable on `--secondary` by construction (ADR-003).
            */}
              <h2 className="max-w-xl font-display text-display-sm font-bold text-balance text-secondary-foreground">
                {t("connectTitle")}
              </h2>
              <p className="max-w-xl text-lg text-pretty text-secondary-foreground/75">
                {t("connectLead")}
              </p>

              <div className="flex flex-col gap-3">
                <p
                  id="home-connect-label"
                  className="text-xs font-semibold tracking-caps text-secondary-foreground/70 uppercase"
                >
                  {t("connectEyebrow")}
                </p>
                {/* `aria-labelledby`, not a duplicate `aria-label`: the visible
                  word above IS the list's name, and naming it twice is how a
                  screen reader ends up announcing "Connect, Connect". */}
                <ul
                  aria-labelledby="home-connect-label"
                  className="flex flex-wrap items-center gap-3"
                >
                  {socialLinks.map((link) => (
                    <li key={link.platform}>
                      <a
                        href={link.url}
                        aria-label={link.label}
                        // The one brand FILL on this band: --primary with its own
                        // paired --primary-foreground ink, which IS contrast-
                        // guaranteed (readableOn in @repo/theme). ADR-018 rule 5
                        // permits exactly this. Same treatment as the footer's
                        // row, one size up because this one is the point of the
                        // band rather than a detail in its margin.
                        className="flex size-12 items-center justify-center rounded-lg bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/15 transition duration-(--duration-base) ease-(--ease-out-quint) ring-inset hover:-translate-y-0.5 hover:scale-105 hover:bg-primary hover:text-primary-foreground hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:bg-primary focus-visible:text-primary-foreground"
                        {...(link.openInNewTab
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        <SocialLinkIcon icon={link.icon} iconUrl={link.iconUrl} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* The reference's "view all interactive livestreams" pill, aimed
                at something that exists. `/analysis` is what the heading above
                actually promises. */}
              <Button
                variant="ghost"
                className="bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/20 ring-inset hover:bg-secondary-foreground/20 hover:text-secondary-foreground"
                render={<Link href={ROUTE_PATHS.analysis} />}
              >
                {t("connectCta")}
                <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
              </Button>
            </Reveal>
          )}

          {/* The subscribe half. It was its own brand-fill band directly under
              this one until the owner asked for them merged; what moved is the
              placement, not either switch (see the header). */}
          {showSubscribe && (
            <Reveal
              variant="end"
              className={cn(
                SIGNED_OUT_ONLY_CLASS,
                "flex flex-col gap-4 rounded-xl bg-secondary-foreground/5 p-6 ring-1 ring-secondary-foreground/10 ring-inset sm:p-8",
              )}
            >
              {/* Hand-written for the same reason the heading above is:
                  `SectionHeading` and `CtaBand` both colour themselves for
                  `--background`, and this band paints `--secondary`. */}
              <h3 className="font-display text-2xl font-bold text-balance text-secondary-foreground">
                {t("newsletterTitle")}
              </h3>
              <p className="text-pretty text-secondary-foreground/75">{t("newsletterBody")}</p>
              {/* `onSecondary`, which is the tone the form already carries for
                  exactly this surface — `onFill` is for the brand-filled
                  `CtaBand` this half used to be. */}
              <NewsletterForm
                tone="onSecondary"
                locale={locale}
                source="home"
                labels={newsletterFormLabels(tFooter)}
              />
            </Reveal>
          )}

          {/* Signed in, the subscribe half is hidden (ADR-124) and a still
              picture holds its track instead (changes-39, owner) — the band
              keeps its two-column shape rather than stretching the follow
              half across the row. Wide screens only: stacked under the follow
              half on a phone it would only make the band taller. Decorative,
              so `alt=""`: the heading beside it already says what the band
              is. */}
          {showFollow && showSubscribe && (
            <div
              // SIGNED_OUT_ONLY_CLASS's inverse, keyed on the same pre-paint
              // `data-session` hint, and folded with the breakpoint into ONE
              // display utility so no two variants race to set `display`.
              className="relative hidden aspect-4/3 overflow-hidden rounded-xl ring-1 ring-secondary-foreground/10 ring-inset lg:in-data-[session=learner]:block"
            >
              <Image
                src="/banners/spare-forex.webp"
                alt=""
                fill
                sizes="(max-width: 1024px) 0px, 40vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
