import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const WIDGET_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "secondary",
  active: "success",
  disabled: "warning",
  archived: "destructive",
};

export function WidgetStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={WIDGET_STATUS_VARIANTS[status] ?? "secondary"} className="capitalize">
      {status}
    </Badge>
  );
}
