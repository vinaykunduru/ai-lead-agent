import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const WIDGET_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300",
  active:
    "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  disabled: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
  archived: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
};

export function WidgetStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("capitalize", WIDGET_STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}
