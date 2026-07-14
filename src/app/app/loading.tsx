import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { CardGridSkeleton } from "@/shared/components/card-grid-skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={3} />
    </div>
  );
}
