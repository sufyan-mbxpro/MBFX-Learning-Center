// /about/security — the reference's "Strength & Security", rebuilt around
// claims this codebase can actually back (ADR-047).
//
// Every statement on this page was checked against the code before it was
// written, and each one is a specific, falsifiable mechanism rather than a
// reassurance:
//
//   Argon2id            packages/auth/src/index.ts (@node-rs/argon2)
//   DB-backed sessions  packages/auth/src/index.ts, security.md #11
//   backoff, no lock    packages/auth/src/index.ts (LOCKOUT_THRESHOLD, lockedUntil)
//   audit rows          packages/core/src/index.ts (recordAudit)
//   server sanitising   packages/core/src/sanitize-tiptap.ts
//   magic-byte uploads  packages/core/src/media.ts (sniffImageType)
//   CSP, stricter admin apps/web/proxy.ts (baseCsp, per-surface)
//   server permissions  security.md #1, requirePermission()
//
// If one of those mechanisms is ever removed, the corresponding catalog
// string has to go with it. That is the maintenance cost of a page like
// this, and it is the reason it is worth having.
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { CheckList } from "@repo/ui/components/check-list";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { HotspotMap } from "@repo/ui/components/hotspot-map";
import { PageHero } from "@repo/ui/components/page-hero";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { SplitCallout } from "@repo/ui/components/split-callout";
import { AboutArt, AboutBackdrop, AboutWorldMap } from "../_components/about-art.tsx";
import { HeroActions } from "../_components/hero-actions.tsx";
import { ABOUT_FACTS } from "../_content/about-facts.ts";

const ACCOUNT = ["argon", "sessions", "backoff", "cookies"] as const;
const DATA = ["minimal", "nonPublic", "audit"] as const;
const PLATFORM = ["sanitised", "uploads", "csp", "permissions"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about/security">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("meta.securityTitle")),
    description: t("meta.securityDescription"),
  };
}

export default async function SecurityPage({ params }: PageProps<"/[locale]/about/security">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <>
      <PageHero
        backdrop={<AboutBackdrop slot="securityHero" />}
        eyebrow={t("security.hero.eyebrow")}
        title={t("security.hero.title")}
        lead={t("security.hero.body")}
        actions={
          <HeroActions
            primary={{ label: t("security.hero.primaryCta"), href: ROUTE_PATHS["about-support"] }}
          />
        }
      />

      <Section spacing="lg">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-16">
          <Reveal variant="up">
            <SectionHeading
              eyebrow={t("security.account.eyebrow")}
              title={t("security.account.title")}
              lead={t("security.account.lead")}
            />
          </Reveal>
          <Reveal variant="up" delay={80}>
            <CheckList items={ACCOUNT.map((key) => t(`security.account.${key}`))} />
          </Reveal>
        </Container>
      </Section>

      <Section spacing="lg" tone="muted">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-16">
          <Reveal variant="up">
            <SectionHeading eyebrow={t("security.data.eyebrow")} title={t("security.data.title")} />
          </Reveal>
          <Reveal variant="up" delay={80}>
            <CheckList items={DATA.map((key) => t(`security.data.${key}`))} />
          </Reveal>
        </Container>
      </Section>

      <SplitCallout
        title={t("security.platform.title")}
        reverse
        spacing="lg"
        media={<AboutArt slot="securityTrust" />}
      >
        <p>{t("security.platform.body")}</p>
        <CheckList items={PLATFORM.map((key) => t(`security.platform.${key}`))} />
      </SplitCallout>

      {/* Data-gated (ADR-047 §2): with no jurisdictions recorded there is no
          map, no legend and no heading — an empty world map claiming
          nothing is worse than no map at all. */}
      {ABOUT_FACTS.jurisdictions.length > 0 && (
        <Section spacing="lg" tone="muted">
          <Container className="flex flex-col gap-10">
            <Reveal variant="up">
              <SectionHeading
                title={t("security.jurisdictions.title")}
                lead={t("security.jurisdictions.lead")}
              />
            </Reveal>
            <HotspotMap
              mapSlot={<AboutWorldMap />}
              legendLabel={t("security.jurisdictions.legend")}
              points={ABOUT_FACTS.jurisdictions.map((jurisdiction) => ({
                id: jurisdiction.code,
                label: t(jurisdiction.nameKey),
                detail: jurisdiction.bodies.join(" · "),
                x: jurisdiction.x,
                y: jurisdiction.y,
              }))}
            />
          </Container>
        </Section>
      )}

      <Section spacing="md">
        <Container>
          <CtaBand title={t("security.cta.title")} description={t("security.cta.description")}>
            <Button
              size="lg"
              shape="pill"
              variant="secondary"
              render={<Link href={ROUTE_PATHS["about-support"]} />}
            >
              {t("security.cta.action")}
            </Button>
          </CtaBand>
        </Container>
      </Section>
    </>
  );
}
