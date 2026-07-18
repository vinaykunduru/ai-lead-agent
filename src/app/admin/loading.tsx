import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { CardGridSkeleton } from "@/shared/components/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminOverviewLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-8 p-6">
        <div>
          <Skeleton className="mb-3 h-6 w-20" />
          <CardGridSkeleton
            count={5}
            padded={false}
            gridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          />
        </div>
        <div>
          <Skeleton className="mb-3 h-6 w-32" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
