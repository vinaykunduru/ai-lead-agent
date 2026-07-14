import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Mirrors the KPI-card grid layouts used across Dashboard/Platform-Admin
// (large cards, icon + big value) and Leads/Analytics (compact `size="sm"`
// stat tiles, no icon) so the real cards don't cause a layout shift when
// they replace this.
export function CardGridSkeleton({
  count = 3,
  gridClassName,
  variant = "large",
  padded = true,
}: {
  count?: number;
  gridClassName?: string;
  variant?: "large" | "compact";
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        padded && "p-6",
        variant === "compact" && "gap-3",
        gridClassName,
      )}
    >
      {Array.from({ length: count }).map((_, i) =>
        variant === "compact" ? (
          <Card key={i} size="sm">
            <CardHeader>
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ) : (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
