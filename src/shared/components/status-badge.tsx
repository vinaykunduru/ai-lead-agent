import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ORGANIZATION_STATUS_STYLES: Record<string, string> = {
  trial: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
  active:
    "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  suspended: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
};

export function OrganizationStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("capitalize", ORGANIZATION_STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}
