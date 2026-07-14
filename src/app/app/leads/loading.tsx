import { PageHeaderSkeleton } from "@/shared/components/page-header-skeleton";
import { CardGridSkeleton } from "@/shared/components/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LeadsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-6 p-6">
        <CardGridSkeleton
          count={9}
          variant="compact"
          padded={false}
          gridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        />
        <div className="flex flex-col gap-2 sm:flex-row" aria-hidden="true">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, colIndex) => (
            <Card key={colIndex} className="w-72 shrink-0" size="sm">
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: 3 }).map((_, cardIndex) => (
                  <Skeleton key={cardIndex} className="h-16 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
