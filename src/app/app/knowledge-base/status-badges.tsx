import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DOCUMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
  ready:
    "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
  archived: "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300",
};

export function DocumentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("capitalize", DOCUMENT_STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

export function EmbeddingStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", status === "ready" && "border-emerald-300 text-emerald-700 dark:text-emerald-300")}
    >
      {status}
    </Badge>
  );
}

export function CollectionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {status}
    </Badge>
  );
}

export function DocumentTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = { pdf: "PDF", docx: "DOCX", text: "Text", website: "Website" };
  return (
    <Badge variant="outline" className="uppercase">
      {labels[type] ?? type}
    </Badge>
  );
}
