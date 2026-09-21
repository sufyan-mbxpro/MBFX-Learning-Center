// The home facts band (changes-31, ADR-103).
//
// The reference puts four figures under its hero in a hairline-divided grid.
// ADR-076 banned a counted-figures strip from public pages, and this is NOT
// that strip: every number here is an owner-supplied FACT from
// `_content/home-facts.ts` — a claim the business makes and vouches for —
// never a total this code counted out of the database.
//
// The distinction is the whole reason this band is allowed to exist, so it is
// enforced rather than asserted: this file reads no service, takes no `limit`,
// and `home-bands.test.ts` fails if it ever imports one.
//
// ADR-103 §3: an empty dataset renders NOTHING — no heading, no empty grid, no
// zeroes. A zero is a claim about the data.
//
// changes-38: no caption. "Figures supplied by MBX Learning Center" came off
// at the owner's ask; the provenance rule above is unchanged, it just no
// longer prints.
import { getTranslations } from "next-intl/server";
import { BookOpen, Clock, Languages, Users } from "lucide-react";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { StatBand } from "@repo/ui/components/stat-band";
import { StatCard } from "@repo/ui/components/stat-card";
import { HOME_FACTS } from "../_content/home-facts.ts";
import type { SectionProps } from "./registry.ts";

/**
 * A glyph per fact key. A key with no entry simply renders without one —
 * `StatCard`'s icon is optional, so an owner adding a fifth fact gets a
 * complete band rather than a crash or a placeholder square.
 */
const FACT_ICON: Record<string, React.ReactNode> = {
  learners: <Users aria-hidden />,
  lessons: <BookOpen aria-hidden />,
  languages: <Languages aria-hidden />,
  years: <Clock aria-hidden />,
};

export async function Facts({ locale }: SectionProps) {
  const { facts } = HOME_FACTS;
  if (facts.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <Section tone="muted" spacing="md">
      <Container>
        <Reveal variant="up">
          <StatBand
            // Four, not three: the reference's grid, and what
            // `StatBand columns` was added for.
            columns={4}
            className="rounded-xl border bg-card p-8 sm:p-10"
          >
            {facts.map((fact) => (
              <StatCard
                key={fact.key}
                icon={FACT_ICON[fact.key]}
                value={fact.value}
                prefix={fact.prefix}
                suffix={fact.suffix}
                label={t(fact.labelKey)}
              />
            ))}
          </StatBand>
        </Reveal>
      </Container>
    </Section>
  );
}
