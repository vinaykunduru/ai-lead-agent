import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/db/schema";

const PRIORITY_STYLES: Record<Lead["priority"], string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function PriorityBadge({ priority }: { priority: Lead["priority"] }) {
  return <Badge className={`capitalize ${PRIORITY_STYLES[priority]}`}>{priority}</Badge>;
}

export function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 70 ? "default" : score >= 40 ? "secondary" : "outline";
  return <Badge variant={variant}>{score}</Badge>;
}
