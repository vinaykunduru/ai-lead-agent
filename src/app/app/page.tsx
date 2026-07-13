import { Building2, Clock, UserCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { getCompanySession } from "@/lib/auth/session";
import { getMyOrganization } from "@/modules/organizations/service";

export default async function CompanyDashboardPage() {
  const [session, organization] = await Promise.all([getCompanySession(), getMyOrganization()]);

  const stats = [
    { label: "Your role", value: session?.role, icon: UserCircle, capitalize: true },
    { label: "Company status", value: organization.status, icon: Building2, capitalize: true },
    { label: "Timezone", value: organization.timezone, icon: Clock, capitalize: false },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description={`Welcome to ${organization.name}.`} />
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${stat.capitalize ? "capitalize" : ""}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
