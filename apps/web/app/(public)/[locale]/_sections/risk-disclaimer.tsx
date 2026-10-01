// Risk disclaimer (changes-03-plan.md §6.2). Content is the admin-editable
// legal.riskDisclaimer setting — never catalog copy, because it is a legal
// statement the operator owns, not interface furniture.
import { getLocalizedSetting } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import type { SectionProps } from "./registry.ts";

export async function RiskDisclaimer({ locale }: SectionProps) {
  // A person's translation or the English — never a machine's (ADR-165 #6).
  const disclaimer = await getLocalizedSetting("legal.riskDisclaimer", locale);
  if (!disclaimer) return null;

  return (
    <Section spacing="sm" tone="muted">
      <Container>
        <Reveal variant="fade">
          <p className="rounded-lg border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            {disclaimer}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
