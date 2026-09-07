// The four data-gated sections of /about: key figures, history, awards and
// payment methods (ADR-047 §2).
//
// They live in one file because they are one idea expressed four times —
// each reads a collection from ABOUT_FACTS and renders NOTHING when it is
// empty. Splitting them into four near-identical files would hide that.
// While the facts module is unfilled, none of them appear on the page and
// the page is correct. ADR-051 supplies a placeholder dataset that fills all
// four; the guards below are unchanged and still what runs in "real" mode.
import { getTranslations } from "next-intl/server";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { StatBand } from "@repo/ui/components/stat-band";
import { StatCard } from "@repo/ui/components/stat-card";
import { Timeline, type TimelineItem } from "@repo/ui/components/timeline";
import { AwardCard } from "@repo/ui/components/award-card";
import { AwardGrid } from "@repo/ui/components/award-grid";
import { ABOUT_FACTS } from "../_content/about-facts.ts";

export async function KeyFigures({ locale }: { locale: string }) {
  if (ABOUT_FACTS.stats.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <Section spacing="md" tone="muted">
      <Container>
        <StatBand caption={t("overview.stats.caption")} className="reveal reveal-up">
          {ABOUT_FACTS.stats.map((stat) => (
            <StatCard
              key={stat.labelKey}
              value={stat.value}
              suffix={stat.suffix}
              label={t(stat.labelKey)}
            />
          ))}
        </StatBand>
      </Container>
    </Section>
  );
}

export async function History({ locale }: { locale: string }) {
  if (ABOUT_FACTS.timeline.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "about" });

  const items: TimelineItem[] = ABOUT_FACTS.timeline.map((entry) => ({
    id: `${entry.year}-${entry.titleKey}`,
    marker: entry.year,
    title: t(entry.titleKey),
    body: t(entry.bodyKey),
  }));

  return (
    <Section spacing="lg">
      <Container size="narrow" className="flex flex-col gap-10">
        <Reveal variant="up">
          <SectionHeading title={t("overview.timeline.title")} />
        </Reveal>
        <Timeline
          items={items}
          expandLabel={t("overview.timeline.expand")}
          collapseLabel={t("overview.timeline.collapse")}
        />
      </Container>
    </Section>
  );
}

export async function Recognition({ locale }: { locale: string }) {
  if (ABOUT_FACTS.awards.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <Section spacing="lg" tone="muted">
      <Container className="flex flex-col gap-10">
        <Reveal variant="up">
          <SectionHeading
            title={t("overview.awards.title")}
            lead={t("overview.awards.lead")}
            align="center"
            className="mx-auto"
          />
        </Reveal>
        <AwardGrid>
          {ABOUT_FACTS.awards.map((award, index) => (
            <AwardCard
              key={`${award.year}-${award.titleKey}`}
              title={t(award.titleKey)}
              issuer={award.issuer}
              year={award.year}
              // The reveal rides on the <li> itself rather than a <Reveal>
              // wrapper: a <div> between <ul> and <li> is invalid HTML, and
              // display:contents — the usual escape — cannot be transformed.
              // Same technique Timeline uses, for the same reason.
              //
              // Delay follows the COLUMN, not the index, so the stagger reads
              // as a wave across each row instead of a 12-step queue: at four
              // columns the grid fills in four beats however many awards there
              // are.
              className="reveal reveal-up"
              style={{
                animationDelay: `${(index % 4) * 70}ms`,
                transitionDelay: `${(index % 4) * 70}ms`,
              }}
            />
          ))}
        </AwardGrid>
      </Container>
    </Section>
  );
}

export async function Payments({ locale }: { locale: string }) {
  if (ABOUT_FACTS.payments.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <Section spacing="md">
      <Container className="flex flex-col items-center gap-6 text-center">
        <SectionHeading
          title={t("overview.payments.title")}
          lead={t("overview.payments.lead")}
          align="center"
        />
        {/* Method NAMES, not vendor artwork: logos are trademarks we would
            have to be licensed to display, and a name we can verify beats a
            mark we cannot. */}
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {ABOUT_FACTS.payments.map((method, index) => (
            <li
              key={method}
              className="reveal reveal-scale rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground ring-1 ring-transparent transition-[background-color,box-shadow] duration-(--duration-base) hover:bg-card hover:shadow-sm hover:ring-primary/25"
              style={{
                animationDelay: `${Math.min(index, 7) * 50}ms`,
                transitionDelay: `${Math.min(index, 7) * 50}ms`,
              }}
            >
              {method}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
