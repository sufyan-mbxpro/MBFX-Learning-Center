// Route-segment loading skeletons (server-safe). Shapes match the two
// admin page archetypes so navigation keeps the layout stable instead of
// blanking to a centered spinner.
import { Skeleton } from "@repo/ui/components/skeleton";

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex w-full flex-col gap-6" aria-busy>
      <PageHeaderSkeleton />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="ms-auto h-8 w-24" />
      </div>
      <div className="flex flex-col gap-3 rounded-md border p-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}

export function FormPageSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="flex w-full flex-col gap-6" aria-busy>
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-5 rounded-lg border bg-card p-5 xl:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
