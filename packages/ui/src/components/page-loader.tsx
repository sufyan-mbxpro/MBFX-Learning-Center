// Full-page pending state (route-level loading.tsx) and its section-sized
// sibling. Label is a required prop — @repo/ui carries no message catalogs.
//
// Sizing/motion: both wrap the Spinner in `.brand-loader-zoom` (globals.css)
// — it scales in on appear and then breathes, so a pending state is
// noticeable rather than a small static glyph. Sizes are deliberately much
// larger than the 16px in-button spinner; these own the viewport/section.
import { cn } from "@repo/ui/lib/utils";
import { Spinner } from "@repo/ui/components/spinner";

function PageLoader({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-5 text-muted-foreground",
        className,
      )}
    >
      <Spinner aria-hidden className="brand-loader-zoom size-16" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function SectionLoader({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 text-muted-foreground",
        className,
      )}
    >
      <Spinner aria-hidden className="brand-loader-zoom size-10" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export { PageLoader, SectionLoader };
