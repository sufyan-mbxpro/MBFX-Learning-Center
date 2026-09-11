// The counted-figures band under a section masthead — learn, quizzes, videos
// and the glossary. Each masthead still decides WHICH figures it shows (their
// headers explain why they stay separate components); this owns only how the
// figures sit, so a layout fix lands once rather than four times.
//
// Always one row. A stacked strip spent ~370px of a 390px phone on three
// numbers; at 14px labels (ADR-072 §7) three columns still fit, and a long
// label wraps inside its column instead. `grid-flow-col auto-cols-fr` sizes
// the row to the items actually rendered, so a strip that drops a zero figure
// narrows to two equal columns rather than leaving an empty third.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { StatCard } from "@repo/ui/components/stat-card";

export function StatStrip({
  tone,
  children,
}: {
  tone?: React.ComponentProps<typeof Section>["tone"];
  children: React.ReactNode;
}) {
  return (
    <Section spacing="sm" tone={tone}>
      <Container>
        {/* StatCard's ink is --foreground/--muted-foreground, both derived
            against --background — which is why this strip is its own band
            under the hero rather than a row inside the brand fill, where
            neither would be contrast-checked (ADR-018 #5). */}
        <div className="grid auto-cols-fr grid-flow-col divide-x divide-border">{children}</div>
      </Container>
    </Section>
  );
}

/** StatCard plus the glyph above it — the count-up itself is StatCard's. */
export function StatStripItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    // The inline padding keeps a wrapped label off the dividers.
    <div className="flex flex-col items-center gap-2 px-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-interactive">
        {icon}
      </span>
      <StatCard value={value} label={label} />
    </div>
  );
}
