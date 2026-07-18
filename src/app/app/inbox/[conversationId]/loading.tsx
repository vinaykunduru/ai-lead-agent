import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function InboxConversationLoading() {
  return (
    <div>
      <div className="border-b px-6 pt-5 pb-3">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex flex-col gap-4 border-b px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="p-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
