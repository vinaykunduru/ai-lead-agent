import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyById } from "@/modules/organizations/service";
import { OrganizationStatusBadge } from "@/shared/components/status-badge";
import { CompanyDetailNav } from "./company-detail-nav";

export default async function CompanyDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <div>
      <div className="flex flex-col gap-2 border-b px-6 py-5">
        <Link href="/admin/companies" className="text-sm text-muted-foreground hover:underline">
          ← Companies
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
          <OrganizationStatusBadge status={company.status} />
        </div>
        <p className="text-sm text-muted-foreground">{company.slug}</p>
      </div>
      <CompanyDetailNav companyId={companyId} />
      <div className="p-6">{children}</div>
    </div>
  );
}
