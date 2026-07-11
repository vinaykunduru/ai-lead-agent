import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  suffix,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle className="text-xs font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums")}>
          {value}
          {suffix ?? ""}
        </p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
