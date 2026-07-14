import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function WidgetListLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        <TableSkeleton columns={5} />
      </div>
    </div>
  );
}
