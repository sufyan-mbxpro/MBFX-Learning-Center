// Risk disclaimer (changes-03-plan.md §6.2). Content is the admin-editable
// legal.riskDisclaimer setting — never catalog copy, because it is a legal
// statement the operator owns, not interface furniture.
import { getSetting } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

export async function RiskDisclaimer() {
  const disclaimer = await getSetting("legal.riskDisclaimer");
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
