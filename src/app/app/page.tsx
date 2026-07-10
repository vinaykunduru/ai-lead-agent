import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { getCompanySession } from "@/lib/auth/session";
import { getMyOrganization } from "@/modules/organizations/service";

export default async function CompanyDashboardPage() {
  const [session, organization] = await Promise.all([getCompanySession(), getMyOrganization()]);

  return (
    <div>
      <PageHeader title="Dashboard" description={`Welcome to ${organization.name}.`} />
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold capitalize">{session?.role}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Company status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold capitalize">{organization.status}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Timezone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{organization.timezone}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
