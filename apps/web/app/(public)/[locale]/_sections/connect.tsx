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
// What goes there instead is the newest published video topic: a real
// recording when one exists, the topic's own written guide when it does not,
// and NOTHING when there are no topics at all. Same reader and same arguments
// as the rail at the top of the page, so the `"use cache"` entry is shared and
// this band costs no second query.
//
// **The social row is data.** `SocialLink` rows, `isActive`, in the admin's
// own `sortOrder` — the same rows the footer draws. The band renders nothing
// at all when none is active: a "follow us" heading over an empty row invites
// a visitor to follow nobody.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { learnTrackVideosPath, ROUTE_PATHS } from "@repo/contracts";
import { getActiveSocialLinks, getFeaturedVideoTopics } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { SocialLinkIcon } from "../_components/social-link-icon.tsx";
import { VideoTile } from "../_components/video-tile.tsx";
import { videoTopicCoverUrl } from "../_content/video-covers.ts";
import type { SectionProps } from "./registry.ts";

export async function Connect({ locale }: SectionProps) {
  const [t, socialLinks, topics] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getActiveSocialLinks(),
    // One topic, and the same limit the homepage rail uses would be a second
    // cache entry for no benefit — this panel shows exactly one.
    getFeaturedVideoTopics(locale, 1),
  ]);

  if (socialLinks.length === 0) return null;

  const featured = topics[0];

  return (
    <Section tone="inverted" spacing="lg" className="relative isolate overflow-hidden">
      {/* The same two ambient layers the video rail and the footer use, so the
          three inverted bands on this site read as one surface treatment
          rather than three. Both build from `currentcolor` or a token — no
          colour is chosen here. */}
      <span aria-hidden className="bg-glow-primary pointer-events-none absolute inset-0 -z-10" />
      <span
        aria-hidden
        className="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-15 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />

      <Container>
        {/* One column until there is room for two. `grid-cols-1` stated, not
            implied: the bare form is one implicit `auto` track that sizes to
            its items' min-content, which is what makes a phone scroll
            sideways (code-style.md #23). */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal variant="up" className="flex flex-col items-start gap-6">
            {/*
              Hand-written rather than `SectionHeading`, for the reason the
              video rail records at length: that component's eyebrow and lead
              are coloured for `--background`, not for the `--secondary` band
              this section paints. Opacities of `--secondary-foreground` are
              readable on `--secondary` by construction (ADR-003).
            */}
            <h2 className="max-w-xl text-display-sm font-semibold text-balance text-secondary-foreground">
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
              <ul aria-labelledby="home-connect-label" className="flex flex-wrap items-center gap-3">
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
                      className="flex size-12 items-center justify-center rounded-2xl bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/15 transition duration-(--duration-base) ease-(--ease-out-quint) ring-inset hover:-translate-y-0.5 hover:scale-105 hover:bg-primary hover:text-primary-foreground hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:bg-primary focus-visible:text-primary-foreground"
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
              shape="pill"
              className="bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/20 ring-inset hover:bg-secondary-foreground/20 hover:text-secondary-foreground"
              render={<Link href={ROUTE_PATHS.analysis} />}
            >
              {t("connectCta")}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
          </Reveal>

          {featured && (
            <Reveal variant="end">
              <VideoTile
                embedUrl={featured.source?.kind === "embed" ? featured.source.embedUrl : null}
                poster={featured.coverUrl ?? videoTopicCoverUrl(featured.slug)}
                href={`${learnTrackVideosPath(featured.track)}/${featured.slug}`}
                title={featured.title}
                description={featured.summary}
                level={featured.categoryName}
                playLabel={t("videoPlay", { title: featured.title })}
                guideLabel={featured.source ? t("videoWatch") : t("videoGuide")}
                openLabel={t("videoOpen", { title: featured.title })}
              />
            </Reveal>
          )}
        </div>
      </Container>
    </Section>
  );
}
