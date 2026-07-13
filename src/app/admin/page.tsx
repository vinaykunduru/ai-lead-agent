import { Building2, CheckCircle2, Hourglass, ShieldAlert, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { getPlatformOverview } from "@/modules/organizations/service";

export default async function AdminOverviewPage() {
  const stats = await getPlatformOverview();

  const cards = [
    { label: "Total companies", value: stats.totalCompanies, icon: Building2 },
    { label: "Trial", value: stats.trialCompanies, icon: Hourglass },
    { label: "Active", value: stats.activeCompanies, icon: CheckCircle2 },
    { label: "Suspended", value: stats.suspendedCompanies, icon: ShieldAlert },
    { label: "Company users", value: stats.totalCompanyUsers, icon: Users },
  ];

  return (
    <div>
      <PageHeader title="Overview" description="Platform-wide snapshot." />
      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className="size-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
