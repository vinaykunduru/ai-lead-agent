import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const ORGANIZATION_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  trial: "warning",
  active: "success",
  suspended: "destructive",
};

export function OrganizationStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={ORGANIZATION_STATUS_VARIANTS[status] ?? "secondary"} className="capitalize">
      {status}
    </Badge>
  );
}

const MEMBERSHIP_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  active: "success",
  invited: "warning",
  disabled: "secondary",
};

export function MembershipStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={MEMBERSHIP_STATUS_VARIANTS[status] ?? "secondary"} className="capitalize">
      {status}
    </Badge>
  );
}
