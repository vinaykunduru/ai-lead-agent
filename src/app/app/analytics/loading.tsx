import { CardGridSkeleton } from "@/shared/components/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// No PageHeaderSkeleton here: the header + sub-nav live in this segment's
// layout.tsx, which stays mounted — only this page's own content suspends.
export default function AnalyticsOverviewLoading() {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <CardGridSkeleton
          count={10}
          variant="compact"
          padded={false}
          gridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        />
      </div>
    </div>
  );
}
