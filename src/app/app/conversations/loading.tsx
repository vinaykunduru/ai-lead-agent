import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { TableSkeleton } from "@/shared/components/table-skeleton";

export default function ConversationsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="p-6">
        <TableSkeleton columns={4} />
      </div>
    </div>
  );
}
