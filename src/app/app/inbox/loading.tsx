import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { TableSkeleton } from "@/shared/components/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <nav className="flex gap-1 overflow-x-auto border-b px-6 py-2" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-md" />
        ))}
      </nav>
      <div className="p-6">
        <TableSkeleton columns={5} />
      </div>
    </div>
  );
}
