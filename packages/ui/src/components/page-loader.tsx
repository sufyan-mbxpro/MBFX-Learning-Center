// Full-page pending state (route-level loading.tsx) and its section-sized
// sibling. Label is a required prop — @repo/ui carries no message catalogs.
import { cn } from "@repo/ui/lib/utils";
import { Spinner } from "@repo/ui/components/spinner";

function PageLoader({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 text-muted-foreground",
        className,
      )}
    >
      <Spinner aria-hidden className="size-6" />
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
        "flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border bg-card p-5 text-muted-foreground",
        className,
      )}
    >
      <Spinner aria-hidden className="size-5" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export { PageLoader, SectionLoader };
