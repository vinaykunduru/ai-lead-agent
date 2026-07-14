import { Skeleton } from "@/components/ui/skeleton";

// Mirrors PageHeader's exact dimensions (py-6 px-6, title/description sizing)
// so the real header doesn't cause a layout shift when it replaces this.
export function PageHeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className="flex flex-col gap-4 border-b px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2.5">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      {withActions ? (
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-24" />
        </div>
      ) : null}
    </div>
  );
}
