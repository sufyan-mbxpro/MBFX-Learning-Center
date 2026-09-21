import type { LucideIcon } from "lucide-react";

// A glyph at the start of a credential field (the split auth screens). The
// input it wraps takes `ps-10` so its text clears the glyph; the glyph is
// decorative because the field's label already names it.
export function AuthInputIcon({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <Icon
        aria-hidden
        className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
