import { Check } from "lucide-react";

import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { SectionTitle } from "@repo/ui/components/typography";
import { cn } from "@repo/ui/lib/utils";

// The article page's "Key takeaways" block (changes-29 B4).
//
// It lives here rather than in `apps/web` so the app COMPOSES it rather than
// styling it — and because it must render identically whether the list was
// typed by an editor or filled by AI. That identity is the proof of ADR-097's
// "every field AI fills is a field a human can fill": there is no AI-shaped
// variant, no badge, and nothing on this block knows where the words came from.
//
// **Renders nothing when the list is empty.** An empty card with a heading is
// a promise the page did not keep.
export function KeyTakeaways({
  heading,
  items,
  className,
}: {
  heading: string;
  items: readonly string[];
  className?: string;
}) {
  const takeaways = items.filter((item) => item.trim().length > 0);
  if (takeaways.length === 0) return null;

  return (
    <Card className={cn("bg-muted/40", className)}>
      <CardHeader>
        <SectionTitle>{heading}</SectionTitle>
      </CardHeader>
      <CardContent>
        {/* A real list, so a screen reader announces "list, 4 items" — the
            count is half the value of a takeaways block. */}
        <ul className="flex flex-col gap-2">
          {takeaways.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-interactive" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
