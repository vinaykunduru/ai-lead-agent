import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { Lead } from "@/db/schema";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const PRIORITY_VARIANTS: Record<Lead["priority"], BadgeVariant> = {
  low: "secondary",
  medium: "outline",
  high: "warning",
  urgent: "destructive",
};

export function PriorityBadge({ priority }: { priority: Lead["priority"] }) {
  return (
    <Badge variant={PRIORITY_VARIANTS[priority]} className="capitalize">
      {priority}
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 70 ? "default" : score >= 40 ? "secondary" : "outline";
  return <Badge variant={variant}>{score}</Badge>;
}

const QUALIFICATION_VARIANTS: Record<NonNullable<Lead["qualificationStatus"]>, BadgeVariant> = {
  hot: "destructive",
  warm: "warning",
  cold: "secondary",
};

export function QualificationBadge({ status }: { status: Lead["qualificationStatus"] }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={QUALIFICATION_VARIANTS[status]} className="capitalize">
      {status}
    </Badge>
  );
}
