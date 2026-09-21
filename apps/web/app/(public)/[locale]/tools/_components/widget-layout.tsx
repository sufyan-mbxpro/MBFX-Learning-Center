import { cn } from "@repo/ui/lib/utils";
import { Card, CardContent } from "@repo/ui/components/card";

// The widget band's shape, in one place (changes-25 T6, ADR-114 #2).
//
// The reference puts inputs on one side and results on the other, and every
// one of its eight pages does it the same way. Holding that here rather than
// in eight islands is the same call `tool-shell.tsx` makes one level up: eight
// widgets that each lay themselves out become eight layouts within a year.
//
// **It splits on its OWN width, not the viewport's** (ADR-114 #2).
// `lg:grid-cols-2` was right while the widget was the page's full measure and
// became wrong the moment the explainer moved beside it: at 1024px the inputs
// column would be about 290px, which does not hold a currency combobox next to
// a result panel. "Do two columns fit here" is a question about this element,
// and the viewport only ever answered it by coincidence —
// `news/_components/article-list.tsx` is this app's precedent for saying so.
//
// `grid-cols-1` states the one-column base explicitly (code-style.md #23) —
// the bare form is one implicit `auto` track that sizes to its content's
// min-content width, which on a phone is how a page starts scrolling
// sideways.
export function WidgetLayout({
  inputs,
  results,
  /** A full-width band under both columns — a timeline, a table, a matrix. */
  wide,
}: {
  inputs: React.ReactNode;
  results: React.ReactNode;
  wide?: React.ReactNode;
}) {
  return (
    <Card className="@container/widget">
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 @2xl/widget:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">{inputs}</div>
          <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-muted/40 p-5">{results}</div>
        </div>
        {wide}
      </CardContent>
    </Card>
  );
}

/**
 * One figure in the results column.
 *
 * `tabular-nums` on every value: a column of results that re-flows as its
 * digits change is the one thing that makes a calculator feel broken while
 * being entirely correct.
 */
export function ResultRow({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  /** A plain-English line under the figure, when the figure needs one. */
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "text-2xl font-semibold text-foreground" : "text-lg font-medium",
        )}
      >
        {value}
      </span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}
