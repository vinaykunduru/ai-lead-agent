import { notFound } from "next/navigation";
import { getCompanyById } from "@/modules/organizations/service";
import { CompanyOverviewForm } from "./company-overview-form";
import { CompanyStatusActions } from "./company-status-actions";

export default async function CompanyOverviewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Status</h2>
        <CompanyStatusActions company={company} />
      </section>
      <section>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Company profile</h2>
        <CompanyOverviewForm company={company} />
      </section>
    </div>
  );
}
