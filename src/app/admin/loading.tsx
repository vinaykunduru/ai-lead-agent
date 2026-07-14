import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { CardGridSkeleton } from "@/shared/components/card-grid-skeleton";

export default function AdminOverviewLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={5} gridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
    </div>
  );
}
