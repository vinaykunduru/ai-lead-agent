import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LeadDetailLoading() {
  return (
    <div>
      <div className="border-b px-6 pt-5 pb-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-4 border-b px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-72" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[minmax(320px,2fr)_minmax(280px,1fr)]" aria-hidden="true">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
