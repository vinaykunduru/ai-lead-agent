import { Badge, type badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const DOCUMENT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: "warning",
  ready: "success",
  failed: "destructive",
  archived: "secondary",
};
// "processing" has no dedicated semantic slot (not success/warning/danger) —
// tinted with the primary brand color instead, applied as an addition on
// top of the outline variant rather than a new Badge variant for one state.
const PROCESSING_CLASS = "bg-primary/10 text-primary border-transparent";

export function DocumentStatusBadge({ status }: { status: string }) {
  if (status === "processing") {
    return <Badge className={cn("capitalize", PROCESSING_CLASS)}>{status}</Badge>;
  }
  return (
    <Badge variant={DOCUMENT_STATUS_VARIANTS[status] ?? "secondary"} className="capitalize">
      {status}
    </Badge>
  );
}

export function EmbeddingStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "ready" ? "success" : "outline"} className="capitalize">
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
