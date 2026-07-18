import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { OrganizationStatusBadge } from "@/shared/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCompanies } from "@/modules/organizations/service";
import { CreateCompanyDialog } from "./create-company-dialog";

export default async function CompaniesPage() {
  const companies = await listCompanies();

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Every company on the platform."
        actions={<CreateCompanyDialog />}
      />
      <div className="p-6">
        {companies.length === 0 ? (
          <EmptyState
            title="No companies yet"
            description="Create the first company to get started."
            action={<CreateCompanyDialog />}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="font-medium hover:underline"
                      >
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{company.slug}</TableCell>
                    <TableCell>
                      <OrganizationStatusBadge status={company.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.createdAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
