import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function KnowledgeBaseLoading() {
  return (
    <div>
      <PageHeaderSkeleton withActions />
      <div className="flex flex-col gap-6 p-6 md:flex-row">
        <aside className="w-full shrink-0 rounded-xl border bg-card p-3 shadow-card md:w-60" aria-hidden="true">
          <Skeleton className="mb-3 h-3 w-20" />
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <TableSkeleton columns={7} />
        </div>
      </div>
    </div>
  );
}
